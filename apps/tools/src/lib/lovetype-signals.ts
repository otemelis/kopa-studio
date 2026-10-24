import { readCompletePages } from "@/lib/product-analytics/read-complete-pages";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoveTypeEvent = {
  id: number;
  app_id: string;
  event_name: string;
  anonymous_id: string | null;
  session_id: string | null;
  client_event_time: string | null;
  received_at: string;
  properties: Record<string, unknown> | null;
};

export type SourceResult = { events: LoveTypeEvent[]; available: true } | { events: []; available: false };

// The two sources are queried independently so an outage on one never becomes a zero on the other.
export async function readLoveTypeSource(appId: "lovetype" | "lovetype-web", days: number): Promise<SourceResult> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const until = new Date().toISOString();
  try {
    const client = createAdminClient();
    const events = await readCompletePages<LoveTypeEvent>(async (offset) => {
      const result = await client.from("events")
        .select("id,app_id,event_name,anonymous_id,session_id,client_event_time,received_at,properties", { count: "exact" })
        .eq("app_id", appId).eq("environment", "prod")
        .gte("client_event_time", since).lte("client_event_time", until)
        .order("id", { ascending: true }).range(offset, offset + 999);
      return { data: result.data, count: result.count, error: result.error };
    });
    return { events, available: true };
  } catch {
    return { events: [], available: false };
  }
}

function stringProperty(event: LoveTypeEvent, key: string): string | null {
  const value = event.properties?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function realPaywallEvent(event: LoveTypeEvent) {
  return event.properties?.is_mock !== true && event.properties?.is_preview !== true;
}

function fingerprint(event: LoveTypeEvent): string {
  // The current collector has no source event ID. Exact repeats are likely replayed batches.
  return JSON.stringify([event.app_id, event.event_name, event.anonymous_id, event.session_id,
    event.client_event_time, event.properties]);
}

export function uniqueEvents(events: LoveTypeEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = fingerprint(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function distinctIds(events: LoveTypeEvent[], name?: string): number {
  return new Set(events.filter((event) => !name || event.event_name === name)
    .map((event) => event.anonymous_id).filter(Boolean)).size;
}

function breakdown(events: LoveTypeEvent[], key: string, name: string) {
  const groups = new Map<string, Set<string>>();
  for (const event of events.filter((row) => row.event_name === name && row.anonymous_id)) {
    const value = stringProperty(event, key) ?? "Unspecified";
    if (!groups.has(value)) groups.set(value, new Set());
    groups.get(value)!.add(event.anonymous_id!);
  }
  return [...groups].map(([label, ids]) => ({ label, count: ids.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function byDay(events: LoveTypeEvent[], name: string, distinct: boolean) {
  const daily = new Map<string, Set<string> | number>();
  for (const event of events.filter((row) => row.event_name === name)) {
    const date = event.client_event_time?.slice(0, 10);
    if (!date) continue;
    if (distinct) {
      if (!event.anonymous_id) continue;
      if (!daily.has(date)) daily.set(date, new Set<string>());
      (daily.get(date) as Set<string>).add(event.anonymous_id);
    } else daily.set(date, (daily.get(date) as number | undefined ?? 0) + 1);
  }
  return [...daily].map(([date, value]) => ({ date, value: typeof value === "number" ? value : value.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function countLandingValues(events: LoveTypeEvent[], key: string) {
  const firstByVisit = new Map<string, LoveTypeEvent>();
  for (const event of events) {
    const id = event.session_id ?? event.anonymous_id;
    if (id && !firstByVisit.has(id)) firstByVisit.set(id, event);
  }
  const counts = new Map<string, number>();
  for (const event of firstByVisit.values()) {
    const value = stringProperty(event, key);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeLoveType(appSource: SourceResult, webSource: SourceResult) {
  const app = uniqueEvents(appSource.events);
  const web = uniqueEvents(webSource.events);
  const paywall = app.filter(realPaywallEvent);
  const paywallViews = paywall.filter((event) => event.event_name === "paywall_viewed");
  const paywallTaps = paywall.filter((event) => event.event_name === "premium_unlock_tapped");
  const paywallPurchases = paywall.filter((event) => event.event_name === "purchase_completed");
  const viewIds = new Set(paywallViews.map((event) => stringProperty(event, "paywall_view_id")).filter(Boolean));
  const tappedViewIds = new Set(paywallTaps.map((event) => stringProperty(event, "paywall_view_id")).filter((id) => id && viewIds.has(id)));
  const pageViews = web.filter((event) => event.event_name === "page_view");
  // Some deployed website rows omit page_index despite the site notes. The earliest
  // observed page for a visit is the reproducible entry point in either schema.
  const firstPageByVisit = new Map<string, LoveTypeEvent>();
  for (const event of [...pageViews].sort((a, b) =>
    (a.client_event_time ?? a.received_at).localeCompare(b.client_event_time ?? b.received_at) || a.id - b.id)) {
    const visitId = event.session_id ?? event.anonymous_id;
    if (visitId && !firstPageByVisit.has(visitId)) firstPageByVisit.set(visitId, event);
  }
  const firstPages = [...firstPageByVisit.values()];
  const visitIds = new Set(pageViews
    .map((event) => event.session_id ?? event.anonymous_id).filter(Boolean));
  const tapVisitIds = new Set(web.filter((event) => event.event_name === "app_store_tap")
    .map((event) => event.session_id ?? event.anonymous_id).filter(Boolean));
  const appIds = new Set(app.map((event) => event.anonymous_id).filter(Boolean));
  const appSources = breakdown(app.filter((event) => event.event_name === "onboarding_started"), "source", "onboarding_started");
  const last = (events: LoveTypeEvent[]) => events.reduce<string | null>((latest, event) =>
    !latest || event.received_at > latest ? event.received_at : latest, null);
  return {
    app: {
      available: appSource.available, rawRows: appSource.events.length,
      exactCopies: appSource.events.length - app.length, lastReceived: last(appSource.events),
      firstObserved: app.reduce<string | null>((first, e) => !first || (e.client_event_time && e.client_event_time < first) ? e.client_event_time : first, null),
      activeInstallations: appIds.size,
      onboardingStarts: distinctIds(app, "onboarding_started"),
      onboardingCompletions: distinctIds(app, "onboarding_completed"),
      testStarts: distinctIds(app, "test_started"),
      testCompletions: distinctIds(app, "test_completed"),
      paywallViews: distinctIds(paywallViews),
      purchaseTaps: distinctIds(paywallTaps),
      clientPurchases: distinctIds(paywallPurchases),
      matchedPaywallViews: viewIds.size, matchedPaywallTaps: tappedViewIds.size,
      paywallEntryPoints: breakdown(paywallViews, "entry_point", "paywall_viewed"),
      purchaseTriggerTests: breakdown(paywallPurchases, "trigger_test_id", "purchase_completed"),
      testTypes: [...new Set(app.filter((e) => e.event_name === "test_started" || e.event_name === "test_completed")
        .map((e) => stringProperty(e, "test_type") ?? "Unspecified"))].map((label) => ({
          label,
          starts: new Set(app.filter((e) => e.event_name === "test_started" && (stringProperty(e, "test_type") ?? "Unspecified") === label).map((e) => e.anonymous_id).filter(Boolean)).size,
          completions: new Set(app.filter((e) => e.event_name === "test_completed" && (stringProperty(e, "test_type") ?? "Unspecified") === label).map((e) => e.anonymous_id).filter(Boolean)).size,
        })).sort((a, b) => a.label.localeCompare(b.label)),
      sources: appSources, dailyStarts: byDay(app, "onboarding_started", true),
      paywallContextCount: paywallViews.filter((e) => stringProperty(e, "paywall_view_id")).length,
    },
    web: {
      available: webSource.available, rawRows: webSource.events.length,
      exactCopies: webSource.events.length - web.length, lastReceived: last(webSource.events),
      firstObserved: web.reduce<string | null>((first, e) => !first || (e.client_event_time && e.client_event_time < first) ? e.client_event_time : first, null),
      visits: visitIds.size, pageViews: pageViews.length,
      firstPagesWithoutIndex: firstPages.filter((event) => event.properties?.page_index == null).length,
      tapVisits: tapVisitIds.size, taps: web.filter((e) => e.event_name === "app_store_tap").length,
      compareCodeVisits: distinctIds(web, "compare_code_decoded"),
      pairPickerVisits: distinctIds(web, "pair_picked"),
      starterCopyVisits: distinctIds(web, "starter_line_copied"),
      paths: breakdown(web, "path", "page_view"),
      referrers: countLandingValues(firstPages, "referrer"),
      utmSources: countLandingValues(firstPages, "utm_source"),
      campaigns: countLandingValues(firstPages, "utm_campaign"),
      ctas: breakdown(web, "cta", "app_store_tap"),
      dailyVisits: byDay(firstPages, "page_view", true),
    },
  };
}
