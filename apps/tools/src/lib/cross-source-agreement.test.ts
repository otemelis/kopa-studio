import { describe, expect, it } from "vitest";
import {
  appleAdsAgreementEvidence,
  assessCrossSourceAgreement,
  discoveryAgreementEvidence,
  formatCrossSourceAgreement,
  type CrossSourceEvidence,
} from "./cross-source-agreement";

const discovery: CrossSourceEvidence = {
  source: "Discovery",
  appId: "inner-type",
  market: "GB",
  window: { start: "2026-07-25", end: "2026-07-28" },
  trafficQuality: "concern",
  conversionReadiness: "not_judgable",
};
const appleAds: CrossSourceEvidence = {
  source: "Apple Ads",
  appId: "inner-type",
  market: "GB",
  window: { start: "2026-07-20", end: "2026-07-30" },
  trafficQuality: "concern",
  conversionReadiness: "not_judgable",
};

describe("cross-source agreement", () => {
  it("reports agreement only for independently matching signals in the exact overlap", () => {
    const result = assessCrossSourceAgreement({ discovery, appleAds });

    expect(result).toEqual({
      state: "agreement",
      label: "Agreement",
      explanation: "Both sources independently indicate that acquisition traffic quality needs review and conversion should not yet be judged.",
      overlapWindow: { start: "2026-07-25", end: "2026-07-28" },
      comparedQuestions: ["traffic_quality", "conversion_readiness"],
    });
    expect(formatCrossSourceAgreement(result)).toContain("does not validate this card's specific target or change its action eligibility");
    expect(formatCrossSourceAgreement(result)).toContain("Compared overlap: 2026-07-25 to 2026-07-28.");
  });

  it("reports conflict without changing either source signal", () => {
    const result = assessCrossSourceAgreement({
      discovery: { ...discovery, trafficQuality: "healthy", conversionReadiness: "judgable" },
      appleAds,
    });

    expect(result).toMatchObject({
      state: "conflict",
      label: "Conflict",
      overlapWindow: { start: "2026-07-25", end: "2026-07-28" },
      comparedQuestions: ["traffic_quality", "conversion_readiness"],
    });
    expect(result.explanation).toContain("keep their conclusions separate");
  });

  it.each([
    ["different app", { ...appleAds, appId: "other-app" }, "same exact app scope"],
    ["different market", { ...appleAds, market: "US" }, "same exact market scope"],
    ["missing market", { ...appleAds, market: null }, "same exact market scope"],
    ["missing window", { ...appleAds, window: null }, "explicit evidence windows"],
    ["non-overlapping window", { ...appleAds, window: { start: "2026-07-01", end: "2026-07-10" } }, "do not overlap"],
  ])("keeps %s evidence Unknown", (_label, other, explanation) => {
    const result = assessCrossSourceAgreement({ discovery, appleAds: other as CrossSourceEvidence });
    expect(result).toMatchObject({ state: "unknown", label: "Unknown", overlapWindow: null });
    expect(result.explanation).toContain(explanation);
  });

  it("keeps overlapping evidence Unknown when no shared question is independently supported", () => {
    expect(assessCrossSourceAgreement({
      discovery: { ...discovery, trafficQuality: "unknown", conversionReadiness: "unknown" },
      appleAds,
    })).toMatchObject({
      state: "unknown",
      overlapWindow: { start: "2026-07-25", end: "2026-07-28" },
      comparedQuestions: [],
    });
  });

  it("derives the production-shaped Discovery signals independently", () => {
    expect(discoveryAgreementEvidence({
      appId: "inner-type",
      market: "gb",
      observedWindow: { start: "2026-07-25", end: "2026-07-28" },
      freshness: "fresh",
      completeness: "complete",
      volume: "meaningful",
      impressions: 2331,
      impressionToPageRate: 12 / 2331,
      hasDailyRows: false,
    })).toEqual(discovery);
  });

  it("does not derive Discovery signals from stale or very-low evidence", () => {
    expect(discoveryAgreementEvidence({
      appId: "inner-type",
      market: "GB",
      observedWindow: { start: "2026-07-25", end: "2026-07-28" },
      freshness: "stale",
      completeness: "complete",
      volume: "meaningful",
      impressions: 2331,
      impressionToPageRate: 12 / 2331,
      hasDailyRows: false,
    })).toMatchObject({ trafficQuality: "unknown", conversionReadiness: "unknown" });
  });

  it("derives production-shaped Apple Ads signals from exact scoped recommendations", () => {
    const quality = {
      dataFreshness: "fresh",
      dataCompleteness: "complete",
      trafficRelevance: "irrelevant",
      evidenceVolume: "low",
    };
    const result = appleAdsAgreementEvidence({
      appId: "inner-type",
      market: "gb",
      rows: [
        { appId: "inner-type", storefront: "GB", type: "ADD_NEGATIVE_EXACT", evidenceWindow: { start: "2026-07-20", end: "2026-07-30" }, evidenceQuality: quality },
        { appId: "inner-type", storefront: "GB", type: "INSUFFICIENT_CONVERSION_EVIDENCE", evidenceWindow: { start: "2026-07-20", end: "2026-07-30" }, evidenceQuality: { ...quality, trafficRelevance: "mixed" } },
        { appId: "inner-type", storefront: "US", type: "CONTINUE_LEARNING", evidenceWindow: { start: "2026-07-20", end: "2026-07-30" }, evidenceQuality: { ...quality, trafficRelevance: "relevant" } },
      ],
    });

    expect(result).toEqual(appleAds);
  });

  it("keeps Apple Ads comparison unavailable when exact scoped rows use multiple evidence windows", () => {
    const quality = {
      dataFreshness: "fresh",
      dataCompleteness: "complete",
      trafficRelevance: "irrelevant",
      evidenceVolume: "low",
    };
    expect(appleAdsAgreementEvidence({
      appId: "inner-type",
      market: "GB",
      rows: [
        { appId: "inner-type", storefront: "GB", type: "ADD_NEGATIVE_EXACT", evidenceWindow: { start: "2026-07-20", end: "2026-07-30" }, evidenceQuality: quality },
        { appId: "inner-type", storefront: "GB", type: "INSUFFICIENT_CONVERSION_EVIDENCE", evidenceWindow: { start: "2026-07-21", end: "2026-07-30" }, evidenceQuality: quality },
      ],
    })).toMatchObject({ window: null });
  });
});
