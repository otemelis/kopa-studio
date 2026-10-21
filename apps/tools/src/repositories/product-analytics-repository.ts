import { readCompletePages } from "@/lib/product-analytics/read-complete-pages";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProductEvent = {
  appId: string;
  environment: string;
  eventName: string;
  anonymousId: string | null;
  sessionId: string | null;
  platform: string | null;
  appVersion: string | null;
  country: string | null;
  occurredAt: string;
  properties: Record<string, unknown>;
};
export type AnalyticsApp = { id: string; name: string };
export type EventCatalogEntry = { appId: string; eventName: string };

type StoredEvent = {
  id: number | string;
  app_id: string;
  environment: string | null;
  event_name: string;
  anonymous_id: string | null;
  session_id: string | null;
  platform: string | null;
  app_version: string | null;
  country: string | null;
  client_event_time: string | null;
  received_at: string;
  properties: unknown;
};

function friendlyName(value: string) {
  return value
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

export async function loadProductEvents(days: number, appId?: string) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const until = new Date().toISOString();
  const client = createAdminClient();
  const data = await readCompletePages<StoredEvent>(async (_offset, last) => {
    let query = client
      .from("events")
      .select(
        "id,app_id,environment,event_name,anonymous_id,session_id,platform,app_version,country,client_event_time,received_at,properties",
        { count: "exact" },
      )
      .gte("received_at", since)
      .lte("received_at", until)
      .order("id", { ascending: true })
      .limit(1000);
    if (appId) query = query.eq("app_id", appId);
    if (last) {
      if (typeof last.id === "number" && !Number.isSafeInteger(last.id))
        throw new Error("Invalid pagination identity.");
      query = query.gt("id", String(last.id));
    }
    const result = await query;
    return { data: result.data, count: result.count, error: result.error };
  });
  const catalogData = await readCompletePages(async (offset) => {
    let query = client
      .from("event_catalog")
      .select("app_id,event_name", { count: "exact" })
      .order("app_id")
      .order("event_name")
      .range(offset, offset + 999);
    if (appId) query = query.eq("app_id", appId);
    const result = await query;
    return { data: result.data, count: result.count, error: result.error };
  }, 5000);
  const events: ProductEvent[] = (data ?? []).map((row) => ({
    appId: row.app_id,
    environment: row.environment ?? "unknown",
    eventName: row.event_name,
    anonymousId: row.anonymous_id,
    sessionId: row.session_id,
    platform: row.platform,
    appVersion: row.app_version,
    country: row.country,
    occurredAt: row.client_event_time ?? row.received_at,
    properties:
      row.properties &&
      typeof row.properties === "object" &&
      !Array.isArray(row.properties)
        ? (row.properties as Record<string, unknown>)
        : {},
  }));
  const catalog: EventCatalogEntry[] = (catalogData ?? []).map((row) => ({
    appId: row.app_id,
    eventName: row.event_name,
  }));
  const appIds = [
    ...new Set([
      ...events.map((event) => event.appId),
      ...catalog.map((entry) => entry.appId),
    ]),
  ].sort();
  const apps = appIds.map((id) => ({ id, name: friendlyName(id) }));
  return { events, apps, catalog, since, until, complete: true as const };
}
