import { getAppleAdsConfiguration } from "@/lib/apple-ads/config";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppleAdsAttributionApp = { id: string; name: string; bundleId: string | null; eventCount: number; latestReceivedAt: string | null };
export type AppleAdsAttributionEvent = { id: string; appName: string; receivedAt: string; attributionState: string | null; campaignId: string | null; adGroupId: string | null; keywordId: string | null };
export type AppleAdsAttributionStatus = {
  endpointUrl: string;
  endpointConfigured: boolean;
  secretConfigured: boolean;
  mappedAppCount: number;
  eventCount: number;
  latestReceivedAt: string | null;
  appIntegrationState: "not_installed" | "receiving" | "ready_for_test";
  apps: AppleAdsAttributionApp[];
  recentEvents: AppleAdsAttributionEvent[];
};

export async function getAppleAdsAttributionStatus(ownerUserId: string): Promise<AppleAdsAttributionStatus> {
  const db = createAdminClient();
  const config = getAppleAdsConfiguration();
  const { data: connections, error: connectionError } = await db.from("apple_ads_connections").select("id").eq("owner_user_id", ownerUserId);
  if (connectionError) throw new Error("Could not read Apple Ads connections.");
  const connectionIds = (connections ?? []).map((connection) => connection.id);

  const { data: mappings, error: mappingError } = connectionIds.length ? await db.from("apple_ads_app_mappings").select("app_id").in("connection_id", connectionIds) : { data: [], error: null };
  if (mappingError) throw new Error("Could not read Apple Ads app mappings.");
  const appIds = [...new Set((mappings ?? []).map((mapping) => mapping.app_id))];

  const { data: apps, error: appError } = appIds.length ? await db.from("aso_apps").select("id,name,bundle_id").in("id", appIds).order("name") : { data: [], error: null };
  if (appError) throw new Error("Could not read mapped apps.");

  const { data: events, error: eventError } = appIds.length ? await db.from("apple_ads_attribution").select("id,app_id,received_at,attribution_state,campaign_id,ad_group_id,keyword_id").in("app_id", appIds).order("received_at", { ascending: false }).limit(500) : { data: [], error: null };
  if (eventError) throw new Error("Could not read Apple Ads attribution events.");

  const eventsByApp = new Map<string, { count: number; latest: string | null }>();
  for (const event of events ?? []) {
    const current = eventsByApp.get(event.app_id) ?? { count: 0, latest: null };
    eventsByApp.set(event.app_id, { count: current.count + 1, latest: current.latest ?? event.received_at });
  }

  const appNames = new Map((apps ?? []).map((app) => [app.id, app.name]));
  const mappedApps = (apps ?? []).map((app) => ({ id: app.id, name: app.name, bundleId: app.bundle_id, eventCount: eventsByApp.get(app.id)?.count ?? 0, latestReceivedAt: eventsByApp.get(app.id)?.latest ?? null }));

  return {
    endpointUrl: "https://tools.kopa.studio/api/apple-ads/attribution",
    endpointConfigured: true,
    secretConfigured: config.attributionSecretConfigured,
    mappedAppCount: mappedApps.length,
    eventCount: events?.length ?? 0,
    latestReceivedAt: events?.[0]?.received_at ?? null,
    appIntegrationState: (events?.length ?? 0) > 0 ? "receiving" : mappedApps.length && config.attributionSecretConfigured ? "ready_for_test" : "not_installed",
    apps: mappedApps,
    recentEvents: (events ?? []).slice(0, 25).map((event) => ({ id: event.id, appName: appNames.get(event.app_id) ?? "Mapped app", receivedAt: event.received_at, attributionState: event.attribution_state, campaignId: event.campaign_id, adGroupId: event.ad_group_id, keywordId: event.keyword_id })),
  };
}
