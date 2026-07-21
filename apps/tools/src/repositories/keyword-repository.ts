import { createAdminClient } from "@/lib/supabase/admin";
import type { KeywordRow } from "@/types/domain";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function metadataPresence(term: string, app: { name?: string | null; subtitle?: string | null } | undefined): KeywordRow["metadataPresence"] {
  if (!app) return "unknown";
  const keyword = normalize(term);
  if (!keyword) return "unknown";
  if (normalize(app.name ?? "").includes(keyword)) return "title";
  if (normalize(app.subtitle ?? "").includes(keyword)) return "subtitle";
  return "missing";
}

function adsStatus(matchTypes: Set<string> | undefined, hasNegative: boolean): KeywordRow["adsStatus"] {
  if (hasNegative) return "negative";
  if (!matchTypes?.size) return "none";
  const exact = matchTypes.has("EXACT");
  const broad = matchTypes.has("BROAD");
  if (exact && broad) return "both";
  if (exact) return "exact";
  if (broad) return "broad";
  return "inactive";
}

export async function listKeywordRows({ appId, country, limit = 200 }: { appId?: string; country?: string; limit?: number } = {}): Promise<KeywordRow[]> {
  const db = createAdminClient();
  let links = db.from("aso_app_keywords").select("id,app_id,keyword_id,priority,status").order("created_at", { ascending: false }).limit(limit);
  if (appId) links = links.eq("app_id", appId);
  const { data: linkRows, error: linkError } = await links;
  if (linkError) throw new Error("Could not read keyword assignments.");
  if (!linkRows?.length) return [];
  const appIds = [...new Set(linkRows.map((row) => row.app_id))];
  const keywordIds = [...new Set(linkRows.map((row) => row.keyword_id))];
  const [{ data: apps, error: appsError }, { data: keywords, error: keywordsError }] = await Promise.all([
    db.from("aso_apps").select("id,name,subtitle,store_app_id").in("id", appIds),
    db.from("aso_keywords").select("id,term,country,priority").in("id", keywordIds),
  ]);
  if (appsError || keywordsError) throw new Error("Could not resolve keyword references.");
  const scopedKeywords = (keywords ?? []).filter((keyword) => !country || keyword.country === country);
  const scopedIds = scopedKeywords.map((keyword) => keyword.id);
  const { data: snapshots, error: snapshotsError } = scopedIds.length ? await db.from("aso_keyword_rank_snapshots").select("keyword_id,store_app_id,rank,change_7d,change_30d,best_rank,captured_at").eq("app_kind", "owned").in("keyword_id", scopedIds).order("captured_at", { ascending: false }).limit(1000) : { data: [], error: null };
  if (snapshotsError) throw new Error("Could not read rank snapshots.");
  const appById = new Map((apps ?? []).map((app) => [app.id, app]));
  const keywordById = new Map(scopedKeywords.map((keyword) => [keyword.id, keyword]));
  const latest = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const snapshot of snapshots ?? []) { const key = `${snapshot.keyword_id}:${snapshot.store_app_id}`; if (!latest.has(key)) latest.set(key, snapshot); }
  const { data: campaigns, error: campaignsError } = appIds.length ? await db.from("apple_ads_campaigns").select("id,app_id,countries_or_regions").in("app_id", appIds).eq("is_deleted", false).limit(1000) : { data: [], error: null };
  if (campaignsError) throw new Error("Could not read Apple Ads campaign coverage.");
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  const [{ data: paidKeywords, error: paidKeywordError }, { data: negatives, error: negativeError }] = campaignIds.length ? await Promise.all([
    db.from("apple_ads_keywords").select("campaign_id,keyword_text,match_type,status").in("campaign_id", campaignIds).eq("is_deleted", false).limit(5000),
    db.from("apple_ads_negative_keywords").select("campaign_id,keyword_text,status").in("campaign_id", campaignIds).eq("is_deleted", false).limit(5000),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (paidKeywordError || negativeError) throw new Error("Could not read Apple Ads keyword coverage.");
  const campaignById = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign]));
  const paidMatches = new Map<string, Set<string>>();
  for (const row of paidKeywords ?? []) {
    const campaign = campaignById.get(row.campaign_id);
    if (!campaign || !Array.isArray(campaign.countries_or_regions)) continue;
    if (!/active|enabled|running/i.test(row.status ?? "")) continue;
    for (const market of campaign.countries_or_regions) {
      if (typeof market !== "string") continue;
      const key = `${campaign.app_id}:${market.toLowerCase()}:${normalize(row.keyword_text)}`;
      const value = paidMatches.get(key) ?? new Set<string>();
      value.add(String(row.match_type ?? "UNKNOWN").toUpperCase());
      paidMatches.set(key, value);
    }
  }
  const negativeMatches = new Set<string>();
  for (const row of negatives ?? []) {
    const campaign = campaignById.get(row.campaign_id);
    if (!campaign || !Array.isArray(campaign.countries_or_regions)) continue;
    if (/deleted|removed/i.test(row.status ?? "")) continue;
    for (const market of campaign.countries_or_regions) if (typeof market === "string") negativeMatches.add(`${campaign.app_id}:${market.toLowerCase()}:${normalize(row.keyword_text)}`);
  }
  return linkRows.flatMap((link) => {
    const app = appById.get(link.app_id); const keyword = keywordById.get(link.keyword_id);
    if (!app || !keyword) return [];
    const latestSnapshot = latest.get(`${keyword.id}:${app.store_app_id}`);
    const paidKey = `${app.id}:${keyword.country.toLowerCase()}:${normalize(keyword.term)}`;
    return [{ linkId: link.id, appId: app.id, appName: app.name, term: keyword.term, country: keyword.country, priority: link.priority ?? keyword.priority, status: link.status, rank: latestSnapshot?.rank ?? null, change7d: latestSnapshot?.change_7d ?? null, change30d: latestSnapshot?.change_30d ?? null, bestRank: latestSnapshot?.best_rank ?? null, metadataPresence: metadataPresence(keyword.term, app), adsStatus: adsStatus(paidMatches.get(paidKey), negativeMatches.has(paidKey)), capturedAt: latestSnapshot?.captured_at ?? null }];
  });
}
