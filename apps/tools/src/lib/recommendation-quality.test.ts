import { describe, expect, it } from "vitest";
import { applyRecommendationQuality } from "./recommendation-quality";

const base = {
  title: "Keyword opportunity",
  observation: "A keyword is close to page one.",
  recommendation: "Consider testing the keyword in the subtitle.",
  evidence: "rule:metadata_gap",
  actionable: true,
  status: "New",
};

describe("applyRecommendationQuality", () => {
  it("downgrades impossible metadata keyword stuffing recommendations", () => {
    const result = applyRecommendationQuality({
      ...base,
      title: "54 high-priority keywords are missing from title and subtitle",
      recommendation: "Add all missing high-priority keywords to the title and subtitle.",
    });
    expect(result.actionable).toBe(false);
    expect(result.status).toBe("Needs refinement");
    expect(result.suggestedAction).toContain("Review up to five metadata candidates");
    expect(result.suggestedAction).toContain("54 terms cannot all fit");
  });

  it("leaves constrained recommendations actionable", () => {
    const result = applyRecommendationQuality(base);
    expect(result).toEqual({
      suggestedAction: base.recommendation,
      evidence: base.evidence,
      actionable: true,
      status: "New",
    });
  });
});
