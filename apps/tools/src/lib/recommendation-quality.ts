export type RecommendationQualityInput = {
  title: string;
  observation: string;
  recommendation: string;
  evidence: string;
  actionable: boolean;
  status: string;
};

export type RecommendationQualityOutput = {
  suggestedAction: string;
  evidence: string;
  actionable: boolean;
  status: string;
};

const metadataPattern = /\b(title|subtitle|metadata|keyword field|keywords field)\b/i;
const impossibleKeywordCountPattern = /\b([1-9]\d*)\s+(?:high-priority\s+)?keywords?\b/i;
const quotedTermsPattern = /["“”'][^"“”']+["“”']/g;

function constrainedMetadataAction(count: number) {
  return `Review up to five metadata candidates for the next market-specific title/subtitle revision. Prioritize relevance, current rank gap, paid validation, and character limits before editing copy. ${count} terms cannot all fit in title/subtitle.`;
}

export function applyRecommendationQuality(input: RecommendationQualityInput): RecommendationQualityOutput {
  const combined = `${input.title}\n${input.observation}\n${input.recommendation}`;
  const countMatch = combined.match(impossibleKeywordCountPattern);
  const quotedTerms = combined.match(quotedTermsPattern) ?? [];
  const explicitCount = countMatch ? Number(countMatch[1]) : 0;
  const impliedCount = quotedTerms.length;
  const keywordCount = Math.max(explicitCount, impliedCount);

  if (metadataPattern.test(combined) && keywordCount > 8) {
    return {
      suggestedAction: constrainedMetadataAction(keywordCount),
      evidence: `${input.evidence}; quality gate: metadata capacity limit applied.`,
      actionable: false,
      status: "Needs refinement",
    };
  }

  return {
    suggestedAction: input.recommendation,
    evidence: input.evidence,
    actionable: input.actionable,
    status: input.status,
  };
}
