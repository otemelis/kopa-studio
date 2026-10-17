import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AppleAdsApiV1Provider, type AppleAdsV1Result } from "./apple-ads-v1-provider";

const liveCheckEnabled = process.env.KOPA_APPLE_ADS_V1_LIVE_CHECK === "1";
const safeMetadata = <T>(value: AppleAdsV1Result<T>) => ({
  status: value.status,
  requestedAt: value.requestedAt,
  receivedAt: value.receivedAt,
  requestSha256: value.requestSha256,
  responseSha256: value.responseSha256,
  pagination: value.pagination,
  rateLimit: value.rateLimit,
});

describe.skipIf(!liveCheckEnabled)("Apple Ads v1 read-only live validation", () => {
  it("records authenticated read-only responses and source hashes outside the repository", async () => {
    const api = new AppleAdsApiV1Provider();
    const me = await api.getMe();
    const acls = await api.getAcls();
    const accountId = process.env.APPLE_ADS_V1_AD_ACCOUNT_ID?.trim();
    const selectedAcl = (acls.result.acls as Array<Record<string, unknown>> | undefined)
      ?.find((entry) => String((entry.adAccount as Record<string, unknown> | undefined)?.id) === accountId);
    expect(selectedAcl, "configured ad account must be present in GET /v1/acls").toBeTruthy();
    if (!selectedAcl) throw new Error("Configured ad account was absent from GET /v1/acls.");

    const popularity = await api.querySearchTermPopularity({
      countryOrRegion: "US", genre: "HEALTH_FITNESS", start: "2025-07-13", end: "2026-10-10",
      searchTerms: ["POIS", "post orgasmic illness", "post-orgasmic illness syndrome", "postorgasmic illness syndrome"],
      pageSize: 1000,
    });
    const orgasmicTerms = await api.querySearchTermPopularity({
      countryOrRegion: "US", genre: "HEALTH_FITNESS", start: "2025-07-13", end: "2026-10-10", searchTermContains: "orgasmic", pageSize: 1000,
    });
    const personalityTerms = await api.querySearchTermPopularity({
      countryOrRegion: "US", genre: "HEALTH_FITNESS", start: "2025-07-13", end: "2026-10-10", searchTermContains: "personality", pageSize: 1000,
    });
    const historical = await api.querySearchTermPopularity({
      countryOrRegion: "US", genre: "HEALTH_FITNESS", start: "2025-07-13", end: "2026-10-10",
      searchTerms: ["18 birdies"], weeks: ["2025-07-13", "2026-10-04"], pageSize: 1000,
    });
    const otherCountries = [];
    for (const countryOrRegion of ["DE", "GB"]) {
      otherCountries.push(await api.querySearchTermPopularity({
        countryOrRegion, genre: "HEALTH_FITNESS", start: "2026-10-04", end: "2026-10-10", pageSize: 10,
      }));
    }
    const suggestions = await api.queryKeywordSuggestions({ appAdamId: "6785764991", countriesOrRegions: ["US"], pageSize: 100 });
    const seededSuggestions = await api.queryKeywordSuggestions({
      appAdamId: "6785764991", countriesOrRegions: ["US"], terms: ["personality test", "personality quiz", "personality"], pageSize: 100,
    });

    const output = resolve(process.env.APPLE_ADS_V1_PROBE_OUTPUT ?? "/private/tmp/kopa-apple-ads-v1-live.json");
    const historicalRows = historical.result.rows as Array<Record<string, unknown>>;
    const suggestionRows = suggestions.result as Array<Record<string, unknown>>;
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, JSON.stringify({
      apiBase: "https://api.ads.apple.com/v1",
      account: { orgId: me.result.orgId, adAccountId: accountId, roles: selectedAcl.roles },
      queries: {
        me: safeMetadata(me),
        acls: safeMetadata(acls),
        poisExact: { ...safeMetadata(popularity), rowCount: (popularity.result.rows as unknown[]).length },
        orgasmicContains: { ...safeMetadata(orgasmicTerms), rowCount: (orgasmicTerms.result.rows as unknown[]).length },
        personalityContains: { ...safeMetadata(personalityTerms), rowCount: (personalityTerms.result.rows as unknown[]).length },
        historicalTerm: { ...safeMetadata(historical), rows: historicalRows },
        otherCountries: otherCountries.map((value) => ({ ...safeMetadata(value), rowCount: (value.result.rows as unknown[]).length })),
        appSuggestions: { ...safeMetadata(suggestions), resultCount: suggestionRows.length, firstTen: suggestionRows.slice(0, 10) },
        seededSuggestions: { ...safeMetadata(seededSuggestions), results: seededSuggestions.result },
      },
    }, null, 2), { mode: 0o600 });

    expect(me.status).toBe(200);
    expect(acls.status).toBe(200);
    expect(popularity.status).toBe(200);
    expect(orgasmicTerms.status).toBe(200);
    expect(personalityTerms.status).toBe(200);
    expect(historical.status).toBe(200);
    expect(suggestions.status).toBe(200);
    expect(seededSuggestions.status).toBe(200);
  }, 60_000);
});
