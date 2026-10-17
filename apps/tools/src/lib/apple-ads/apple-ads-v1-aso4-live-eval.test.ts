import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AppleAdsApiV1Provider, type AppleAdsV1Result } from "./apple-ads-v1-provider";

const enabled = process.env.KOPA_APPLE_ADS_V1_ASO4_LIVE_EVAL === "1";
const apps = [
  { name: "POIS", id: "6820665225", genre: "HEALTH_FITNESS", adjacentGenre: "LIFESTYLE", terms: ["POIS", "post orgasmic illness", "postorgasmic illness syndrome", "post-orgasmic illness syndrome", "post orgasm syndrome", "orgasm illness", "post ejaculation illness", "post orgasm symptoms", "post orgasm fatigue", "post orgasm flu", "male health", "sexual health"] },
  { name: "PASSPORT", id: "6822753543", genre: "TRAVEL", adjacentGenre: "PRODUCTIVITY_UTILITIES", terms: ["passport renewal", "passport photo", "passport application", "passport tracker", "passport expiry reminder", "passport expiration reminder", "passport scanner", "passport photo app", "travel document", "passport app", "visa and passport", "passport renewal appointment"] },
];
const markets = ["US", "DE", "GB"];
const week = "2026-10-04";
const previousWeek = "2025-07-13";
const today = new Date().toISOString().slice(0, 10);
const end = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const start = new Date(Date.parse(`${end}T00:00:00Z`) - 27 * 86400000).toISOString().slice(0, 10);

function metadata<T>(value: AppleAdsV1Result<T>) {
  return { status: value.status, requestedAt: value.requestedAt, receivedAt: value.receivedAt, requestSha256: value.requestSha256, responseSha256: value.responseSha256, pagination: value.pagination, rateLimit: value.rateLimit, requestId: value.requestId };
}

describe.skipIf(!enabled)("Apple Ads v1 ASO-4 bounded read-only evaluation", () => {
  it("records phrase, popularity, pagination, and existing paid-search evidence without writes", async () => {
    const api = new AppleAdsApiV1Provider();
    const evidence: Record<string, unknown> = { generatedAt: new Date().toISOString(), apiBase: "https://api.ads.apple.com/v1", period: { start, end, week, previousWeek }, markets, appSet: apps.map(({ name, id }) => ({ name, adamId: id })) };
    const queries: Array<Record<string, unknown>> = [];
    async function record<T>(name: string, request: () => Promise<AppleAdsV1Result<T>>) {
      try {
        const response = await request();
        queries.push({ name, ...metadata(response), result: response.result });
        return response;
      } catch (error) {
        queries.push({ name, state: "request_failed", message: error instanceof Error ? error.message : "Unknown request error" });
        return null;
      }
    }

    const me = await api.getMe();
    const acls = await api.getAcls();
    const accountId = process.env.APPLE_ADS_V1_AD_ACCOUNT_ID?.trim();
    const selectedAcl = (acls.result.acls as Array<Record<string, unknown>> | undefined)?.find((entry) => String((entry.adAccount as Record<string, unknown> | undefined)?.id) === accountId);
    expect(me.status).toBe(200);
    expect(acls.status).toBe(200);
    expect(selectedAcl).toBeTruthy();
    evidence.account = { orgId: me.result.orgId, adAccountId: accountId, roles: selectedAcl?.roles };

    const exactPhrases = [...apps[0].terms.slice(0, 10), ...apps[1].terms];
    await record("phrase_search_exact", () => api.queryPhraseSuggestions({ mode: "SEARCH", exactPhrases, pageSize: 100 }));
    for (const partialPhrase of ["post orgasm", "orgasmic", "passport", "travel document", "passport renewal"]) {
      await record(`phrase_search_like:${partialPhrase}`, () => api.queryPhraseSuggestions({ mode: "SEARCH", partialPhrase, pageSize: 100 }));
    }
    for (const app of [{ name: "InnerType", id: "6785764991" }, ...apps]) {
      await record(`phrase_suggestion:${app.name}`, () => api.queryPhraseSuggestions({ mode: "SUGGESTION", appAdamId: app.id, pageSize: 100 }));
      await record(`keyword_suggestion:${app.name}`, () => api.queryKeywordSuggestions({ appAdamId: app.id, countriesOrRegions: markets, pageSize: 100 }));
    }
    for (const countryOrRegion of markets) {
      await record(`keyword_suggestion_seeded:POIS:${countryOrRegion}`, () => api.queryKeywordSuggestions({ appAdamId: "6785764991", countriesOrRegions: [countryOrRegion], terms: ["post orgasmic illness", "postorgasmic illness syndrome", "orgasm symptoms"], pageSize: 100 }));
      await record(`keyword_suggestion_seeded:PASSPORT:${countryOrRegion}`, () => api.queryKeywordSuggestions({ appAdamId: "6785764991", countriesOrRegions: [countryOrRegion], terms: ["passport renewal", "passport photo", "passport tracker"], pageSize: 100 }));
    }

    for (const app of apps) {
      for (const countryOrRegion of markets) {
        await record(`popularity_exact:${app.name}:${countryOrRegion}:${app.genre}`, () => api.querySearchTermPopularity({
          countryOrRegion, genre: app.genre, start: previousWeek, end: week, weeks: [previousWeek, week], searchTerms: app.terms, pageSize: 1000,
        }));
        await record(`popularity_exact:${app.name}:${countryOrRegion}:${app.adjacentGenre}`, () => api.querySearchTermPopularity({
          countryOrRegion, genre: app.adjacentGenre, start: previousWeek, end: week, weeks: [previousWeek, week], searchTerms: app.terms, pageSize: 1000,
        }));
        const seed = app.name === "POIS" ? "orgasm" : "passport";
        for (const operator of ["EQUALS", "CONTAINS", "STARTS_WITH"] as const) {
          await record(`popularity_filter:${app.name}:${countryOrRegion}:${app.genre}:${operator}`, () => api.querySearchTermPopularity({
            countryOrRegion, genre: app.genre, start: week, end: "2026-10-10", weeks: [week], searchTermFilter: { operator, value: seed }, pageSize: 100,
          }));
        }
      }
    }

    for (const genre of ["HEALTH_FITNESS", "TRAVEL", "LIFESTYLE", "PRODUCTIVITY_UTILITIES"]) {
      const first = await record(`pagination:${genre}:offset0`, () => api.querySearchTermPopularity({ countryOrRegion: "US", genre, start: week, end: "2026-10-10", weeks: [week], offset: 0, pageSize: 20 }));
      const second = await record(`pagination:${genre}:offset20`, () => api.querySearchTermPopularity({ countryOrRegion: "US", genre, start: week, end: "2026-10-10", weeks: [week], offset: 20, pageSize: 20 }));
      const a = (first?.result.rows as Array<Record<string, unknown>> | undefined) ?? [];
      const b = (second?.result.rows as Array<Record<string, unknown>> | undefined) ?? [];
      queries.push({ name: `pagination_validation:${genre}`, firstPageRows: a.length, secondPageRows: b.length, duplicateSearchTerms: a.map((row) => row.searchTerm).filter((term) => b.some((row) => row.searchTerm === term)) });
    }
    for (const operator of ["EQUALS", "CONTAINS", "STARTS_WITH"] as const) {
      await record(`filter_diagnostic:passport:US:TRAVEL:${operator}`, () => api.querySearchTermPopularity({
        countryOrRegion: "US", genre: "TRAVEL", start: previousWeek, end: week, weeks: [previousWeek, week], searchTermFilter: { operator, value: "passport" }, pageSize: 100,
      }));
    }
    await record("filter_diagnostic:passport:US:TRAVEL:IN-single", () => api.querySearchTermPopularity({
      countryOrRegion: "US", genre: "TRAVEL", start: week, end: "2026-10-10", weeks: [week], searchTerms: ["passport"], pageSize: 100,
    }));
    await record("phrase_search_exact_control_from_partial", () => api.queryPhraseSuggestions({ mode: "SEARCH", exactPhrases: ["Passport Canada", "Passport and Visa Service"], pageSize: 100 }));

    const campaigns = await record("existing_innerType_campaigns", () => api.queryCampaignsForApp("6785764991", 0, 100));
    const campaignRows = (campaigns?.result as unknown as Array<Record<string, unknown>> | undefined) ?? [];
    const selectedCampaign = campaignRows.find((campaign) => campaign.promotedObjectType === "APPSTORE_APP" && String(campaign.promotedObjectId) === "6785764991" && campaign.deleted !== true && (campaign.status === "ENABLED" || campaign.displayStatus === "RUNNING"));
    if (selectedCampaign) {
      evidence.paidCampaignContext = { campaignId: selectedCampaign.id, status: selectedCampaign.status, displayStatus: selectedCampaign.displayStatus, promotedObjectId: selectedCampaign.promotedObjectId };
      await record("paid_search_terms_existing_campaign", () => api.queryAppSearchTerms({ campaignId: String(selectedCampaign.id), start, end, timeZone: "ORTZ", pageSize: 1000 }));
    } else {
      evidence.paidCampaignContext = { state: "no_enabled_existing_innerType_campaign_returned", campaignsReturned: campaignRows.length };
    }
    for (const countryOrRegion of markets) {
      await record(`paid_impression_share:InnerType:${countryOrRegion}`, () => api.queryImpressionShare({ appAdamId: "6785764991", countryOrRegion, start: "2026-09-20", end: "2026-10-11", reportType: "ALL_SLOTS", pageSize: 1000 }));
    }

    evidence.queries = queries;
    const output = resolve(process.env.APPLE_ADS_V1_ASO4_EVIDENCE_PATH ?? "/private/tmp/kopa-aso4-apple-live.json");
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, JSON.stringify(evidence, null, 2), { mode: 0o600 });
    expect(queries.some((query) => query.name === "phrase_search_exact" && query.status === 200)).toBe(true);
    expect(queries.some((query) => query.name === "popularity_exact:POIS:US:HEALTH_FITNESS" && query.status === 200)).toBe(true);
  }, 120_000);
});
