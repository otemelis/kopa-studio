export const APPLE_ADS_EVIDENCE_RULE_VERSION = "uk-evidence-to-action-v1";
export const DEFAULT_DIRECTIONAL_TAP_THRESHOLD = 20;

export type EvidenceConfidence = "low" | "medium" | "high";
export type DataFreshness = "fresh" | "stale" | "partial";
export type DataCompleteness = "complete" | "partial";
export type RecommendationType =
  | "ADD_NEGATIVE_EXACT"
  | "REVIEW_BROAD_KEYWORD"
  | "CONTINUE_LEARNING"
  | "INSUFFICIENT_CONVERSION_EVIDENCE";
export type RecommendationTargetType = "SEARCH_TERM" | "KEYWORD" | "CAMPAIGN";

export type EvidenceQuality = {
  dataFreshness: DataFreshness;
  dataCompleteness: DataCompleteness;
  trafficRelevance: "relevant" | "mixed" | "irrelevant" | "unknown";
  evidenceVolume: "none" | "very_low" | "low" | "meaningful";
  confidence: EvidenceConfidence;
};

export type AppleAdsEvidenceRecommendation = {
  type: RecommendationType;
  targetType: RecommendationTargetType;
  targetText: string | null;
  campaignId: string;
  adGroupId?: string;
  keywordId?: string;
  storefront: string;
  title: string;
  observation: string;
  diagnosis: string;
  proposedAction: string;
  confidence: EvidenceConfidence;
  financialRisk: "low" | "medium" | "high";
  evidence: {
    impressions: number;
    taps: number;
    installs: number;
    spend: number;
    currency: string | null;
    sourceKeyword?: string;
    matchType?: string;
  };
  evidenceQuality: EvidenceQuality;
  reviewCondition: string;
};

export type AppleAdsEvidenceAssessment = {
  appId: string;
  appName: string;
  storefront: string;
  campaignId: string;
  campaignName: string;
  evidenceWindow: { start: string; end: string };
  generatedAt: string;
  ruleVersion: string;
  dataFreshness: DataFreshness;
  dataCompleteness: DataCompleteness;
  trafficQuality: {
    state: "good" | "mixed" | "poor" | "unknown";
    confidence: EvidenceConfidence;
    explanation: string;
  };
  conversionEvidence: {
    state: "insufficient" | "directional" | "meaningful";
    tapCount: number;
    installCount: number;
    threshold: number;
    explanation: string;
  };
  totals: {
    impressions: number;
    taps: number;
    installs: number;
    spend: number;
    currency: string | null;
  };
  recommendations: AppleAdsEvidenceRecommendation[];
};

export type SearchTermEvidence = {
  searchTerm: string;
  sourceKeywordText: string | null;
  matchSource: string | null;
  adGroupId: string | null;
  keywordId: string | null;
  impressions: number;
  taps: number;
  installs: number;
  spend: number;
};

export type KeywordEvidence = {
  id: string;
  adGroupId: string;
  keywordText: string;
  matchType: string | null;
  status: string | null;
  isDeleted: boolean;
};

export type NegativeKeywordEvidence = {
  adGroupId: string | null;
  keywordText: string;
  matchType: string | null;
  status: string | null;
  isDeleted: boolean;
};

export type AdGroupEvidence = {
  id: string;
  searchMatchEnabled: boolean | null;
  status: string | null;
  isDeleted: boolean;
};

export type AssessmentInput = {
  appId: string;
  appName: string;
  campaignId: string;
  campaignName: string;
  storefront: string;
  campaignStatus: string | null;
  evidenceWindow: { start: string; end: string };
  generatedAt: string;
  dataFreshness: DataFreshness;
  dataCompleteness: DataCompleteness;
  totals: AppleAdsEvidenceAssessment["totals"];
  searchTerms: SearchTermEvidence[];
  keywords: KeywordEvidence[];
  negativeKeywords: NegativeKeywordEvidence[];
  adGroups: AdGroupEvidence[];
  directionalTapThreshold?: number;
};

type Relevance = { state: "relevant" | "irrelevant" | "unknown"; confidence: EvidenceConfidence; reason: string };

const PRODUCT_INTENT_PHRASES = [
  "personality test",
  "personality type",
  "personality traits",
  "personality quiz",
  "big five",
  "attachment style",
  "relationship test",
  "communication style",
  "enneagram",
  "character test",
] as const;

// Intentionally small and inspectable. Extend with product-reviewed intent families,
// not campaign-specific one-off code branches.
const IRRELEVANT_INTENT_PHRASES = [
  "lovense",
  "we-vibe",
  "satisfyer",
  "remote vibrator",
  "sex toy remote",
  "y not",
  "horoscope",
  "zodiac",
  "iq test",
  "depression test",
  "adhd test",
  "autism test",
] as const;

const SUPPRESSED_SEARCH_TERM_LABELS = new Set([
  "low_volume",
  "low volume",
  "low-volume",
  "(low volume)",
  "privacy threshold",
]);

export const normalizeAppleAdsText = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");

export function isExplicitObservedSearchTerm(value: string | null | undefined) {
  const normalized = normalizeAppleAdsText(value);
  return Boolean(normalized) && !SUPPRESSED_SEARCH_TERM_LABELS.has(normalized);
}

function phraseMatches(term: string, phrase: string) {
  return term === phrase || term.startsWith(`${phrase} `) || term.endsWith(` ${phrase}`) || term.includes(` ${phrase} `);
}

export function classifySearchTermRelevance(term: string): Relevance {
  const normalized = normalizeAppleAdsText(term);
  if (!isExplicitObservedSearchTerm(normalized)) {
    return { state: "unknown", confidence: "high", reason: "This row is blank or privacy-suppressed, not an explicit observed query." };
  }
  const irrelevant = IRRELEVANT_INTENT_PHRASES.find((phrase) => phraseMatches(normalized, phrase));
  if (irrelevant) {
    return { state: "irrelevant", confidence: "high", reason: `"${irrelevant}" belongs to a reviewed intent family unrelated to the app's personality-assessment purpose.` };
  }
  const relevant = PRODUCT_INTENT_PHRASES.find((phrase) => phraseMatches(normalized, phrase));
  if (relevant) {
    return { state: "relevant", confidence: "high", reason: `"${relevant}" is part of the app's reviewed personality-assessment intent vocabulary.` };
  }
  return { state: "unknown", confidence: "low", reason: "The deterministic vocabulary does not classify this query confidently." };
}

function evidenceVolume(taps: number): EvidenceQuality["evidenceVolume"] {
  if (taps === 0) return "very_low";
  if (taps < 5) return "very_low";
  if (taps < DEFAULT_DIRECTIONAL_TAP_THRESHOLD) return "low";
  return "meaningful";
}

function quality(input: {
  freshness: DataFreshness;
  completeness: DataCompleteness;
  relevance: EvidenceQuality["trafficRelevance"];
  taps: number;
  confidence: EvidenceConfidence;
}): EvidenceQuality {
  return {
    dataFreshness: input.freshness,
    dataCompleteness: input.completeness,
    trafficRelevance: input.relevance,
    evidenceVolume: evidenceVolume(input.taps),
    confidence: input.confidence,
  };
}

function active(value: string | null) {
  return !value || /active|enabled|running/i.test(value);
}

function resolveScope(
  term: SearchTermEvidence,
  keywords: KeywordEvidence[],
  adGroups: AdGroupEvidence[],
): { adGroupId?: string; keywordId?: string; sourceKeyword?: KeywordEvidence } {
  if (term.adGroupId || term.keywordId) {
    const sourceKeyword = keywords.find((keyword) => keyword.id === term.keywordId);
    return { adGroupId: term.adGroupId ?? sourceKeyword?.adGroupId, keywordId: term.keywordId ?? undefined, sourceKeyword };
  }
  const sourceText = normalizeAppleAdsText(term.sourceKeywordText);
  if (sourceText) {
    const matches = keywords.filter((keyword) =>
      !keyword.isDeleted && active(keyword.status) && normalizeAppleAdsText(keyword.keywordText) === sourceText
    );
    if (matches.length === 1) return { adGroupId: matches[0].adGroupId, keywordId: matches[0].id, sourceKeyword: matches[0] };
    const broadMatches = matches.filter((keyword) => /broad/i.test(keyword.matchType ?? ""));
    if (broadMatches.length === 1) return { adGroupId: broadMatches[0].adGroupId, keywordId: broadMatches[0].id, sourceKeyword: broadMatches[0] };
  }
  if (/auto|search.?match/i.test(term.matchSource ?? "")) {
    const matches = adGroups.filter((group) => !group.isDeleted && active(group.status) && group.searchMatchEnabled);
    if (matches.length === 1) return { adGroupId: matches[0].id };
  }
  return {};
}

function negativeAlreadyExists(term: string, adGroupId: string | undefined, negatives: NegativeKeywordEvidence[]) {
  const normalized = normalizeAppleAdsText(term);
  return negatives.some((negative) =>
    !negative.isDeleted &&
    active(negative.status) &&
    /exact/i.test(negative.matchType ?? "") &&
    normalizeAppleAdsText(negative.keywordText) === normalized &&
    (negative.adGroupId === null || negative.adGroupId === adGroupId)
  );
}

function aggregateTerms(rows: SearchTermEvidence[]) {
  const grouped = new Map<string, SearchTermEvidence>();
  for (const row of rows) {
    if (!isExplicitObservedSearchTerm(row.searchTerm)) continue;
    const key = [
      normalizeAppleAdsText(row.searchTerm),
      normalizeAppleAdsText(row.sourceKeywordText),
      normalizeAppleAdsText(row.matchSource),
      row.adGroupId ?? "",
      row.keywordId ?? "",
    ].join("|");
    const current = grouped.get(key) ?? {
      ...row,
      searchTerm: normalizeAppleAdsText(row.searchTerm),
      impressions: 0,
      taps: 0,
      installs: 0,
      spend: 0,
    };
    current.impressions += row.impressions;
    current.taps += row.taps;
    current.installs += row.installs;
    current.spend += row.spend;
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

export function assessAppleAdsEvidence(input: AssessmentInput): AppleAdsEvidenceAssessment {
  const threshold = input.directionalTapThreshold ?? DEFAULT_DIRECTIONAL_TAP_THRESHOLD;
  const actionable = input.dataFreshness === "fresh" && input.dataCompleteness === "complete";
  const terms = aggregateTerms(input.searchTerms);
  const classified = terms.map((term) => ({ term, relevance: classifySearchTermRelevance(term.searchTerm), scope: resolveScope(term, input.keywords, input.adGroups) }));
  const identifiableImpressions = classified.reduce((sum, item) => sum + item.term.impressions, 0);
  const irrelevant = classified.filter((item) => item.relevance.state === "irrelevant");
  const irrelevantImpressions = irrelevant.reduce((sum, item) => sum + item.term.impressions, 0);
  const irrelevantShare = identifiableImpressions ? irrelevantImpressions / identifiableImpressions : 0;
  const recommendations: AppleAdsEvidenceRecommendation[] = [];

  if (actionable) {
    for (const item of irrelevant) {
      if (!item.scope.adGroupId || negativeAlreadyExists(item.term.searchTerm, item.scope.adGroupId, input.negativeKeywords)) continue;
      const source = item.term.sourceKeywordText
        ? ` through ${item.scope.sourceKeyword && /broad/i.test(item.scope.sourceKeyword.matchType ?? "") ? "broad " : ""}\`${item.term.sourceKeywordText}\``
        : /auto|search.?match/i.test(item.term.matchSource ?? "") ? " through Search Match" : "";
      recommendations.push({
        type: "ADD_NEGATIVE_EXACT",
        targetType: "SEARCH_TERM",
        targetText: item.term.searchTerm,
        campaignId: input.campaignId,
        adGroupId: item.scope.adGroupId,
        keywordId: item.scope.keywordId,
        storefront: input.storefront,
        title: `Exclude “${item.term.searchTerm}”`,
        observation: `\`${item.term.searchTerm}\` appeared${source}.`,
        diagnosis: `The observed search intent is unrelated to ${input.appName}.`,
        proposedAction: `Add \`${item.term.searchTerm}\` as an exact negative keyword.`,
        confidence: "high",
        financialRisk: item.term.spend > 0 ? "medium" : "low",
        evidence: {
          impressions: item.term.impressions,
          taps: item.term.taps,
          installs: item.term.installs,
          spend: item.term.spend,
          currency: input.totals.currency,
          sourceKeyword: item.term.sourceKeywordText ?? undefined,
          matchType: item.scope.sourceKeyword?.matchType ?? item.term.matchSource ?? undefined,
        },
        evidenceQuality: quality({ freshness: input.dataFreshness, completeness: input.dataCompleteness, relevance: "irrelevant", taps: item.term.taps, confidence: "high" }),
        reviewCondition: "Reassess only if the app's product intent changes or this exact query is deliberately targeted later.",
      });
    }

    const broadGroups = new Map<string, typeof classified>();
    for (const item of classified) {
      if (!item.scope.sourceKeyword || !/broad/i.test(item.scope.sourceKeyword.matchType ?? "")) continue;
      const bucket = broadGroups.get(item.scope.sourceKeyword.id) ?? [];
      bucket.push(item);
      broadGroups.set(item.scope.sourceKeyword.id, bucket);
    }
    for (const [keywordId, items] of broadGroups) {
      const keyword = items[0].scope.sourceKeyword!;
      const totalImpressions = items.reduce((sum, item) => sum + item.term.impressions, 0);
      const bad = items.filter((item) => item.relevance.state === "irrelevant");
      const badImpressions = bad.reduce((sum, item) => sum + item.term.impressions, 0);
      const badTaps = bad.reduce((sum, item) => sum + item.term.taps, 0);
      const meaningful = totalImpressions > 0 && badImpressions / totalImpressions >= 0.5 && (bad.length >= 2 || badTaps > 0);
      if (!meaningful || !active(keyword.status) || keyword.isDeleted) continue;
      recommendations.push({
        type: "REVIEW_BROAD_KEYWORD",
        targetType: "KEYWORD",
        targetText: keyword.keywordText,
        campaignId: input.campaignId,
        adGroupId: keyword.adGroupId,
        keywordId,
        storefront: input.storefront,
        title: `Review broad “${keyword.keywordText}”`,
        observation: `The broad keyword generated predominantly unrelated identifiable traffic (${badImpressions} of ${totalImpressions} impressions across ${bad.length} unrelated terms).`,
        diagnosis: `The phrase is too ambiguous for the current ${input.appName} campaign and is attracting unrelated traffic.`,
        proposedAction: `Review and likely pause broad \`${keyword.keywordText}\`. No campaign change will be made automatically.`,
        confidence: "high",
        financialRisk: badTaps > 0 ? "medium" : "low",
        evidence: {
          impressions: totalImpressions,
          taps: items.reduce((sum, item) => sum + item.term.taps, 0),
          installs: items.reduce((sum, item) => sum + item.term.installs, 0),
          spend: items.reduce((sum, item) => sum + item.term.spend, 0),
          currency: input.totals.currency,
          sourceKeyword: keyword.keywordText,
          matchType: keyword.matchType ?? undefined,
        },
        evidenceQuality: quality({ freshness: input.dataFreshness, completeness: input.dataCompleteness, relevance: "irrelevant", taps: badTaps, confidence: "high" }),
        reviewCondition: "Review again after exact negatives are applied manually or after the next complete search-term window.",
      });
    }

    const appName = normalizeAppleAdsText(input.appName);
    const learningKeyword = input.keywords.filter((keyword) =>
      !keyword.isDeleted &&
      active(keyword.status) &&
      /exact/i.test(keyword.matchType ?? "") &&
      classifySearchTermRelevance(keyword.keywordText).state === "relevant"
    ).sort((left, right) => {
      const leftText = normalizeAppleAdsText(left.keywordText);
      const rightText = normalizeAppleAdsText(right.keywordText);
      const leftScore = appName.includes(leftText) ? 1 : 0;
      const rightScore = appName.includes(rightText) ? 1 : 0;
      return rightScore - leftScore || leftText.length - rightText.length || leftText.localeCompare(rightText);
    })[0];
    if (learningKeyword && input.totals.taps > 0 && input.totals.taps < threshold && input.totals.installs === 0) {
      recommendations.push({
        type: "CONTINUE_LEARNING",
        targetType: "KEYWORD",
        targetText: learningKeyword.keywordText,
        campaignId: input.campaignId,
        adGroupId: learningKeyword.adGroupId,
        keywordId: learningKeyword.id,
        storefront: input.storefront,
        title: `Continue learning on “${learningKeyword.keywordText}”`,
        observation: `The keyword is strongly relevant, while the campaign has only ${input.totals.taps} taps and no direct search-term evidence that justifies changing it.`,
        diagnosis: "There is not enough traffic to judge efficiency or conversion for this relevant term.",
        proposedAction: "Continue learning without pausing, scaling, or increasing the bid yet.",
        confidence: "medium",
        financialRisk: "low",
        evidence: { ...input.totals, sourceKeyword: learningKeyword.keywordText, matchType: learningKeyword.matchType ?? undefined },
        evidenceQuality: quality({ freshness: input.dataFreshness, completeness: input.dataCompleteness, relevance: "relevant", taps: input.totals.taps, confidence: "medium" }),
        reviewCondition: `Reassess after at least ${threshold} campaign taps or meaningful direct term evidence.`,
      });
    }
  }

  if (input.totals.installs === 0 && input.totals.taps < threshold) {
    recommendations.push({
      type: "INSUFFICIENT_CONVERSION_EVIDENCE",
      targetType: "CAMPAIGN",
      targetText: null,
      campaignId: input.campaignId,
      storefront: input.storefront,
      title: "Conversion evidence is insufficient",
      observation: `The campaign has ${input.totals.taps} taps and ${input.totals.installs} installs.`,
      diagnosis: `The sample is too small to evaluate App Store conversion; zero installs from ${input.totals.taps} taps is not evidence of conversion failure.`,
      proposedAction: "Wait for more relevant taps before judging the listing or product.",
      confidence: "high",
      financialRisk: "low",
      evidence: { ...input.totals },
      evidenceQuality: quality({
        freshness: input.dataFreshness,
        completeness: input.dataCompleteness,
        relevance: irrelevantShare >= 0.5 ? "mixed" : "unknown",
        taps: input.totals.taps,
        confidence: "high",
      }),
      reviewCondition: `Reassess when the campaign reaches at least ${threshold} relevant taps with complete, fresh data.`,
    });
  }

  const trafficQuality = identifiableImpressions === 0
    ? { state: "unknown" as const, confidence: "low" as const, explanation: "No explicit observed search terms are available; aggregate or privacy-suppressed rows cannot establish traffic relevance." }
    : irrelevantShare >= 0.5
      ? { state: "poor" as const, confidence: "high" as const, explanation: `${Math.round(irrelevantShare * 100)}% of identifiable search-term impressions were classified as unrelated.` }
      : irrelevantShare > 0
        ? { state: "mixed" as const, confidence: "medium" as const, explanation: `${Math.round(irrelevantShare * 100)}% of identifiable search-term impressions were classified as unrelated.` }
        : { state: "good" as const, confidence: "medium" as const, explanation: "No explicit observed search term was classified as unrelated." };

  return {
    appId: input.appId,
    appName: input.appName,
    storefront: input.storefront.toUpperCase(),
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    evidenceWindow: input.evidenceWindow,
    generatedAt: input.generatedAt,
    ruleVersion: APPLE_ADS_EVIDENCE_RULE_VERSION,
    dataFreshness: input.dataFreshness,
    dataCompleteness: input.dataCompleteness,
    trafficQuality,
    conversionEvidence: {
      state: input.totals.taps < threshold ? "insufficient" : input.totals.taps < threshold * 2 ? "directional" : "meaningful",
      tapCount: input.totals.taps,
      installCount: input.totals.installs,
      threshold,
      explanation: input.totals.taps < threshold
        ? `${input.totals.taps} taps are insufficient to judge App Store conversion. This is a product interpretation threshold, not a statistical-significance claim.`
        : "The campaign has enough taps for a directional conversion review.",
    },
    totals: input.totals,
    recommendations,
  };
}
