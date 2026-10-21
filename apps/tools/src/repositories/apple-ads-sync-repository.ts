import { createAdminClient } from "@/lib/supabase/admin";

export type AppleAdsSyncRunRow = { id: string; resourceType: string; status: string; rowsInserted: number; errorMessage: string | null; createdAt: string };
export type AppleAdsQualityCheck = { label: string; status: "ready" | "waiting" | "attention"; detail: string };
export type AppleAdsDataQuality = {
  counts: { connections: number; mappings: number; campaigns: number; adGroups: number; keywords: number; negativeKeywords: number; dailyMetrics: number; activeKeywords: number; staleKeywords: number; localizationReviewMarkets: number };
  latest: { apiSuccessAt: string | null; campaignSyncedAt: string | null; structureSyncedAt: string | null; metricDate: string | null; metricSyncedAt: string | null; keywordSnapshotAt: string | null };
  checks: AppleAdsQualityCheck[];
  runs: AppleAdsSyncRunRow[];
};

export async function listAppleAdsSyncRuns(connectionIds: string[]): Promise<AppleAdsSyncRunRow[]> {
  if (!connectionIds.length) return [];
  const { data, error } = await createAdminClient().from("apple_ads_sync_runs").select("id,resource_type,status,rows_inserted,error_message,created_at").in("connection_id", connectionIds).order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Could not read Apple Ads sync history.");
  return (data ?? []).map((row) => ({ id: row.id, resourceType: row.resource_type, status: row.status, rowsInserted: row.rows_inserted, errorMessage: row.error_message, createdAt: row.created_at }));
}

const latestDate = (rows: { source_synced_at?: string | null; metric_date?: string | null; last_api_success_at?: string | null }[] | null | undefined, field: "source_synced_at" | "metric_date" | "last_api_success_at") => rows?.find((row) => typeof row[field] === "string")?.[field] ?? null;

export async function getAppleAdsDataQuality(ownerUserId: string): Promise<AppleAdsDataQuality> {
  const db = createAdminClient();
  const { data: connections, error: connectionError } = await db.from("apple_ads_connections").select("id,last_api_success_at").eq("owner_user_id", ownerUserId).order("last_api_success_at", { ascending: false, nullsFirst: false });
  if (connectionError) throw new Error("Could not read Apple Ads connections.");
  const connectionIds = (connections ?? []).map((connection) => connection.id);
  if (!connectionIds.length) {
    return {
      counts: { connections: 0, mappings: 0, campaigns: 0, adGroups: 0, keywords: 0, negativeKeywords: 0, dailyMetrics: 0, activeKeywords: 0, staleKeywords: 0, localizationReviewMarkets: 0 },
      latest: { apiSuccessAt: null, campaignSyncedAt: null, structureSyncedAt: null, metricDate: null, metricSyncedAt: null, keywordSnapshotAt: null },
      checks: [{ label: "Connection", status: "attention", detail: "Connect an Apple Ads organization before sync health can be evaluated." }],
      runs: [],
    };
  }

  const [{ data: mappings, error: mappingError }, { data: campaigns, error: campaignError }, { data: adGroups, error: adGroupError }, { data: keywords, error: keywordError }, { data: negatives, error: negativeError }, { data: metrics, error: metricError }, { data: runs, error: runError }] = await Promise.all([
    db.from("apple_ads_app_mappings").select("id,app_id").in("connection_id", connectionIds),
    db.from("apple_ads_campaigns").select("id,app_id,status,serving_status,source_synced_at").in("connection_id", connectionIds).eq("is_deleted", false).order("source_synced_at", { ascending: false }),
    db.from("apple_ads_ad_groups").select("id,source_synced_at").in("connection_id", connectionIds).eq("is_deleted", false).order("source_synced_at", { ascending: false }),
    db.from("apple_ads_keywords").select("id").in("connection_id", connectionIds).eq("is_deleted", false),
    db.from("apple_ads_negative_keywords").select("id").in("connection_id", connectionIds).eq("is_deleted", false),
    db.from("apple_ads_daily_metrics").select("id,campaign_id,metric_date,source_synced_at").in("connection_id", connectionIds).order("metric_date", { ascending: false }).order("source_synced_at", { ascending: false }).limit(500),
    db.from("apple_ads_sync_runs").select("id,resource_type,status,rows_inserted,error_message,created_at").in("connection_id", connectionIds).order("created_at", { ascending: false }).limit(30),
  ]);
  if (mappingError) throw new Error("Could not read Apple Ads app mappings.");
  if (campaignError) throw new Error("Could not read Apple Ads campaigns.");
  if (adGroupError) throw new Error("Could not read Apple Ads ad groups.");
  if (keywordError) throw new Error("Could not read Apple Ads keywords.");
  if (negativeError) throw new Error("Could not read Apple Ads negative keywords.");
  if (metricError) throw new Error("Could not read Apple Ads metrics.");
  if (runError) throw new Error("Could not read Apple Ads sync history.");

  const mappedAppIds = [...new Set((mappings ?? []).map((mapping) => mapping.app_id).filter((id): id is string => typeof id === "string"))];
  const [{ data: activeKeywordLinks, error: activeKeywordError }, { data: latestSnapshots, error: snapshotError }, { data: reviewMarkets, error: storefrontError }] = mappedAppIds.length ? await Promise.all([
    db.from("aso_app_keywords").select("id,keyword_id,app_id").in("app_id", mappedAppIds).eq("status", "active").limit(5000),
    db.from("aso_keyword_rank_snapshots").select("keyword_id,store_app_id,captured_at").eq("app_kind", "owned").order("captured_at", { ascending: false }).limit(5000),
    db.from("aso_app_storefronts").select("id,app_id,metadata_localised,screenshots_localised,notes").in("app_id", mappedAppIds).limit(1000),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  if (activeKeywordError) throw new Error("Could not read active keyword tracking.");
  if (snapshotError) throw new Error("Could not read keyword snapshot freshness.");
  if (storefrontError) throw new Error("Could not read localization health.");

  const mappedRuns = (runs ?? []).map((row) => ({ id: row.id, resourceType: row.resource_type, status: row.status, rowsInserted: row.rows_inserted, errorMessage: row.error_message, createdAt: row.created_at }));
  const failedRun = mappedRuns.find((run) => run.status === "failed" || run.status === "partial");
  const latestSnapshotAt = latestSnapshots?.find((snapshot) => typeof snapshot.captured_at === "string")?.captured_at ?? null;
  const staleCutoff = Date.now() - 72 * 36e5;
  const latestSnapshotByKeyword = new Map<string, string>();
  for (const snapshot of latestSnapshots ?? []) {
    if (!latestSnapshotByKeyword.has(snapshot.keyword_id)) latestSnapshotByKeyword.set(snapshot.keyword_id, snapshot.captured_at);
  }
  const staleKeywords = (activeKeywordLinks ?? []).filter((link) => {
    const capturedAt = latestSnapshotByKeyword.get(link.keyword_id);
    return !capturedAt || Date.parse(capturedAt) < staleCutoff;
  });
  const localizationReviewMarkets = (reviewMarkets ?? []).filter((market) => {
    const notes = String(market.notes ?? "").toLowerCase();
    const screenshotUiEnglish = notes.includes("screenshot ui english") || notes.includes("in-screenshot ui english") || notes.includes("ui remains english");
    const appLanguageEnglish = notes.includes("app content english") || notes.includes("app language english") || notes.includes("app content remains english");
    return market.metadata_localised && market.screenshots_localised && (screenshotUiEnglish || appLanguageEnglish);
  });
  const metricCampaignIds = new Set((metrics ?? []).map((metric) => metric.campaign_id).filter(Boolean));
  const activeCampaignsWithoutMetrics = (campaigns ?? []).filter((campaign) => /enabled|active|running/i.test(`${campaign.status ?? ""} ${campaign.serving_status ?? ""}`) && !metricCampaignIds.has(campaign.id) && Date.parse(campaign.source_synced_at ?? "") < Date.now() - 24 * 36e5);
  const unmappedCampaigns = (campaigns ?? []).filter((campaign) => !campaign.app_id);
  const counts = { connections: connectionIds.length, mappings: mappings?.length ?? 0, campaigns: campaigns?.length ?? 0, adGroups: adGroups?.length ?? 0, keywords: keywords?.length ?? 0, negativeKeywords: negatives?.length ?? 0, dailyMetrics: metrics?.length ?? 0, activeKeywords: activeKeywordLinks?.length ?? 0, staleKeywords: staleKeywords.length, localizationReviewMarkets: localizationReviewMarkets.length };

  const checks: AppleAdsQualityCheck[] = [
    { label: "Connection", status: latestDate(connections, "last_api_success_at") ? "ready" : "attention", detail: latestDate(connections, "last_api_success_at") ? "Apple Ads OAuth and organization access have succeeded." : "No successful Apple Ads API check is recorded yet." },
    { label: "App mapping", status: counts.mappings > 0 ? "ready" : "attention", detail: counts.mappings > 0 ? `${counts.mappings} Kopa app mapping${counts.mappings === 1 ? "" : "s"} saved.` : "Save an Adam ID mapping before campaign data can be tied to a Kopa app." },
    { label: "Campaign app mapping", status: unmappedCampaigns.length ? "attention" : "ready", detail: unmappedCampaigns.length ? `${unmappedCampaigns.length} imported campaign${unmappedCampaigns.length === 1 ? "" : "s"} cannot be tied to a Kopa app yet.` : "Imported campaigns are tied to Kopa app mappings where available." },
    { label: "Campaign import", status: counts.campaigns > 0 ? "ready" : "waiting", detail: counts.campaigns > 0 ? `${counts.campaigns} campaign${counts.campaigns === 1 ? "" : "s"} imported.` : "No campaigns imported yet. This can happen before an ASA campaign exists." },
    { label: "Structure import", status: counts.adGroups > 0 || counts.keywords > 0 ? "ready" : counts.campaigns > 0 ? "attention" : "waiting", detail: counts.adGroups > 0 || counts.keywords > 0 ? `${counts.adGroups} ad groups and ${counts.keywords} keywords imported.` : counts.campaigns > 0 ? "Campaign exists, but no ad groups or keywords are imported yet." : "Structure waits for a campaign import first." },
    { label: "Performance rows", status: activeCampaignsWithoutMetrics.length ? "attention" : counts.dailyMetrics > 0 ? "ready" : "waiting", detail: activeCampaignsWithoutMetrics.length ? `${activeCampaignsWithoutMetrics.length} active campaign${activeCampaignsWithoutMetrics.length === 1 ? "" : "s"} have no imported reporting after the expected delay.` : counts.dailyMetrics > 0 ? `${counts.dailyMetrics} daily metric rows imported.` : "No daily metrics yet. This is expected while the campaign has no delivery." },
    { label: "Keyword snapshot freshness", status: staleKeywords.length ? "attention" : counts.activeKeywords ? "ready" : "waiting", detail: staleKeywords.length ? `${staleKeywords.length} active tracked keyword${staleKeywords.length === 1 ? "" : "s"} lack a fresh rank snapshot in the last 72 hours.` : counts.activeKeywords ? "Tracked keyword snapshots are fresh for mapped apps." : "No active tracked keywords are mapped to Apple Ads apps yet." },
    { label: "Localization review", status: localizationReviewMarkets.length ? "attention" : "ready", detail: localizationReviewMarkets.length ? `${localizationReviewMarkets.length} market${localizationReviewMarkets.length === 1 ? "" : "s"} look localized in metadata/headlines but still indicate English UI or app content.` : "No supported localization mismatch is flagged for mapped apps." },
    { label: "Sync errors", status: failedRun ? "attention" : "ready", detail: failedRun ? `${failedRun.resourceType} sync ended as ${failedRun.status}: ${failedRun.errorMessage ?? "No error message saved."}` : "No failed or partial sync runs in the latest history." },
  ];

  return {
    counts,
    latest: {
      apiSuccessAt: latestDate(connections, "last_api_success_at"),
      campaignSyncedAt: latestDate(campaigns, "source_synced_at"),
      structureSyncedAt: latestDate(adGroups, "source_synced_at"),
      metricDate: latestDate(metrics, "metric_date"),
      metricSyncedAt: latestDate(metrics, "source_synced_at"),
      keywordSnapshotAt: latestSnapshotAt,
    },
    checks,
    runs: mappedRuns,
  };
}
