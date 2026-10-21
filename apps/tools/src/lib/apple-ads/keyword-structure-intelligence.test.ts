import { describe, expect, it } from "vitest";
import { analyzeAppleAdsKeywordStructure } from "./keyword-structure-intelligence";

const structure = {
  campaigns: [{ id: "c1", appId: null, name: "Kopa Studio", status: "PAUSED", servingStatus: "NOT_RUNNING", dailyBudgetAmount: 10, currency: "USD", countriesOrRegions: ["US"], sourceSyncedAt: "2026-07-21T00:00:00Z", adGroupCount: 2, keywordCount: 3, negativeKeywordCount: 0 }],
  adGroups: [
    { id: "g1", campaignId: "c1", name: "Brand", status: "ACTIVE", servingStatus: null, defaultBidAmount: 1, currency: "USD", searchMatchEnabled: true, keywordCount: 2, negativeKeywordCount: 0 },
    { id: "g2", campaignId: "c1", name: "Generic", status: "ACTIVE", servingStatus: null, defaultBidAmount: 1, currency: "USD", searchMatchEnabled: false, keywordCount: 1, negativeKeywordCount: 0 },
  ],
  keywords: [
    { id: "k1", campaignId: "c1", adGroupId: "g1", keywordText: "Kopa Studio", matchType: "EXACT", status: "ACTIVE", servingStatus: null, bidAmount: 1, currency: "USD" },
    { id: "k2", campaignId: "c1", adGroupId: "g1", keywordText: "Kopa Studio", matchType: "BROAD", status: "ACTIVE", servingStatus: null, bidAmount: 1, currency: "USD" },
    { id: "k3", campaignId: "c1", adGroupId: "g2", keywordText: "keyword planner", matchType: "BROAD", status: "PAUSED", servingStatus: null, bidAmount: 1, currency: "USD" },
  ],
  negativeKeywords: [],
  totals: { campaigns: 1, adGroups: 2, keywords: 3, negativeKeywords: 0 },
};

describe("analyzeAppleAdsKeywordStructure", () => {
  it("flags pre-delivery keyword setup risks only when the traffic boundary really overlaps", () => {
    const result = analyzeAppleAdsKeywordStructure(structure);
    expect(result.summary.keywords).toBe(3);
    expect(result.summary.duplicates).toBe(0);
    expect(result.summary.adGroupsWithoutNegatives).toBe(2);
    expect(result.summary.broadOnlyAdGroups).toBe(1);
    expect(result.summary.pausedKeywords).toBe(1);
    expect(result.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining(["missing-negatives", "broad-only", "paused-keywords", "inactive-campaigns"]));
    expect(result.findings.map((finding) => finding.id)).not.toContain("duplicates");
    expect(result.keywords.find((keyword) => keyword.id === "k1")?.intentLabel).toBe("branded");
  });

  it("does not warn about exact-only groups without negatives", () => {
    const result = analyzeAppleAdsKeywordStructure({
      ...structure,
      adGroups: [{ id: "g1", campaignId: "c1", name: "Core Exact", status: "ACTIVE", servingStatus: null, defaultBidAmount: 1, currency: "USD", searchMatchEnabled: false, keywordCount: 1, negativeKeywordCount: 0 }],
      keywords: [{ id: "k1", campaignId: "c1", adGroupId: "g1", keywordText: "personality test", matchType: "EXACT", status: "ACTIVE", servingStatus: null, bidAmount: 1, currency: "USD" }],
    });
    expect(result.summary.adGroupsWithoutNegatives).toBe(0);
    expect(result.findings.map((finding) => finding.id)).not.toContain("missing-negatives");
  });

  it("keeps duplicate detection scoped by market", () => {
    const result = analyzeAppleAdsKeywordStructure({
      ...structure,
      campaigns: [
        { ...structure.campaigns[0], id: "c1", countriesOrRegions: ["US"] },
        { ...structure.campaigns[0], id: "c2", countriesOrRegions: ["GB"] },
      ],
      adGroups: [
        { id: "g1", campaignId: "c1", name: "Core Exact US", status: "ACTIVE", servingStatus: null, defaultBidAmount: 1, currency: "USD", searchMatchEnabled: false, keywordCount: 1, negativeKeywordCount: 1 },
        { id: "g2", campaignId: "c2", name: "Core Exact UK", status: "ACTIVE", servingStatus: null, defaultBidAmount: 1, currency: "GBP", searchMatchEnabled: false, keywordCount: 1, negativeKeywordCount: 1 },
      ],
      keywords: [
        { id: "k1", campaignId: "c1", adGroupId: "g1", keywordText: "personality test", matchType: "EXACT", status: "ACTIVE", servingStatus: null, bidAmount: 1, currency: "USD" },
        { id: "k2", campaignId: "c2", adGroupId: "g2", keywordText: "Personality Test", matchType: "EXACT", status: "ACTIVE", servingStatus: null, bidAmount: 1, currency: "GBP" },
      ],
    });
    expect(result.summary.duplicates).toBe(0);
    expect(result.findings.map((finding) => finding.id)).not.toContain("duplicates");
  });
});
