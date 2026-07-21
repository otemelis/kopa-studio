import { createAdminClient } from "@/lib/supabase/admin";

export type AppleAdsStructureCampaign = {
  id: string;
  appId: string | null;
  name: string;
  status: string;
  servingStatus: string | null;
  dailyBudgetAmount: number | null;
  currency: string | null;
  countriesOrRegions: string[];
  sourceSyncedAt: string;
  adGroupCount: number;
  keywordCount: number;
  negativeKeywordCount: number;
};

export type AppleAdsStructureAdGroup = {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  servingStatus: string | null;
  defaultBidAmount: number | null;
  currency: string | null;
  searchMatchEnabled: boolean | null;
  keywordCount: number;
  negativeKeywordCount: number;
};

export type AppleAdsStructureKeyword = {
  id: string;
  campaignId: string;
  adGroupId: string;
  keywordText: string;
  matchType: string | null;
  status: string | null;
  servingStatus: string | null;
  bidAmount: number | null;
  currency: string | null;
};

export type AppleAdsStructureNegativeKeyword = {
  id: string;
  campaignId: string;
  adGroupId: string | null;
  keywordText: string;
  matchType: string | null;
  status: string | null;
};

export type AppleAdsStructure = {
  campaigns: AppleAdsStructureCampaign[];
  adGroups: AppleAdsStructureAdGroup[];
  keywords: AppleAdsStructureKeyword[];
  negativeKeywords: AppleAdsStructureNegativeKeyword[];
  totals: { campaigns: number; adGroups: number; keywords: number; negativeKeywords: number };
};

const numberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return null;
};

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const booleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
};
const searchMatchFromRow = (row: { search_match_enabled: boolean | null; raw_payload?: unknown }) => {
  const raw = row.raw_payload as { automatedKeywordsOptIn?: unknown } | null;
  return booleanOrNull(raw?.automatedKeywordsOptIn) ?? row.search_match_enabled;
};

export async function getAppleAdsStructure(ownerUserId: string): Promise<AppleAdsStructure> {
  const db = createAdminClient();
  const { data: connections, error: connectionError } = await db.from("apple_ads_connections").select("id").eq("owner_user_id", ownerUserId);
  if (connectionError) throw new Error("Could not read Apple Ads connections.");
  const connectionIds = (connections ?? []).map((connection) => connection.id);
  if (!connectionIds.length) return { campaigns: [], adGroups: [], keywords: [], negativeKeywords: [], totals: { campaigns: 0, adGroups: 0, keywords: 0, negativeKeywords: 0 } };

  const [{ data: campaignRows, error: campaignError }, { data: adGroupRows, error: adGroupError }, { data: keywordRows, error: keywordError }, { data: negativeRows, error: negativeError }] = await Promise.all([
    db.from("apple_ads_campaigns").select("id,app_id,name,status,serving_status,daily_budget_amount,currency,countries_or_regions,source_synced_at").in("connection_id", connectionIds).eq("is_deleted", false).order("source_synced_at", { ascending: false }),
    db.from("apple_ads_ad_groups").select("id,campaign_id,name,status,serving_status,default_bid_amount,currency,search_match_enabled,raw_payload").in("connection_id", connectionIds).eq("is_deleted", false).order("name", { ascending: true }),
    db.from("apple_ads_keywords").select("id,campaign_id,ad_group_id,keyword_text,match_type,status,serving_status,bid_amount,currency").in("connection_id", connectionIds).eq("is_deleted", false).order("keyword_text", { ascending: true }).limit(500),
    db.from("apple_ads_negative_keywords").select("id,campaign_id,ad_group_id,keyword_text,match_type,status").in("connection_id", connectionIds).eq("is_deleted", false).order("keyword_text", { ascending: true }).limit(500),
  ]);
  if (campaignError) throw new Error("Could not read Apple Ads campaigns.");
  if (adGroupError) throw new Error("Could not read Apple Ads ad groups.");
  if (keywordError) throw new Error("Could not read Apple Ads keywords.");
  if (negativeError) throw new Error("Could not read Apple Ads negative keywords.");

  const keywordsByCampaign = new Map<string, number>();
  const keywordsByAdGroup = new Map<string, number>();
  for (const row of keywordRows ?? []) {
    keywordsByCampaign.set(row.campaign_id, (keywordsByCampaign.get(row.campaign_id) ?? 0) + 1);
    keywordsByAdGroup.set(row.ad_group_id, (keywordsByAdGroup.get(row.ad_group_id) ?? 0) + 1);
  }

  const negativesByCampaign = new Map<string, number>();
  const negativesByAdGroup = new Map<string, number>();
  for (const row of negativeRows ?? []) {
    negativesByCampaign.set(row.campaign_id, (negativesByCampaign.get(row.campaign_id) ?? 0) + 1);
    if (row.ad_group_id) negativesByAdGroup.set(row.ad_group_id, (negativesByAdGroup.get(row.ad_group_id) ?? 0) + 1);
  }

  const adGroupsByCampaign = new Map<string, number>();
  for (const row of adGroupRows ?? []) adGroupsByCampaign.set(row.campaign_id, (adGroupsByCampaign.get(row.campaign_id) ?? 0) + 1);

  const campaigns = (campaignRows ?? []).map((row) => ({
    id: row.id,
    appId: row.app_id,
    name: row.name,
    status: row.status,
    servingStatus: row.serving_status,
    dailyBudgetAmount: numberOrNull(row.daily_budget_amount),
    currency: row.currency,
    countriesOrRegions: strings(row.countries_or_regions),
    sourceSyncedAt: row.source_synced_at,
    adGroupCount: adGroupsByCampaign.get(row.id) ?? 0,
    keywordCount: keywordsByCampaign.get(row.id) ?? 0,
    negativeKeywordCount: negativesByCampaign.get(row.id) ?? 0,
  }));

  const adGroups = (adGroupRows ?? []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    status: row.status,
    servingStatus: row.serving_status,
    defaultBidAmount: numberOrNull(row.default_bid_amount),
    currency: row.currency,
    searchMatchEnabled: searchMatchFromRow(row),
    keywordCount: keywordsByAdGroup.get(row.id) ?? 0,
    negativeKeywordCount: negativesByAdGroup.get(row.id) ?? 0,
  }));

  const keywords = (keywordRows ?? []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    adGroupId: row.ad_group_id,
    keywordText: row.keyword_text,
    matchType: row.match_type,
    status: row.status,
    servingStatus: row.serving_status,
    bidAmount: numberOrNull(row.bid_amount),
    currency: row.currency,
  }));

  const negativeKeywords = (negativeRows ?? []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    adGroupId: row.ad_group_id,
    keywordText: row.keyword_text,
    matchType: row.match_type,
    status: row.status,
  }));

  return {
    campaigns,
    adGroups,
    keywords,
    negativeKeywords,
    totals: { campaigns: campaigns.length, adGroups: adGroups.length, keywords: keywords.length, negativeKeywords: negativeKeywords.length },
  };
}
