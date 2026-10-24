import { describe, expect, it } from "vitest";
import { summarizeLoveType, type LoveTypeEvent, type SourceResult } from "./lovetype-signals";

const at = "2026-10-24T10:00:00.000Z";
function event(id: number, app_id: string, event_name: string, anonymous_id: string, properties: Record<string, unknown> = {}): LoveTypeEvent {
  return { id, app_id, event_name, anonymous_id, session_id: app_id === "lovetype-web" ? anonymous_id : "session-1",
    client_event_time: at, received_at: at, properties };
}
function source(events: LoveTypeEvent[]): SourceResult { return { available: true, events }; }

describe("LoveType live source contract", () => {
  it("counts installations and visits separately and removes exact replays", () => {
    const started = event(1, "lovetype", "onboarding_started", "installation-1", { source: "unknown" });
    const report = summarizeLoveType(source([started, { ...started, id: 2 }, event(3, "lovetype", "test_started", "installation-1", { test_type: "attachment" })]),
      source([event(4, "lovetype-web", "page_view", "visit-1", { page_index: 1, referrer: "direct" }),
        event(5, "lovetype-web", "app_store_tap", "visit-1", { cta: "hero" })]));
    expect(report.app).toMatchObject({ activeInstallations: 1, onboardingStarts: 1, testStarts: 1, exactCopies: 1 });
    expect(report.web).toMatchObject({ visits: 1, pageViews: 1, tapVisits: 1, taps: 1 });
    expect(report.web.referrers).toEqual([{ label: "direct", count: 1 }]);
  });

  it("keeps unavailable distinct from observed zero, and excludes dev rows upstream", () => {
    const report = summarizeLoveType({ available: false, events: [] }, source([event(1, "lovetype-web", "page_view", "visit-1", { page_index: 1 })]));
    expect(report.app.available).toBe(false);
    expect(report.web.available).toBe(true);
    expect(report.web.tapVisits).toBe(0);
    expect(report.web.visits).toBe(1);
  });

  it("requires a matching paywall view ID for the tap rate and excludes mock or preview attempts", () => {
    const report = summarizeLoveType(source([
      event(1, "lovetype", "paywall_viewed", "installation-1", { paywall_view_id: "view-1", entry_point: "first_reveal" }),
      event(2, "lovetype", "premium_unlock_tapped", "installation-1", { paywall_view_id: "view-1" }),
      event(3, "lovetype", "purchase_completed", "installation-1", { paywall_view_id: "view-1", is_mock: true }),
      event(4, "lovetype", "paywall_viewed", "installation-2", { paywall_view_id: "view-2", is_preview: true }),
    ]), source([]));
    expect(report.app).toMatchObject({ matchedPaywallViews: 1, matchedPaywallTaps: 1, clientPurchases: 0 });
    expect(report.app.paywallEntryPoints).toEqual([{ label: "first_reveal", count: 1 }]);
  });
});
