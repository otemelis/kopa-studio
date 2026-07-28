import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAdsApiV5Provider, mapAppleAdsAdGroup, safeMessage } from "./apple-ads-provider";
import type { CredentialStore } from "./credential-store";
import liveSearchMatchAdGroup from "./fixtures/apple-ads-v5-ad-group-search-match-live.json";

const credentials: CredentialStore = { getAppleAdsCredentials: async () => ({ clientId: "SEARCHADS.test", clientSecret: "secret-never-exposed" }) };

describe("AppleAdsApiV5Provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses server credentials to discover organizations without returning a token", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "private-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ orgId: 42, orgName: "Kopa Ads" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await new AppleAdsApiV5Provider(credentials).testConnection();
    expect(result).toEqual({ ok: true, message: "OAuth succeeded. 1 accessible organization found.", organizations: [{ id: "42", name: "Kopa Ads", currency: undefined, timezone: undefined }] });
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(JSON.stringify(result)).not.toContain("secret-never-exposed");
  });

  it("maps API v5 automatedKeywordsOptIn to Search Match from the raw ad-group payload", () => {
    const result = mapAppleAdsAdGroup(liveSearchMatchAdGroup, String(liveSearchMatchAdGroup.campaignId));
    expect(result.searchMatchEnabled).toBe(true);
    expect(result.rawPayload).toBe(liveSearchMatchAdGroup);
  });

  it("accepts string automatedKeywordsOptIn values without inferring from name or keyword count", () => {
    const result = mapAppleAdsAdGroup({ id: 1, name: "Discovery Search Match", automatedKeywordsOptIn: "false" }, "2");
    expect(result.searchMatchEnabled).toBe(false);
  });

  it("keeps Apple Ads structured request errors readable", () => {
    expect(safeMessage(400, { error: { code: "INVALID_REQUEST", message: "The report date range is invalid." } }))
      .toBe("INVALID_REQUEST: The report date range is invalid.");
    expect(safeMessage(400, { errors: [{ code: "INVALID_FIELD", message: "Unsupported selector field." }] }))
      .toBe("INVALID_FIELD: Unsupported selector field.");
    expect(safeMessage(400, { error: { errors: [{ code: "DATE_RANGE", message: "The end date is unavailable." }] } }))
      .toBe("DATE_RANGE: The end date is unavailable.");
  });

  it("includes the required report ordering for campaign reports", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { reportingDataResponse: { row: [] } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await new AppleAdsApiV5Provider(credentials).fetchCampaignReport("42", "99", "2026-07-20", "2026-07-26");

    const [, options] = fetch.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({
      selector: { orderBy: [{ field: "impressions", sortOrder: "DESCENDING" }] },
    });
  });
});
