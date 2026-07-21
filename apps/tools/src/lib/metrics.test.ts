import { describe, expect, it } from "vitest";
import { summarizeStorefrontMetrics } from "./metrics";

describe("storefront metric summaries", () => {
  it("groups supported events by app and country", () => {
    expect(summarizeStorefrontMetrics([{ appId: "a", country: "us", event: "impressions", count: 10 }, { appId: "a", country: "us", event: "page_view", count: 4 }, { appId: "a", country: "us", event: "downloads", count: 2 }])).toEqual([{ appId: "a", country: "us", impressions: 10, pageViews: 4, downloads: 2 }]);
  });

  it("normalizes App Store Connect Discovery event labels", () => {
    expect(summarizeStorefrontMetrics([{ appId: "a", country: "gb", event: "Impression", count: 11 }, { appId: "a", country: "gb", event: "Page View", count: 5 }, { appId: "a", country: "gb", event: "Download", count: 1 }])).toEqual([{ appId: "a", country: "gb", impressions: 11, pageViews: 5, downloads: 1 }]);
  });
});
