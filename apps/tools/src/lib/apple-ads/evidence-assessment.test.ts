import { describe, expect, it } from "vitest";
import fixture from "./fixtures/uk-evidence-assessment.json";
import {
  assessAppleAdsEvidence,
  classifySearchTermRelevance,
  isExplicitObservedSearchTerm,
  type AssessmentInput,
} from "./evidence-assessment";

const input = fixture as AssessmentInput;

describe("Apple Ads evidence assessment", () => {
  it("ignores privacy-suppressed and blank search-term labels", () => {
    expect(isExplicitObservedSearchTerm("LOW_VOLUME")).toBe(false);
    expect(isExplicitObservedSearchTerm("  ")).toBe(false);
  });

  it("classifies product relevance deterministically", () => {
    expect(classifySearchTermRelevance("lovense remote").state).toBe("irrelevant");
    expect(classifySearchTermRelevance("personality test").state).toBe("relevant");
    expect(classifySearchTermRelevance("unreviewed phrase").state).toBe("unknown");
  });

  it("produces the six expected conclusions from the sanitized UK fixture", () => {
    const assessment = assessAppleAdsEvidence(input);
    expect(assessment.trafficQuality).toMatchObject({ state: "poor", confidence: "high" });
    expect(assessment.conversionEvidence).toMatchObject({ state: "insufficient", tapCount: 4, installCount: 0 });
    expect(assessment.recommendations.map((recommendation) => [recommendation.type, recommendation.targetText])).toEqual([
      ["ADD_NEGATIVE_EXACT", "lovense"],
      ["ADD_NEGATIVE_EXACT", "lovense remote"],
      ["ADD_NEGATIVE_EXACT", "y not"],
      ["REVIEW_BROAD_KEYWORD", "relationship test"],
      ["CONTINUE_LEARNING", "personality test"],
      ["INSUFFICIENT_CONVERSION_EVIDENCE", null],
    ]);
  });

  it("never describes zero installs from four taps as conversion failure", () => {
    const conversion = assessAppleAdsEvidence(input).recommendations.find((item) => item.type === "INSUFFICIENT_CONVERSION_EVIDENCE");
    expect(conversion?.diagnosis).toContain("not evidence of conversion failure");
    expect(conversion?.proposedAction).toContain("Wait for more relevant taps");
  });

  it("does not recommend an existing exact negative again within its traffic boundary", () => {
    const withNegative: AssessmentInput = {
      ...input,
      negativeKeywords: [...input.negativeKeywords, { adGroupId: "ad-group-search-match", keywordText: "y not", matchType: "EXACT", status: "ACTIVE", isDeleted: false }],
    };
    expect(assessAppleAdsEvidence(withNegative).recommendations.some((item) => item.targetText === "y not" && item.type === "ADD_NEGATIVE_EXACT")).toBe(false);
  });

  it("does not let another ad group's negative suppress a recommendation", () => {
    const withOtherScope: AssessmentInput = {
      ...input,
      negativeKeywords: [...input.negativeKeywords, { adGroupId: "ad-group-exact", keywordText: "y not", matchType: "EXACT", status: "ACTIVE", isDeleted: false }],
    };
    expect(assessAppleAdsEvidence(withOtherScope).recommendations.some((item) => item.targetText === "y not" && item.type === "ADD_NEGATIVE_EXACT")).toBe(true);
  });

  it("blocks term and keyword action recommendations when data is stale or partial", () => {
    for (const patch of [{ dataFreshness: "stale" as const }, { dataFreshness: "partial" as const, dataCompleteness: "partial" as const }]) {
      const recommendations = assessAppleAdsEvidence({ ...input, ...patch }).recommendations;
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe("INSUFFICIENT_CONVERSION_EVIDENCE");
      expect(recommendations[0].evidenceQuality.dataFreshness).toBe(patch.dataFreshness);
    }
  });

  it("keeps storefront assessments isolated", () => {
    const gb = assessAppleAdsEvidence(input);
    const de = assessAppleAdsEvidence({ ...input, campaignId: "campaign-de", storefront: "DE", searchTerms: [], totals: { impressions: 0, taps: 0, installs: 0, spend: 0, currency: "EUR" } });
    expect(gb.storefront).toBe("GB");
    expect(de.storefront).toBe("DE");
    expect(de.recommendations.some((item) => item.targetText === "lovense")).toBe(false);
  });
});
