import { describe, expect, it } from "vitest";
import { AppleAdsApiV5Provider } from "./apple-ads-provider";
import { createAppleAdsClientSecret, FileAppleAdsV1CredentialStore } from "./apple-ads-v1-provider";

describe.skipIf(process.env.KOPA_APPLE_ADS_V5_LIVE_CHECK !== "1")("Apple Ads campaign read-only access", () => {
  it("uses the validated dedicated key to inspect app IDs without changing campaigns", async () => {
    const credentials = await new FileAppleAdsV1CredentialStore().getCredentials();
    expect(credentials).toBeTruthy();
    if (!credentials) return;
    const provider = new AppleAdsApiV5Provider({ getAppleAdsCredentials: async () => ({
      clientId: credentials.clientId,
      clientSecret: createAppleAdsClientSecret(credentials),
    }) });
    const result = await provider.testConnection();
    expect(result.ok, result.message).toBe(true);
    const orgId = process.env.APPLE_ADS_V5_ORG_ID;
    expect(orgId && result.organizations.some((org) => org.id === orgId)).toBeTruthy();
    if (!orgId) return;
    const campaigns = await provider.listCampaigns(orgId);
    console.info(JSON.stringify({ campaignCount: campaigns.length, apps: [...new Set(campaigns.map((item) => item.adamId))].sort(), poisCampaigns: campaigns.filter((item) => item.adamId === "6820665225").map((item) => ({ id: item.id, status: item.status, countries: item.countriesOrRegions })) }));
    const pois = campaigns.find((item) => item.adamId === "6820665225");
    if (pois) {
      const report = await provider.fetchCampaignReport(orgId, pois.id, "2026-10-19", "2026-10-20");
      const payload = report.raw as { data?: { reportingDataResponse?: { row?: unknown[] } } };
      console.info(JSON.stringify({ poisReportDays: "2026-10-19..2026-10-20", reportRows: payload.data?.reportingDataResponse?.row?.length ?? null }));
    }
  });
});
