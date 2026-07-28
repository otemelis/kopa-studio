import { expect, it } from "vitest";
import { dailyCampaignMetrics } from "./reporting";

it("reads Apple daily metrics when granularity rows hold metrics directly", () => {
  expect(dailyCampaignMetrics({
    data: { reportingDataResponse: { row: [{ granularity: [{
      date: "2026-07-26",
      impressions: 36,
      taps: 1,
      totalInstalls: 0,
      localSpend: { amount: "0.5857", currency: "EUR" },
    }] }] } },
  })).toMatchObject([{ date: "2026-07-26", impressions: 36, taps: 1, installs: 0, spend: 0.5857, currency: "EUR" }]);
});
