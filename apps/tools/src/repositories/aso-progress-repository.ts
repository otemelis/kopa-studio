import { createAdminClient } from "@/lib/supabase/admin";
import type { RankObservation } from "@/lib/aso/progress";

export type ProgressKeyword = { id: string; term: string; country: string; language: string | null; priority: string };
export type ProgressSnapshot = RankObservation & { keyword_id: string; store_app_id: string };
export type ProgressMetric = { date: string; country: string; event: string; page_type: string | null; source_type: string | null; count: number | null; unique_count: number | null };
export type SalesMetric = { date: string; country: string; downloads: number | null; proceeds: number | null; proceeds_currency: string | null; source: string };
export type ProgressChange = { happened_at: string; country: string | null; field: string | null; old_value: string | null; new_value: string | null; change_type: string };
export type ProgressRun = { started_at: string; finished_at: string | null; status: string; processed: number; succeeded: number; failed: number; warnings: number; summary: Record<string, unknown> | null };
export type PaidSearchMetric = { metric_date: string; country: string | null; impressions: number | null; taps: number | null; installs: number | null; spend: number | null; currency: string | null; source_synced_at: string | null };

export async function getAsoProgressData(appId: string, country?: string) {
  const db = createAdminClient();
  const { data: app, error: appError } = await db.from("aso_apps").select("id,name,store_app_id,primary_country").eq("id", appId).maybeSingle();
  if (appError || !app) throw new Error("Could not read the selected app.");
  const linksQuery = db.from("aso_app_keywords").select("keyword_id,status,priority").eq("app_id", appId).eq("status", "active").limit(1000);
  const { data: links, error: linkError } = await linksQuery;
  if (linkError) throw new Error("Could not read tracked keyword assignments.");
  const linkById = new Map((links ?? []).map((row) => [row.keyword_id, row]));
  const ids = [...linkById.keys()];
  const { data: rawKeywords, error: keywordError } = ids.length
    ? await db.from("aso_keywords").select("id,term,country,language,priority").in("id", ids).order("country").order("term").limit(1000)
    : { data: [], error: null };
  if (keywordError) throw new Error("Could not read tracked keywords.");
  const keywords = ((rawKeywords ?? []) as ProgressKeyword[]).filter((row) => !country || row.country === country);
  const keywordIds = keywords.map((row) => row.id);
  const from = new Date(Date.now() - 36 * 86_400_000).toISOString();
  const [rankResult, metricResult, salesResult, changeResult, runResult, campaignResult] = await Promise.all([
    keywordIds.length ? db.from("aso_keyword_rank_snapshots").select("keyword_id,store_app_id,captured_at,captured_on,rank,found,result_depth,collection_status,source").eq("app_kind", "owned").eq("store_app_id", app.store_app_id).in("keyword_id", keywordIds).gte("captured_at", from).order("captured_at", { ascending: true }).limit(5000) : Promise.resolve({ data: [], error: null }),
    db.from("aso_storefront_metrics").select("date,country,event,page_type,source_type,count,unique_count").eq("app_id", appId).gte("date", from.slice(0, 10)).order("date", { ascending: true }).limit(5000),
    db.from("aso_daily_metrics").select("date,country,downloads,proceeds,proceeds_currency,source").eq("app_id", appId).gte("date", from.slice(0, 10)).order("date", { ascending: true }).limit(2000),
    db.from("aso_metadata_change_events").select("happened_at,country,field,old_value,new_value,change_type").eq("app_id", appId).gte("happened_at", from).order("happened_at", { ascending: false }).limit(100),
    db.from("aso_sync_runs").select("started_at,finished_at,status,processed,succeeded,failed,warnings,summary").eq("provider", "apple_public").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("apple_ads_campaigns").select("id").eq("app_id", appId).eq("is_deleted", false).limit(500),
  ]);
  if (rankResult.error || metricResult.error || salesResult.error || changeResult.error || runResult.error) throw new Error("Could not read one or more ASO progress sources.");
  if (campaignResult.error) throw new Error("Could not read paid-search campaign coverage.");
  const campaignIds = (campaignResult.data ?? []).map((row) => row.id);
  const paidResult = campaignIds.length ? await db.from("apple_ads_daily_metrics").select("metric_date,country,impressions,taps,installs,spend,currency,source_synced_at").in("campaign_id", campaignIds).gte("metric_date", from.slice(0, 10)).order("metric_date", { ascending: true }).limit(2000) : { data: [], error: null };
  if (paidResult.error) throw new Error("Could not read paid-search metrics.");
  return {
    app,
    keywords,
    snapshots: (rankResult.data ?? []) as ProgressSnapshot[],
    metrics: (metricResult.data ?? []) as ProgressMetric[],
    sales: (salesResult.data ?? []) as SalesMetric[],
    changes: (changeResult.data ?? []) as ProgressChange[],
    latestRun: runResult.data as ProgressRun | null,
    paidSearch: (paidResult.data ?? []) as PaidSearchMetric[],
  };
}
