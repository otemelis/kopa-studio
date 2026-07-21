import { describe, expect, it } from "vitest";
import { formatAppleAdsDeliveryStatus, formatAppleAdsEntityStatus } from "./status";

describe("Apple Ads status formatting", () => {
  it("turns raw delivery states into product language", () => {
    expect(formatAppleAdsDeliveryStatus("RUNNING")).toEqual({ label: "Delivering", tone: "good" });
    expect(formatAppleAdsDeliveryStatus("NOT_RUNNING")).toEqual({ label: "Not delivering", tone: "neutral" });
  });

  it("normalizes entity statuses", () => {
    expect(formatAppleAdsEntityStatus("ACTIVE")).toEqual({ label: "Enabled", tone: "good" });
    expect(formatAppleAdsEntityStatus("ENABLED")).toEqual({ label: "Enabled", tone: "good" });
    expect(formatAppleAdsEntityStatus("PAUSED")).toEqual({ label: "Paused", tone: "bad" });
  });

  it("keeps unknown statuses readable", () => {
    expect(formatAppleAdsEntityStatus(null)).toEqual({ label: "Unknown", tone: "neutral" });
    expect(formatAppleAdsDeliveryStatus("limited_by_budget")).toEqual({ label: "Limited By Budget", tone: "neutral" });
  });
});
