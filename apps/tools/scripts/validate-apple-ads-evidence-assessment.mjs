import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { assessAppleAdsEvidence } from "../src/lib/apple-ads/evidence-assessment.ts";

nextEnv.loadEnvConfig(process.cwd());

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const numeric = (value) => Number(value ?? 0);
const latest = (values) => values.filter(Boolean).sort().at(-1) ?? null;
const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
};

const campaigns = requireData(await db.from("apple_ads_campaigns").select("id,connection_id,app_id,name,status,currency,countries_or_regions,updated_at").eq("is_deleted", false), "campaigns");
const campaign = campaigns.find((row) => Array.isArray(row.countries_or_regions) && row.countries_or_regions.includes("GB"));
if (!campaign?.app_id) throw new Error("No active GB campaign with an app mapping was found.");

const [appResult, metricsResult, termsResult, keywordsResult, negativesResult, groupsResult] = await Promise.all([
  db.from("aso_apps").select("id,name").eq("id", campaign.app_id).single(),
  db.from("apple_ads_daily_metrics").select("metric_date,country,impressions,taps,installs,spend,currency,source_synced_at").eq("campaign_id", campaign.id).order("metric_date"),
  db.from("apple_ads_search_terms").select("search_term,source_keyword_text,match_source,country,ad_group_id,keyword_id,impressions,taps,installs,spend,source_synced_at").eq("campaign_id", campaign.id).order("metric_date"),
  db.from("apple_ads_keywords").select("id,ad_group_id,keyword_text,match_type,status,is_deleted").eq("campaign_id", campaign.id),
  db.from("apple_ads_negative_keywords").select("ad_group_id,keyword_text,match_type,status,is_deleted").eq("campaign_id", campaign.id),
  db.from("apple_ads_ad_groups").select("id,search_match_enabled,status,is_deleted").eq("campaign_id", campaign.id),
]);
if (appResult.error) throw new Error(`app: ${appResult.error.message}`);
const metrics = requireData(metricsResult, "metrics");
const terms = requireData(termsResult, "search terms").filter((row) => row.country === "gb" || row.country === "all");
const keywords = requireData(keywordsResult, "keywords");
const negatives = requireData(negativesResult, "negative keywords");
const groups = requireData(groupsResult, "ad groups");
const dates = metrics.map((row) => row.metric_date).sort();
const totals = metrics.reduce((sum, row) => ({
  impressions: sum.impressions + numeric(row.impressions),
  taps: sum.taps + numeric(row.taps),
  installs: sum.installs + numeric(row.installs),
  spend: sum.spend + numeric(row.spend),
  currency: sum.currency ?? row.currency ?? campaign.currency ?? null,
}), { impressions: 0, taps: 0, installs: 0, spend: 0, currency: null });
const metricSync = latest(metrics.map((row) => row.source_synced_at));
const termSync = latest(terms.map((row) => row.source_synced_at));
const sourceSync = metricSync && termSync ? (Date.parse(metricSync) <= Date.parse(termSync) ? metricSync : termSync) : metricSync ?? termSync;
const now = new Date().toISOString();
const assessment = assessAppleAdsEvidence({
  appId: appResult.data.id,
  appName: appResult.data.name,
  campaignId: campaign.id,
  campaignName: campaign.name,
  storefront: "GB",
  campaignStatus: campaign.status,
  evidenceWindow: { start: dates[0], end: dates.at(-1) },
  generatedAt: now,
  dataFreshness: sourceSync && Date.parse(now) - Date.parse(sourceSync) <= 48 * 3_600_000 ? "fresh" : "stale",
  dataCompleteness: "complete",
  totals,
  searchTerms: terms.map((row) => ({
    searchTerm: row.search_term,
    sourceKeywordText: row.source_keyword_text,
    matchSource: row.match_source,
    adGroupId: row.ad_group_id,
    keywordId: row.keyword_id,
    impressions: numeric(row.impressions),
    taps: numeric(row.taps),
    installs: numeric(row.installs),
    spend: numeric(row.spend),
  })),
  keywords: keywords.map((row) => ({
    id: row.id,
    adGroupId: row.ad_group_id,
    keywordText: row.keyword_text,
    matchType: row.match_type,
    status: row.status,
    isDeleted: Boolean(row.is_deleted),
  })),
  negativeKeywords: negatives.map((row) => ({
    adGroupId: row.ad_group_id,
    keywordText: row.keyword_text,
    matchType: row.match_type,
    status: row.status,
    isDeleted: Boolean(row.is_deleted),
  })),
  adGroups: groups.map((row) => ({
    id: row.id,
    searchMatchEnabled: row.search_match_enabled,
    status: row.status,
    isDeleted: Boolean(row.is_deleted),
  })),
});

const recommendationCount = requireData(await db.from("apple_ads_recommendations").select("id", { count: "exact", head: false }), "recommendations").length;
const campaignAfter = requireData(await db.from("apple_ads_campaigns").select("status,updated_at").eq("id", campaign.id), "campaign after validation")[0];
const suppressedTargets = assessment.recommendations.filter((row) =>
  row.targetType === "SEARCH_TERM" && ["low_volume", "low volume", ""].includes((row.targetText ?? "").trim().toLowerCase())
);
console.log(JSON.stringify({
  mode: "read-only",
  campaign: campaign.name,
  storefront: assessment.storefront,
  campaignStatusBeforeAndAfter: [campaign.status, campaignAfter?.status],
  campaignUpdatedAtBeforeAndAfter: [campaign.updated_at, campaignAfter?.updated_at],
  evidenceWindow: assessment.evidenceWindow,
  sourceSync,
  totals: assessment.totals,
  searchTermRows: terms.length,
  trafficQuality: assessment.trafficQuality,
  conversionEvidence: assessment.conversionEvidence,
  conclusions: assessment.recommendations.map((row) => ({ type: row.type, target: row.targetText, title: row.title })),
  suppressedTargets: suppressedTargets.length,
  storedRecommendationCount: recommendationCount,
  appleAdsWriteMethodsInvoked: 0,
}, null, 2));
