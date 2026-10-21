import { describe, expect, it } from "vitest";
import { normalizeRankingObservation, type RankingQuery } from "./ranking-provider";

const query: RankingQuery = {
  appStoreId: "123456789",
  keyword: "personality test",
  country: "US",
  language: "en-US",
  device: "iphone",
};
const metadata = {
  observedAt: "2026-10-16T00:00:00.000Z",
  retrievedAt: "2026-10-17T09:00:00.000Z",
  providerObservationId: "response-row-1",
  granularity: "daily" as const,
  resultDepth: 200,
  effectiveLanguage: "en-US",
  languageEvidence: "explicit" as const,
};

describe("organic rank provider contract", () => {
  it("preserves a provider-checked positive position and full scope", () => {
    expect(normalizeRankingObservation(query, "apptweak", { checked: true, position: 17 }, metadata)).toEqual({
      ...query,
      requestedLanguage: "en-US",
      ...metadata,
      provider: "apptweak",
      state: "ranked",
      position: 17,
      evidence: "provider_checked",
    });
  });

  it("represents checked absence as unranked, with no numeric sentinel", () => {
    const row = normalizeRankingObservation(query, "apptweak", { checked: true, position: null }, metadata);
    expect(row).toMatchObject({ state: "unranked", evidence: "provider_checked", position: null });
  });

  it("represents a missed fetch as unavailable, not unranked", () => {
    const row = normalizeRankingObservation(query, "appfigures", {
      checked: false,
      position: null,
      reason: "no observation supplied",
    }, metadata);
    expect(row).toMatchObject({ state: "unavailable", evidence: "not_checked", position: null });
  });

  it.each([0, -2, 1.2, Number.NaN])("rejects invalid position %s as ambiguous", (position) => {
    const row = normalizeRankingObservation(query, "appfollow", { checked: true, position }, metadata);
    expect(row).toMatchObject({ state: "unavailable", evidence: "provider_ambiguous", position: null });
  });

  it("does not accept estimated/effective ranks as an input state", () => {
    const normalized = normalizeRankingObservation(query, "apptweak", {
      checked: false,
      position: null,
      reason: "fetch_performed=false; ignore effective_value sentinel",
    }, metadata);
    expect(normalized.state).toBe("unavailable");
    expect(normalized.position).toBeNull();
  });
});
