import { AppleAdsApiV5Provider } from "@/lib/apple-ads/apple-ads-provider";
import { createAdminClient } from "@/lib/supabase/admin";

const normalize = (value: string) => value.trim().toLocaleLowerCase();

/** Read-only nested structure import. Called only by a queued worker after campaign sync. */
export async function syncAppleAdsStructure(connectionId: string, organizationId: string) {
  const db = createAdminClient(); const provider = new AppleAdsApiV5Provider(); const now = new Date().toISOString();
  const { data: campaigns, error } = await db.from("apple_ads_campaigns").select("id,apple_campaign_id").eq("connection_id", connectionId).eq("is_deleted", false);
  if (error) throw new Error("Could not read synced Apple Ads campaigns.");
  let adGroupCount = 0; let keywordCount = 0; let negativeCount = 0;
  for (const campaign of campaigns ?? []) {
    const adGroups = await provider.listAdGroups(organizationId, campaign.apple_campaign_id);
    const groupRows = adGroups.map((group) => ({ connection_id: connectionId, campaign_id: campaign.id, apple_ad_group_id: group.id, name: group.name, status: group.status, serving_status: group.servingStatus, default_bid_amount: group.defaultBidAmount, currency: group.currency, search_match_enabled: group.searchMatchEnabled, source_modified_at: group.modificationTime, source_synced_at: now, is_deleted: group.deleted, raw_payload: group.rawPayload, updated_at: now }));
    if (groupRows.length) { const { error: groupError } = await db.from("apple_ads_ad_groups").upsert(groupRows, { onConflict: "connection_id,apple_ad_group_id" }); if (groupError) throw new Error("Could not save Apple Ads ad groups."); }
    adGroupCount += groupRows.length;
    const { data: storedGroups, error: storedError } = await db.from("apple_ads_ad_groups").select("id,apple_ad_group_id").eq("connection_id", connectionId).eq("campaign_id", campaign.id);
    if (storedError) throw new Error("Could not read saved Apple Ads ad groups.");
    for (const group of storedGroups ?? []) {
      const [keywords, negatives] = await Promise.all([provider.listKeywords(organizationId, campaign.apple_campaign_id, group.apple_ad_group_id), provider.listNegativeKeywords(organizationId, campaign.apple_campaign_id, group.apple_ad_group_id)]);
      const keywordRows = keywords.map((keyword) => ({ connection_id: connectionId, campaign_id: campaign.id, ad_group_id: group.id, apple_keyword_id: keyword.id, keyword_text: keyword.text, normalized_keyword: normalize(keyword.text), match_type: keyword.matchType, status: keyword.status, serving_status: keyword.servingStatus, bid_amount: keyword.bidAmount, currency: keyword.currency, source_modified_at: keyword.modificationTime, source_synced_at: now, is_deleted: keyword.deleted, raw_payload: keyword.rawPayload, updated_at: now }));
      const negativeRows = negatives.map((keyword) => ({ connection_id: connectionId, campaign_id: campaign.id, ad_group_id: group.id, apple_negative_keyword_id: keyword.id, keyword_text: keyword.text, normalized_keyword: normalize(keyword.text), match_type: keyword.matchType, status: keyword.status, source_modified_at: keyword.modificationTime, source_synced_at: now, is_deleted: keyword.deleted, raw_payload: keyword.rawPayload, updated_at: now }));
      if (keywordRows.length) { const { error: keywordError } = await db.from("apple_ads_keywords").upsert(keywordRows, { onConflict: "connection_id,apple_keyword_id" }); if (keywordError) throw new Error("Could not save Apple Ads keywords."); }
      if (negativeRows.length) { const { error: negativeError } = await db.from("apple_ads_negative_keywords").upsert(negativeRows, { onConflict: "connection_id,apple_negative_keyword_id" }); if (negativeError) throw new Error("Could not save Apple Ads negative keywords."); }
      keywordCount += keywordRows.length; negativeCount += negativeRows.length;
    }
  }
  return { adGroups: adGroupCount, keywords: keywordCount, negativeKeywords: negativeCount };
}
