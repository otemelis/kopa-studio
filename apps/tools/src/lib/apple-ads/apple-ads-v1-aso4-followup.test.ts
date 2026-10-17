import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AppleAdsApiV1Provider } from "./apple-ads-v1-provider";

const enabled = process.env.KOPA_APPLE_ADS_V1_ASO4_LIVE_EVAL === "1";

describe.skipIf(!enabled)("Apple Ads v1 ASO-4 targeted follow-up", () => {
  it("checks IN semantics and localized candidate coverage", async () => {
    const api = new AppleAdsApiV1Provider();
    const observations: unknown[] = [];
    const queries = [
      { name: "in_single_passport", country: "US", genre: "TRAVEL", terms: ["passport"] },
      { name: "in_two_passport_terms", country: "US", genre: "TRAVEL", terms: ["passport", "passport parking"] },
      { name: "de_reisepass", country: "DE", genre: "TRAVEL", filter: { operator: "EQUALS" as const, value: "reisepass" } },
      { name: "de_reisepass_renewal", country: "DE", genre: "TRAVEL", filter: { operator: "CONTAINS" as const, value: "reisepass" } },
      { name: "de_passfoto", country: "DE", genre: "TRAVEL", filter: { operator: "CONTAINS" as const, value: "passfoto" } },
      { name: "de_pois_exact", country: "DE", genre: "HEALTH_FITNESS", filter: { operator: "EQUALS" as const, value: "postorgasmisches syndrom" } },
      { name: "de_pois_partial", country: "DE", genre: "HEALTH_FITNESS", filter: { operator: "CONTAINS" as const, value: "orgasm" } },
    ];
    for (const query of queries) {
      try {
        const result = await api.querySearchTermPopularity({
          countryOrRegion: query.country,
          genre: query.genre,
          start: "2026-10-04",
          end: "2026-10-10",
          weeks: ["2026-10-04"],
          ...( "terms" in query ? { searchTerms: query.terms } : { searchTermFilter: query.filter }),
          pageSize: 100,
        });
        observations.push({ name: query.name, status: result.status, requestSha256: result.requestSha256, responseSha256: result.responseSha256, rateLimit: result.rateLimit, result: result.result });
      } catch (error) {
        observations.push({ name: query.name, error: error instanceof Error ? error.message : "unknown" });
      }
    }
    const path = resolve(process.env.APPLE_ADS_V1_ASO4_FOLLOWUP_PATH ?? "/private/tmp/kopa-aso4-apple-followup.json");
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, JSON.stringify({ generatedAt: new Date().toISOString(), observations }, null, 2), { mode: 0o600 });
    expect(observations).toHaveLength(queries.length);
  }, 60_000);
});
