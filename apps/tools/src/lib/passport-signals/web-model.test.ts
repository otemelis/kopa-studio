import { describe, expect, it } from "vitest";
import { summarizePassportWebEvents } from "./web-model";
import type { PassportWebEvent } from "./web-events";

const event = (id: number, name: string, visit: string, at: string, properties: Record<string, unknown> = {}): PassportWebEvent => ({
  id, event_name: name, anonymous_id: visit, session_id: visit,
  client_event_time: at, received_at: at, properties,
});

describe("PASSPORT website event measurements", () => {
  it("counts temporary visits separately from page views and App Store taps", () => {
    const report = summarizePassportWebEvents([
      event(1, "page_view", "visit-a", "2026-11-06T10:00:00Z", { path: "/", referrer: "direct" }),
      event(2, "page_view", "visit-a", "2026-11-06T10:01:00Z", { path: "/prints", referrer: "internal" }),
      event(3, "app_store_tap", "visit-a", "2026-11-06T10:02:00Z"),
      event(4, "app_store_tap", "visit-a", "2026-11-06T10:03:00Z"),
      event(5, "page_view", "visit-b", "2026-11-06T11:00:00Z", { path: "/", referrer: "example.com" }),
      event(6, "prints_preview", "visit-b", "2026-11-06T11:01:00Z"),
    ]);
    expect(report).toMatchObject({ visits: 2, pageViews: 3, appStoreTapVisits: 1, appStoreTaps: 2, printsPreviews: 1 });
    expect(report.daily).toEqual([{ date: "2026-11-06", views: 3, visits: 2 }]);
    expect(report.referrers).toEqual([{ label: "direct", value: 1 }, { label: "example.com", value: 1 }]);
  });

  it("returns observed zero only when an available source supplied events", () => {
    expect(summarizePassportWebEvents([])).toMatchObject({ visits: 0, pageViews: 0, daily: [] });
  });
});
