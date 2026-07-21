import { describe, expect, it } from "vitest";
import { summarizeStorefrontMetrics } from "./metrics";

describe("storefront metric summaries", () => {
  it("groups supported events by app and country", () => {
    expect(summarizeStorefrontMetrics([{ appId: "a", country: "us", event: "impressions", count: 10 }, { appId: "a", country: "us", event: "page_view", count: 4 }, { appId: "a", country: "us", event: "downloads", count: 2 }])).toEqual([{ appId: "a", country: "us", impressions: 10, pageViews: 4, downloads: 2 }]);
  });
});
