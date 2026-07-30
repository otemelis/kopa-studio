import { describe, expect, it } from "vitest";
import { discoveryEvidenceLabel, discoveryQueryStart, normalizeDiscoveryDays, resolveDiscoveryPeriod } from "./discovery-period";

const NOW = new Date("2026-07-31T12:00:00.000Z");

describe("Discovery period context", () => {
  it.each([
    ["7d", 7, "2026-07-25"],
    ["28d", 28, "2026-07-04"],
    ["90d", 90, "2026-05-03"],
  ])("resolves %s to an inclusive evidence query", (period, days, start) => {
    expect(resolveDiscoveryPeriod(period)).toEqual({ period, days });
    expect(discoveryQueryStart(days, NOW)).toBe(start);
  });

  it("falls back to 28 days for missing or invalid period values", () => {
    expect(resolveDiscoveryPeriod()).toEqual({ period: "28d", days: 28 });
    expect(resolveDiscoveryPeriod("365d")).toEqual({ period: "28d", days: 28 });
    expect(normalizeDiscoveryDays(365)).toBe(28);
  });

  it("labels the selected period and the actual available evidence dates separately", () => {
    expect(discoveryEvidenceLabel(7, { start: "2026-07-26", end: "2026-07-30" }))
      .toBe("App Store Connect Discovery & Engagement, 7-day selected window · 2026-07-26 to 2026-07-30");
    expect(discoveryEvidenceLabel(90, { start: null, end: null }))
      .toContain("90-day selected window · evidence dates unavailable");
  });
});
