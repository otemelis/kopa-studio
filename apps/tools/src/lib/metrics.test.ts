import { describe, expect, it } from "vitest";
import { compareStorefrontWindows, discoveryOpportunities, summarizeStorefrontMetrics } from "./metrics";
import { assessDiscoveryEvidenceSufficiency } from "./discovery-sufficiency";
import type { DiscoveryEvidenceQuality } from "./discovery-quality";

const NOW = new Date("2026-07-31T12:00:00.000Z");
const freshQuality: DiscoveryEvidenceQuality = {
  state: "fresh",
  label: "Fresh",
  explanation: "Verified evidence.",
  parserVersion: "discovery-v2",
  evidenceEnd: "2026-07-28",
};
const request = {
  resultState: "success" as const,
  parserVersion: "discovery-v2",
  evidenceStart: "2026-07-24",
  evidenceEnd: "2026-07-29",
  sourceRowCount: 244,
  importedRowCount: 244,
  rejectedRowCount: 0,
  lastError: null,
};
const freshSufficiency = assessDiscoveryEvidenceSufficiency({
  days: 7,
  requests: [request],
  observedDates: ["2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28"],
  quality: freshQuality,
  totals: { impressions: 1000, pageViews: 30, downloads: 1 },
  now: NOW,
});

describe("storefront metric summaries", () => {
  it("groups supported events by app and country", () => {
    expect(summarizeStorefrontMetrics([{ appId: "a", country: "us", event: "impressions", count: 10 }, { appId: "a", country: "us", event: "page_view", count: 4 }, { appId: "a", country: "us", event: "downloads", count: 2 }])).toEqual([{ appId: "a", country: "us", impressions: 10, pageViews: 4, downloads: 2 }]);
  });

  it("normalizes App Store Connect Discovery event labels", () => {
    expect(summarizeStorefrontMetrics([{ appId: "a", country: "gb", event: "Impression", count: 11 }, { appId: "a", country: "gb", event: "Page View", count: 5 }, { appId: "a", country: "gb", event: "Download", count: 1 }])).toEqual([{ appId: "a", country: "gb", impressions: 11, pageViews: 5, downloads: 1 }]);
  });

  it("compares the latest half of a storefront window against the previous half", () => {
    expect(compareStorefrontWindows([
      { date: "2026-07-01", impressions: 100, pageViews: 10, downloads: 1 },
      { date: "2026-07-02", impressions: 100, pageViews: 10, downloads: 1 },
      { date: "2026-07-03", impressions: 200, pageViews: 20, downloads: 3 },
      { date: "2026-07-04", impressions: 200, pageViews: 30, downloads: 3 },
    ])).toMatchObject({ current: { pageViews: 50 }, previous: { pageViews: 20 }, changes: { pageViews: 1.5 } });
  });

  it("builds Discovery opportunity cards from storefront metrics", () => {
    const opportunities = discoveryOpportunities({
      countries: [{ appId: "a", appName: "InnerType", country: "gb", impressions: 1000, pageViews: 30, downloads: 1, impressionToPageRate: 0.03, downloadRate: 1 / 30 }],
      sourceTypes: [{ sourceType: "App Store Search", impressions: 800, pageViews: 25 }],
      trend: compareStorefrontWindows([{ date: "2026-07-01", impressions: 100, pageViews: 50, downloads: 5 }, { date: "2026-07-02", impressions: 100, pageViews: 20, downloads: 1 }]),
      hasDiscoveryRows: true,
      hasDailyRows: true,
      sufficiency: freshSufficiency,
    });

    expect(opportunities.map((item) => item.title)).toEqual([
      "GB has weak page-view pull",
      "GB page views are not converting",
      "App Store Search is the strongest discovery source",
      "Product page views are down",
    ]);
    expect(opportunities[0]).toMatchObject({ appId: "a", appName: "InnerType", country: "gb" });
    expect(opportunities.map((item) => item.kind)).toEqual([
      "weak_page_view_pull",
      "weak_conversion",
      "strongest_source",
      "page_views_down",
    ]);
  });

  it("labels missing Discovery rows as waiting", () => {
    expect(discoveryOpportunities({ countries: [], sourceTypes: [], trend: compareStorefrontWindows([]), hasDiscoveryRows: false, hasDailyRows: false, sufficiency: freshSufficiency })).toEqual([
      { kind: "waiting_for_report", severity: "waiting", title: "Waiting for Discovery report data", detail: "Retry the Discovery report import after Apple has generated at least one daily segment." },
    ]);
  });

  it("replaces directional conclusions with one waiting state when evidence is partial", () => {
    const partialQuality = { ...freshQuality, state: "partial" as const, label: "Partial", explanation: "One source row was rejected." };
    const partialSufficiency = assessDiscoveryEvidenceSufficiency({
      days: 7,
      requests: [{ ...request, resultState: "partial", importedRowCount: 243, rejectedRowCount: 1 }],
      observedDates: ["2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28"],
      quality: partialQuality,
      totals: { impressions: 1000, pageViews: 30, downloads: 1 },
      now: NOW,
    });
    expect(discoveryOpportunities({
      countries: [{ appId: "a", appName: "InnerType", country: "gb", impressions: 1000, pageViews: 30, downloads: 1, impressionToPageRate: 0.03, downloadRate: 1 / 30 }],
      sourceTypes: [{ sourceType: "App Store Search", impressions: 800, pageViews: 25 }],
      trend: compareStorefrontWindows([{ date: "2026-07-01", impressions: 100, pageViews: 50, downloads: 5 }, { date: "2026-07-02", impressions: 100, pageViews: 20, downloads: 1 }]),
      hasDiscoveryRows: true,
      hasDailyRows: true,
      sufficiency: partialSufficiency,
    })).toEqual([
      { kind: "evidence_not_ready", severity: "waiting", title: "Discovery import is partial", detail: "One source row was rejected." },
    ]);
  });
});
