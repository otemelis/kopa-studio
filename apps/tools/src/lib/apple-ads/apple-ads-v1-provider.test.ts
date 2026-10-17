import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAdsApiV1Provider, createAppleAdsClientSecret, type AppleAdsV1Credentials } from "./apple-ads-v1-provider";

const keyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const credentials: AppleAdsV1Credentials = {
  clientId: "SEARCHADS.client",
  teamId: "SEARCHADS.team",
  keyId: "key-123",
  privateKey: keyPair.privateKey.export({ type: "sec1", format: "pem" }).toString(),
};
const store = { getCredentials: async () => credentials };

function decode(segment: string) { return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")); }

describe("AppleAdsApiV1Provider", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("creates Apple's ES256 client-secret claims with a valid key signature", () => {
    const now = 1_800_000_000;
    const token = createAppleAdsClientSecret(credentials, now);
    const [header, claims, signature] = token.split(".");
    expect(decode(header)).toMatchObject({ alg: "ES256", kid: "key-123", typ: "JWT" });
    expect(decode(claims)).toEqual({ sub: credentials.clientId, aud: "https://appleid.apple.com", iat: now, exp: now + 30 * 86400, iss: credentials.teamId });
    expect(verify("SHA256", Buffer.from(`${header}.${claims}`), { key: keyPair.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("uses token auth and keeps /me and /acls unscoped", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "opaque-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { userId: 7, orgId: 9 } }), { status: 200, headers: { "RateLimit-Limit": "100", "RateLimit-Remaining": "98" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { acls: [] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new AppleAdsApiV1Provider(store);
    const me = await api.getMe();
    const acls = await api.getAcls();
    expect(me.result).toEqual({ userId: 7, orgId: 9 });
    expect(me.rateLimit).toMatchObject({ limit: "100", remaining: "98" });
    expect(acls.result).toEqual({ acls: [] });
    for (const [, init] of fetchMock.mock.calls.slice(1) as Array<[string, RequestInit]>) {
      expect(new Headers(init.headers).get("X-AP-Context")).toBeNull();
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer opaque-token");
    }
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain("client_secret=");
  });

  it("scopes popularity and app suggestions to the configured account and sends read-only query bodies", async () => {
    vi.stubEnv("APPLE_ADS_V1_AD_ACCOUNT_ID", "123456");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "opaque-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { rows: [] } }), { status: 200, headers: { "RateLimit-Remaining": "95", "RateLimit-Reset": "20" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [{ text: "personality test", popularity: 76 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new AppleAdsApiV1Provider(store);
    await api.querySearchTermPopularity({ countryOrRegion: "US", genre: "HEALTH_FITNESS", start: "2026-10-04", end: "2026-10-10", searchTerms: ["pois", "post orgasmic illness"] });
    const suggestions = await api.queryKeywordSuggestions({ appAdamId: "6785764991", countriesOrRegions: ["US"], terms: ["personality test"], offset: 25, pageSize: 50 });
    expect(suggestions.result).toEqual([{ text: "personality test", popularity: 76 }]);
    const calls = fetchMock.mock.calls.slice(1) as Array<[string, RequestInit]>;
    expect(calls[0][0]).toBe("https://api.ads.apple.com/v1/insights/apps/search-term-popularity/query");
    expect(calls[1][0]).toBe("https://api.ads.apple.com/v1/suggestions/keywords/query");
    for (const [, init] of calls) {
      expect(init.method).toBe("POST");
      expect(new Headers(init.headers).get("X-AP-Context")).toBe("adAccountId=123456");
      expect(JSON.stringify(init)).not.toMatch(/campaigns|budgets|keywords\/\d/);
    }
    expect(JSON.parse(String(calls[0][1].body))).toMatchObject({
      filters: expect.arrayContaining([
        { field: "countryOrRegion", operator: "EQUALS", value: "US" },
        { field: "genre", operator: "EQUALS", value: "HEALTH_FITNESS" },
        { field: "searchTerm", operator: "IN", value: ["pois", "post orgasmic illness"] },
      ]),
      timeRange: { granularity: "WEEKLY_SUN_SAT", timeZone: "UTC" },
    });
    expect(JSON.parse(String(calls[1][1].body))).toMatchObject({
      filters: expect.arrayContaining([
        { field: "promotedObjectId", operator: "EQUALS", value: ["6785764991"] },
        { field: "promotedObjectType", operator: "EQUALS", value: ["APPSTORE_APP"] },
      ]),
      pagination: { offset: 25, pageSize: 50 },
    });
    expect(JSON.parse(String(calls[0][1].body)).pagination).toEqual({ offset: 0, pageSize: 1000 });
  });

  it("does not make ad-account scoped calls without a numeric account ID", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "opaque-token", expires_in: 3600 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new AppleAdsApiV1Provider(store).queryKeywordSuggestions({ appAdamId: "123" })).rejects.toThrow("APPLE_ADS_V1_AD_ACCOUNT_ID is not configured");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
