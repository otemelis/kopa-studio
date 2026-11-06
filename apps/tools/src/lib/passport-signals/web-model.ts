import type { PassportWebEvent } from "./web-events";

const textProperty = (event: PassportWebEvent, key: string) => {
  const value = event.properties?.[key];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
};
const visitId = (event: PassportWebEvent) => event.session_id ?? event.anonymous_id;
const occurredAt = (event: PassportWebEvent) => event.client_event_time ?? event.received_at;

export function summarizePassportWebEvents(events: PassportWebEvent[]) {
  const pages = events.filter((event) => event.event_name === "page_view");
  const taps = events.filter((event) => event.event_name === "app_store_tap");
  const orderedPages = [...pages].sort((a, b) => occurredAt(a).localeCompare(occurredAt(b)) || a.id - b.id);
  const firstPage = new Map<string, PassportWebEvent>();
  for (const page of orderedPages) {
    const id = visitId(page);
    if (id && !firstPage.has(id)) firstPage.set(id, page);
  }
  const breakdown = (rows: PassportWebEvent[], key: string) => {
    const counts = new Map<string, number>();
    for (const event of rows) {
      const label = textProperty(event, key) ?? "Unspecified";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts].map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 10);
  };
  const days = new Map<string, { views: number; visits: Set<string> }>();
  for (const page of pages) {
    const date = occurredAt(page).slice(0, 10);
    if (!days.has(date)) days.set(date, { views: 0, visits: new Set() });
    const day = days.get(date)!;
    day.views++;
    const id = visitId(page);
    if (id) day.visits.add(id);
  }
  const total = (name: string) => events.filter((event) => event.event_name === name).length;
  return {
    visits: firstPage.size,
    pageViews: pages.length,
    appStoreTapVisits: new Set(taps.map(visitId).filter(Boolean)).size,
    appStoreTaps: taps.length,
    ctaClicks: total("cta_click"),
    toolStarts: total("tool_started"),
    toolSentToApp: total("tool_sent_to_app"),
    importLinksOpened: total("import_link_opened"),
    printsPreviews: total("prints_preview"),
    latestReceived: events.reduce<string | null>((last, row) => !last || row.received_at > last ? row.received_at : last, null),
    daily: [...days].map(([date, value]) => ({ date, views: value.views, visits: value.visits.size }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    paths: breakdown(pages, "path"),
    referrers: breakdown([...firstPage.values()], "referrer"),
  };
}
