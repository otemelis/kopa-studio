import { AppleAdsApiV5Provider } from "@/lib/apple-ads/apple-ads-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncAppleAdsCampaigns(connectionId: string, appleAdsOrgId: string) {
  const db = createAdminClient(); const campaigns = await new AppleAdsApiV5Provider().listCampaigns(appleAdsOrgId);
  const { data: mappings, error: mappingError } = await db.from("apple_ads_app_mappings").select("app_id,adam_id").eq("connection_id", connectionId);
  if (mappingError) throw new Error("Could not read Apple Ads app mappings.");
  const apps = new Map((mappings ?? []).map((mapping) => [mapping.adam_id, mapping.app_id])); const now = new Date().toISOString();
  const rows = campaigns.map((campaign) => ({ connection_id: connectionId, app_id: apps.get(campaign.adamId) ?? null, apple_campaign_id: campaign.id, adam_id: campaign.adamId, name: campaign.name, status: campaign.status, serving_status: campaign.servingStatus, bidding_strategy: campaign.biddingStrategy, daily_budget_amount: campaign.dailyBudgetAmount, currency: campaign.currency, countries_or_regions: campaign.countriesOrRegions, start_time: campaign.startTime, end_time: campaign.endTime, source_modified_at: campaign.modificationTime, source_synced_at: now, is_deleted: campaign.deleted, raw_payload: campaign.rawPayload, updated_at: now }));
  if (rows.length) { const { error } = await db.from("apple_ads_campaigns").upsert(rows, { onConflict: "connection_id,apple_campaign_id" }); if (error) throw new Error("Could not save Apple Ads campaigns."); }
  await db.from("apple_ads_connections").update({ last_api_success_at: now, last_full_sync_at: now, status: "healthy", updated_at: now }).eq("id", connectionId);
  return { campaigns: rows.length, unmappedCampaigns: rows.filter((row) => !row.app_id).length };
}
