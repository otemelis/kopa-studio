import { describe, expect, it } from "vitest";
import { hasNextApplePopularityPage, latestPublishedAppleWeek, parseApplePopularity } from "./apple-popularity";
import type { AppleAdsV1Result } from "@/lib/apple-ads/apple-ads-v1-provider";

const page = (rows: unknown[]): AppleAdsV1Result<Record<string, unknown>> => ({
  result: { rows }, status: 200, pagination: { offset: 0, pageSize: 100 }, requestedAt: "2026-11-08T20:00:00Z",
  receivedAt: "2026-11-08T20:00:01Z", requestSha256: "request", responseSha256: "response",
  rateLimit: { limit: null, remaining: null, resetSeconds: null, retryAfterSeconds: null }, requestId: null,
});

describe("Apple weekly keyword popularity", () => {
  it("uses only published complete weeks", () => {
    expect(latestPublishedAppleWeek(new Date("2026-11-08T23:59:00Z"))).toBe("2026-10-25");
    expect(latestPublishedAppleWeek(new Date("2026-11-09T06:59:00Z"))).toBe("2026-10-25");
    expect(latestPublishedAppleWeek(new Date("2026-11-09T07:00:00Z"))).toBe("2026-11-01");
  });

  it("stops on Apple's zero-row pageSize=0 and a short page", () => {
    expect(hasNextApplePopularityPage(0, 100)).toBe(false);
    expect(hasNextApplePopularityPage(20, 100)).toBe(false);
    expect(hasNextApplePopularityPage(100, 100)).toBe(true);
    expect(() => hasNextApplePopularityPage(101, 100)).toThrow("length was invalid");
  });

  it("keeps observed scores and unreported terms distinct from zero", () => {
    const observations = parseApplePopularity([{ id: "one", term: "passport" }, { id: "two", term: "travel stamps" }], "US", "TRAVEL", "2026-10-25", [page([{
      week: "2026-10-25", countryOrRegion: "US", genre: "TRAVEL", searchTerm: "passport",
      rankInGenre: 308, searchPopularityInGenre: 58, searchPopularity1to100: 50, searchPopularity1to5: 3,
    }])]);
    expect(observations.map((row) => [row.status, row.popularity_1_to_100])).toEqual([["observed", 50], ["not_reported", null]]);
    expect(observations[0].source).toBe("apple_ads_search_term_popularity");
    expect(observations[1].rank_in_genre).toBeNull();
  });

  it("rejects a response for the wrong country, genre or week before storing", () => {
    expect(() => parseApplePopularity([{ id: "one", term: "passport" }], "DE", "TRAVEL", "2026-10-25", [page([{
      week: "2026-10-25", countryOrRegion: "US", genre: "TRAVEL", searchTerm: "passport",
    }])])).toThrow("scope did not match");
  });

  it("rejects an unexpected or duplicate term", () => {
    const row = { week: "2026-10-25", countryOrRegion: "US", genre: "TRAVEL", searchTerm: "passport" };
    expect(() => parseApplePopularity([{ id: "one", term: "passport" }], "US", "TRAVEL", "2026-10-25", [page([row, row])])).toThrow("duplicate");
    expect(() => parseApplePopularity([{ id: "one", term: "passport" }], "US", "TRAVEL", "2026-10-25", [page([{ ...row, searchTerm: "other" }])])).toThrow("unrequested");
  });
});
