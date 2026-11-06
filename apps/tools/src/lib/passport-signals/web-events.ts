import "server-only";
import { readCompletePages } from "@/lib/product-analytics/read-complete-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { passportWindow } from "./source";

export type PassportWebEvent = {
  id: number;
  event_name: string;
  anonymous_id: string | null;
  session_id: string | null;
  client_event_time: string | null;
  received_at: string;
  properties: Record<string, unknown> | null;
};

export type PassportWebEventsResult =
  | { available: true; events: PassportWebEvent[]; developmentRows: number; queriedAt: string }
  | { available: false; reason: string };

export async function readPassportWebEvents(days: 7 | 28): Promise<PassportWebEventsResult> {
  const { start } = passportWindow(days);
  const since = `${start}T00:00:00.000Z`;
  const until = new Date().toISOString();
  try {
    const client = createAdminClient();
    const events = await readCompletePages<PassportWebEvent>(async (offset) => {
      const result = await client.from("events")
        .select("id,event_name,anonymous_id,session_id,client_event_time,received_at,properties", { count: "exact" })
        .eq("app_id", "passport-web").eq("environment", "prod")
        .gte("client_event_time", since).lte("client_event_time", until)
        .order("id", { ascending: true }).range(offset, offset + 999);
      return { data: result.data, count: result.count, error: result.error };
    });
    const dev = await client.from("events").select("id", { count: "exact", head: true })
      .eq("app_id", "passport-web").eq("environment", "dev")
      .gte("client_event_time", since).lte("client_event_time", until);
    if (dev.error || dev.count === null) throw new Error("Development coverage unavailable");
    return { available: true, events, developmentRows: dev.count, queriedAt: new Date().toISOString() };
  } catch {
    return { available: false, reason: "Supabase passport-web could not be read completely; no partial or sample metrics were substituted." };
  }
}
