import { describe, expect, it } from "vitest";
import { completeTotal, summarizePoisSources } from "./summary";

describe("POIS source summaries", () => {
  it("keeps missing and partial measurements unavailable while preserving observed zero", () => {
    expect(completeTotal([])).toBeNull();
    expect(completeTotal([0])).toBe(0);
    expect(completeTotal([2, null])).toBeNull();
  });
  it("limits each source to the selected market and period", () => {
    const result = summarizePoisSources(
      [{ date: "2026-10-25", country: "AU", event: "Impression", page_type: null, source_type: null, count: 4, unique_count: null },
        { date: "2026-10-25", country: "DE", event: "Impression", page_type: null, source_type: null, count: 99, unique_count: null }],
      [{ date: "2026-10-25", country: "AU", downloads: 1, proceeds: null, proceeds_currency: null, source: "appstore_connect_sales" }],
      [{ metric_date: "2026-10-25", country: null, impressions: 72, taps: 2, installs: 1, spend: 0.83, currency: "EUR", source_synced_at: null }],
      "AU", "2026-10-20", "2026-10-25",
    );
    expect(result.impressions).toBe(4);
    expect(result.salesUnits).toBe(1);
    expect(result.adImpressions).toBeNull();
    expect(result.pageViews).toBeNull();
  });
  it("does not include a current incomplete Apple reporting day", () => {
    const rows = ["2026-10-21", "2026-10-22"].map((date) => ({
      date, country: "AU", event: "Impression", page_type: null, source_type: null, count: 1, unique_count: null,
    }));
    expect(summarizePoisSources(rows, [], [], "AU", "2026-10-21", "2026-10-21").impressions).toBe(1);
  });
});
