import type { InsightEvidenceItem } from "@/types/domain";

const contextLabels = new Set([
  "Metadata snapshot",
  "Metadata version",
  "Metadata observed",
  "Metadata change time",
  "Rank evidence under metadata version",
]);

export function formatAsoInsightEvidence(input: {
  evidence: InsightEvidenceItem[];
  comparisonWindow: string;
  ruleId: string;
}) {
  const context = input.evidence.filter((item) => contextLabels.has(item.label));
  const core = input.evidence.filter((item) => !contextLabels.has(item.label)).slice(0, 3);
  const items = [...core, ...context].map((item) => `${item.label}: ${item.value}`);
  if (input.comparisonWindow) items.push(`Window: ${input.comparisonWindow}`);
  return items.length ? items.join(" · ") : input.ruleId;
}
