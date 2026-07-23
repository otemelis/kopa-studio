import { createAdminClient } from "@/lib/supabase/admin";

export type ProductEvent = { appId: string; environment: string; eventName: string; anonymousId: string | null; sessionId: string | null; platform: string | null; appVersion: string | null; country: string | null; occurredAt: string; properties: Record<string, unknown> };
export type AnalyticsApp = { id: string; name: string };
export type EventCatalogEntry = { appId: string; eventName: string };

function friendlyName(value: string) { return value.split("_").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" "); }

export async function loadProductEvents(days: number, appId?: string) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  let query = createAdminClient().from("events").select("app_id,environment,event_name,anonymous_id,session_id,platform,app_version,country,client_event_time,received_at,properties").gte("received_at", since).order("received_at", { ascending: false }).limit(50_000);
  let catalogQuery = createAdminClient().from("event_catalog").select("app_id,event_name").limit(5_000);
  if (appId) query = query.eq("app_id", appId);
  if (appId) catalogQuery = catalogQuery.eq("app_id", appId);
  const [{ data, error }, { data: catalogData }] = await Promise.all([query, catalogQuery]);
  if (error) throw new Error("Could not read product event analytics.");
  const events: ProductEvent[] = (data ?? []).map((row) => ({ appId: row.app_id, environment: row.environment ?? "prod", eventName: row.event_name, anonymousId: row.anonymous_id, sessionId: row.session_id, platform: row.platform, appVersion: row.app_version, country: row.country, occurredAt: row.client_event_time ?? row.received_at, properties: (row.properties && typeof row.properties === "object" && !Array.isArray(row.properties)) ? row.properties as Record<string, unknown> : {} }));
  const catalog: EventCatalogEntry[] = (catalogData ?? []).map((row) => ({ appId: row.app_id, eventName: row.event_name }));
  const appIds = [...new Set([...events.map((event) => event.appId), ...catalog.map((entry) => entry.appId)])].sort();
  const apps = appIds.map((id) => ({ id, name: friendlyName(id) }));
  return { events, apps, catalog, since };
}
