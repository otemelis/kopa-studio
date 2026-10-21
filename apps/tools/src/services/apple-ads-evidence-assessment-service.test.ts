import { describe, expect, it, vi } from "vitest";
vi.mock("../lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("Database should not be used by identity tests."); } }));
import fixture from "../lib/apple-ads/fixtures/uk-evidence-assessment.json";
import { assessAppleAdsEvidence, type AssessmentInput } from "../lib/apple-ads/evidence-assessment";
import { appleAdsEvidenceFingerprint, appleAdsRecommendationDedupeKey } from "./apple-ads-evidence-assessment-service";

describe("Apple Ads assessment persistence identity", () => {
  it("is idempotent for unchanged evidence", () => {
    const first = assessAppleAdsEvidence(fixture as AssessmentInput);
    const second = assessAppleAdsEvidence(fixture as AssessmentInput);
    expect(appleAdsEvidenceFingerprint(first)).toBe(appleAdsEvidenceFingerprint(second));
    expect(first.recommendations.map((item) => appleAdsRecommendationDedupeKey("connection", first, item)))
      .toEqual(second.recommendations.map((item) => appleAdsRecommendationDedupeKey("connection", second, item)));
    expect(new Set(first.recommendations.map((item) => appleAdsRecommendationDedupeKey("connection", first, item))).size).toBe(6);
  });

  it("keeps conclusion identity across an advancing evidence window and isolates storefronts", () => {
    const assessment = assessAppleAdsEvidence(fixture as AssessmentInput);
    const changedWindow = { ...assessment, evidenceWindow: { ...assessment.evidenceWindow, end: "2026-07-28" } };
    const changedStorefront = { ...assessment, storefront: "DE" };
    expect(appleAdsRecommendationDedupeKey("connection", assessment, assessment.recommendations[0]))
      .toBe(appleAdsRecommendationDedupeKey("connection", changedWindow, changedWindow.recommendations[0]));
    expect(appleAdsRecommendationDedupeKey("connection", assessment, assessment.recommendations[0]))
      .not.toBe(appleAdsRecommendationDedupeKey("connection", changedStorefront, changedStorefront.recommendations[0]));
    expect(appleAdsRecommendationDedupeKey("connection", assessment, assessment.recommendations[0]))
      .not.toBe(appleAdsRecommendationDedupeKey("other-connection", assessment, assessment.recommendations[0]));
    expect(appleAdsEvidenceFingerprint(assessment)).not.toBe(appleAdsEvidenceFingerprint(changedWindow));
  });

  it("keeps rule version in evidence fingerprinting without changing conclusion identity", () => {
    const assessment = assessAppleAdsEvidence(fixture as AssessmentInput);
    const changedRule = { ...assessment, ruleVersion: "uk-evidence-v-next" };
    expect(appleAdsRecommendationDedupeKey("connection", assessment, assessment.recommendations[0]))
      .toBe(appleAdsRecommendationDedupeKey("connection", changedRule, changedRule.recommendations[0]));
    expect(appleAdsEvidenceFingerprint(assessment)).not.toBe(appleAdsEvidenceFingerprint(changedRule));
  });
});
