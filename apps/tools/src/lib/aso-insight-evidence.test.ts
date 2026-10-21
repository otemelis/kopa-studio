import { describe, expect, it } from "vitest";
import { formatAsoInsightEvidence } from "./aso-insight-evidence";

describe("ASO insight evidence presentation", () => {
  it("keeps metadata version, observation, change, and rank-window context visible", () => {
    expect(formatAsoInsightEvidence({
      ruleId: "keyword_opportunity",
      comparisonWindow: "Rank evidence since metadata version observed 2026-07-25T10:00:00.000Z",
      evidence: [
        { label: "Current rank", value: "#18", source: "public_store" },
        { label: "Metadata snapshot", value: "snapshot-us-v2", source: "public_store" },
        { label: "Metadata locale", value: "en-US", source: "public_store" },
        { label: "Metadata version", value: "2.1 · checksum abc123", source: "public_store" },
        { label: "Metadata observed", value: "2026-07-25T10:00:00.000Z", source: "public_store" },
        { label: "Metadata change time", value: "2026-07-25T10:00:02.000Z", source: "public_store" },
        { label: "Rank evidence under metadata version", value: "2026-07-25 to 2026-07-30", source: "public_store" },
      ],
    })).toContain("Metadata snapshot: snapshot-us-v2");
    expect(formatAsoInsightEvidence({
      ruleId: "keyword_opportunity",
      comparisonWindow: "Current version only",
      evidence: [{ label: "Metadata locale", value: "en-US", source: "public_store" }],
    })).toContain("Metadata locale: en-US");
    expect(formatAsoInsightEvidence({
      ruleId: "keyword_opportunity",
      comparisonWindow: "Current version only",
      evidence: [{ label: "Metadata change time", value: "No detected change event", source: "public_store" }],
    })).toContain("Metadata change time: No detected change event");
  });

  it("falls back to the rule identity when legacy evidence is unavailable", () => {
    expect(formatAsoInsightEvidence({
      ruleId: "legacy_rule",
      comparisonWindow: "",
      evidence: [],
    })).toBe("legacy_rule");
  });
});
