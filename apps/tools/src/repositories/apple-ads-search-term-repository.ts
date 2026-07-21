import { createAdminClient } from "@/lib/supabase/admin";

export type AppleAdsSearchTermRow = {
  id: string;
  searchTerm: string;
  campaignName: string;
  adGroupName: string | null;
  sourceKeywordText: string | null;
  matchSource: string | null;
  country: string;
  metricDate: string;
  impressions: number;
  taps: number;
  installs: number;
  spend: number;
  currency: string | null;
  intentCluster: string | null;
  productFit: string | null;
  suggestedAction: string | null;
};

export async function listAppleAdsSearchTerms(ownerUserId: string): Promise<AppleAdsSearchTermRow[]> {
  const db = createAdminClient();
  const { data: connections, error: connectionError } = await db.from("apple_ads_connections").select("id").eq("owner_user_id", ownerUserId);
  if (connectionError) throw new Error("Could not read Apple Ads connections.");
  const connectionIds = (connections ?? []).map((connection) => connection.id);
  if (!connectionIds.length) return [];

  const { data: rows, error } = await db.from("apple_ads_search_terms").select("id,campaign_id,ad_group_id,keyword_id,search_term,source_keyword_text,match_source,country,metric_date,impressions,taps,installs,spend,currency,intent_cluster,product_fit,suggested_action").in("connection_id", connectionIds).order("metric_date", { ascending: false }).limit(500);
  if (error) throw new Error("Could not read Apple Ads search terms.");
  if (!rows?.length) return [];

  const campaignIds = [...new Set(rows.map((row) => row.campaign_id).filter((id): id is string => typeof id === "string"))];
  const adGroupIds = [...new Set(rows.map((row) => row.ad_group_id).filter((id): id is string => typeof id === "string"))];
  const keywordIds = [...new Set(rows.map((row) => row.keyword_id).filter((id): id is string => typeof id === "string"))];
  const [{ data: campaigns, error: campaignError }, { data: adGroups, error: adGroupError }, { data: keywords, error: keywordError }] = await Promise.all([
    campaignIds.length ? db.from("apple_ads_campaigns").select("id,name").in("id", campaignIds) : { data: [], error: null },
    adGroupIds.length ? db.from("apple_ads_ad_groups").select("id,name").in("id", adGroupIds) : { data: [], error: null },
    keywordIds.length ? db.from("apple_ads_keywords").select("id,keyword_text").in("id", keywordIds) : { data: [], error: null },
  ]);
  if (campaignError) throw new Error("Could not resolve Apple Ads campaigns.");
  if (adGroupError) throw new Error("Could not resolve Apple Ads ad groups.");
  if (keywordError) throw new Error("Could not resolve Apple Ads keywords.");

  const campaignNames = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign.name]));
  const adGroupNames = new Map((adGroups ?? []).map((adGroup) => [adGroup.id, adGroup.name]));
  const keywordText = new Map((keywords ?? []).map((keyword) => [keyword.id, keyword.keyword_text]));

  return rows.map((row) => ({
    id: row.id,
    searchTerm: row.search_term,
    campaignName: campaignNames.get(row.campaign_id) ?? "Campaign",
    adGroupName: row.ad_group_id ? adGroupNames.get(row.ad_group_id) ?? "Ad group" : null,
    sourceKeywordText: row.source_keyword_text ?? (row.keyword_id ? keywordText.get(row.keyword_id) ?? null : null),
    matchSource: row.match_source,
    country: row.country,
    metricDate: row.metric_date,
    impressions: Number(row.impressions ?? 0),
    taps: Number(row.taps ?? 0),
    installs: Number(row.installs ?? 0),
    spend: Number(row.spend ?? 0),
    currency: row.currency,
    intentCluster: row.intent_cluster,
    productFit: row.product_fit,
    suggestedAction: row.suggested_action,
  }));
}
