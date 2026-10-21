import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: [] as Record<string, unknown>[],
  fetchCampaignReport: vi.fn(),
}));

vi.mock("@/lib/apple-ads/apple-ads-provider", () => ({
  AppleAdsApiV5Provider: class {
    fetchCampaignReport = mocks.fetchCampaignReport;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        limit: () => query,
        maybeSingle: async () => ({
          data: table === "apple_ads_campaigns" ? { app_id: "pois-app" } : null,
          error: null,
        }),
        insert: async (row: Record<string, unknown>) => {
          mocks.saved.push(row);
          return { error: null };
        },
      };
      return query;
    },
  }),
}));

import { syncCampaignReport } from "./apple-ads-report-sync-service";

it("stores the mapped campaign app on daily Apple Ads rows", async () => {
  mocks.saved.length = 0;
  mocks.fetchCampaignReport.mockResolvedValue({ raw: {
    reportingDataResponse: { row: [{
      metadata: { countryOrRegion: "AU" },
      granularity: [{ date: "2026-10-20", total: {
        impressions: 4, taps: 1, installs: 0,
        localSpend: { amount: "0.40", currency: "AUD" },
      } }],
    }] },
  } });

  const result = await syncCampaignReport({
    connectionId: "connection", organizationId: "organization",
    campaignId: "apple-campaign", campaignRowId: "campaign-row",
    startDate: "2026-10-20", endDate: "2026-10-20",
  });

  expect(result.rows).toBe(1);
  expect(mocks.saved).toMatchObject([{ app_id: "pois-app", campaign_id: "campaign-row", country: "au", impressions: 4 }]);
});
