export type CrossSourceAgreementState = "agreement" | "conflict" | "unknown";
export type TrafficQualitySignal = "concern" | "healthy" | "unknown";
export type ConversionReadinessSignal = "not_judgable" | "judgable" | "unknown";
export type CrossSourceWindow = { start: string; end: string };

export type CrossSourceEvidence = {
  source: "Discovery" | "Apple Ads";
  appId: string | null;
  market: string | null;
  window: CrossSourceWindow | null;
  trafficQuality: TrafficQualitySignal;
  conversionReadiness: ConversionReadinessSignal;
};

export type CrossSourceAgreement = {
  state: CrossSourceAgreementState;
  label: "Agreement" | "Conflict" | "Unknown";
  explanation: string;
  overlapWindow: CrossSourceWindow | null;
  comparedQuestions: Array<"traffic_quality" | "conversion_readiness">;
};

type AppleAdsAgreementRow = {
  appId: string | null;
  storefront: string | null;
  type: string;
  evidenceWindow: CrossSourceWindow | null;
  evidenceQuality: {
    dataFreshness?: string;
    dataCompleteness?: string;
    trafficRelevance?: string;
    evidenceVolume?: string;
  } | null;
};

const labels: Record<CrossSourceAgreementState, CrossSourceAgreement["label"]> = {
  agreement: "Agreement",
  conflict: "Conflict",
  unknown: "Unknown",
};

function normalizedMarket(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function validWindow(window: { start: string | null; end: string | null } | null | undefined): window is CrossSourceWindow {
  return Boolean(window?.start && window?.end && window.start <= window.end);
}

function unknown(explanation: string): CrossSourceAgreement {
  return {
    state: "unknown",
    label: labels.unknown,
    explanation,
    overlapWindow: null,
    comparedQuestions: [],
  };
}

function overlap(left: CrossSourceWindow, right: CrossSourceWindow): CrossSourceWindow | null {
  const start = left.start > right.start ? left.start : right.start;
  const end = left.end < right.end ? left.end : right.end;
  return start <= end ? { start, end } : null;
}

function signalExplanation(question: "traffic_quality" | "conversion_readiness", value: string) {
  if (question === "traffic_quality") {
    return value === "concern" ? "acquisition traffic quality needs review" : "acquisition traffic quality appears healthy";
  }
  return value === "not_judgable" ? "conversion should not yet be judged" : "conversion has enough evidence for directional review";
}

export function assessCrossSourceAgreement(input: {
  discovery: CrossSourceEvidence;
  appleAds: CrossSourceEvidence;
}): CrossSourceAgreement {
  const discoveryMarket = normalizedMarket(input.discovery.market);
  const appleAdsMarket = normalizedMarket(input.appleAds.market);
  if (!input.discovery.appId || !input.appleAds.appId || input.discovery.appId !== input.appleAds.appId) {
    return unknown("The sources do not have the same exact app scope.");
  }
  if (!discoveryMarket || !appleAdsMarket || discoveryMarket !== appleAdsMarket) {
    return unknown("The sources do not have the same exact market scope.");
  }
  if (!validWindow(input.discovery.window) || !validWindow(input.appleAds.window)) {
    return unknown("Both sources need explicit evidence windows before they can be compared.");
  }
  const overlapWindow = overlap(input.discovery.window, input.appleAds.window);
  if (!overlapWindow) {
    return unknown(`The ${discoveryMarket} source windows do not overlap, so neither source can corroborate the other.`);
  }

  const comparisons: Array<{
    question: "traffic_quality" | "conversion_readiness";
    discovery: string;
    appleAds: string;
  }> = [];
  if (input.discovery.trafficQuality !== "unknown" && input.appleAds.trafficQuality !== "unknown") {
    comparisons.push({
      question: "traffic_quality",
      discovery: input.discovery.trafficQuality,
      appleAds: input.appleAds.trafficQuality,
    });
  }
  if (input.discovery.conversionReadiness !== "unknown" && input.appleAds.conversionReadiness !== "unknown") {
    comparisons.push({
      question: "conversion_readiness",
      discovery: input.discovery.conversionReadiness,
      appleAds: input.appleAds.conversionReadiness,
    });
  }
  if (!comparisons.length) {
    return {
      ...unknown("The source windows overlap, but they do not contain a shared decision question with sufficient independent evidence."),
      overlapWindow,
    };
  }

  const conflicts = comparisons.filter((comparison) => comparison.discovery !== comparison.appleAds);
  const state: CrossSourceAgreementState = conflicts.length ? "conflict" : "agreement";
  const comparedQuestions = comparisons.map((comparison) => comparison.question);
  const conclusions = comparisons.map((comparison) =>
    signalExplanation(comparison.question, comparison.discovery),
  );
  return {
    state,
    label: labels[state],
    explanation: state === "agreement"
      ? `Both sources independently indicate that ${conclusions.join(" and ")}.`
      : `The sources conflict on ${conflicts.map((comparison) => comparison.question === "traffic_quality" ? "traffic quality" : "conversion readiness").join(" and ")}; keep their conclusions separate.`,
    overlapWindow,
    comparedQuestions,
  };
}

export function discoveryAgreementEvidence(input: {
  appId?: string;
  market?: string;
  observedWindow: { start: string | null; end: string | null };
  freshness: string;
  completeness: string;
  volume: string;
  impressions: number;
  impressionToPageRate: number | null;
  hasDailyRows: boolean;
}): CrossSourceEvidence {
  const independentlyUsable =
    input.freshness === "fresh" &&
    input.completeness === "complete" &&
    input.volume !== "very_low";
  const trafficQuality: TrafficQualitySignal = independentlyUsable && input.impressions >= 50 && input.impressionToPageRate !== null
    ? input.impressionToPageRate < 0.05 ? "concern" : "healthy"
    : "unknown";
  const conversionReadiness: ConversionReadinessSignal = independentlyUsable
    ? input.hasDailyRows ? "judgable" : "not_judgable"
    : "unknown";
  return {
    source: "Discovery",
    appId: input.appId ?? null,
    market: normalizedMarket(input.market) || null,
    window: validWindow(input.observedWindow) ? input.observedWindow : null,
    trafficQuality,
    conversionReadiness,
  };
}

export function appleAdsAgreementEvidence(input: {
  appId?: string;
  market?: string;
  rows: AppleAdsAgreementRow[];
}): CrossSourceEvidence {
  const appId = input.appId ?? null;
  const market = normalizedMarket(input.market);
  const scoped = input.rows.filter((row) =>
    Boolean(appId) &&
    row.appId === appId &&
    normalizedMarket(row.storefront) === market,
  );
  const windows = [...new Map(scoped
    .filter((row) => validWindow(row.evidenceWindow))
    .map((row) => [`${row.evidenceWindow!.start}:${row.evidenceWindow!.end}`, row.evidenceWindow!]))
    .values()];
  const qualityReady = scoped.length > 0 && scoped.every((row) =>
    row.evidenceQuality?.dataFreshness === "fresh" &&
    row.evidenceQuality?.dataCompleteness === "complete",
  );
  const hasTrafficConcern = scoped.some((row) =>
    row.type === "ADD_NEGATIVE_EXACT" ||
    row.type === "REVIEW_BROAD_KEYWORD" ||
    row.evidenceQuality?.trafficRelevance === "irrelevant",
  );
  const hasRelevantTraffic = scoped.some((row) =>
    row.evidenceQuality?.trafficRelevance === "relevant",
  );
  const trafficQuality: TrafficQualitySignal = qualityReady
    ? hasTrafficConcern ? "concern" : hasRelevantTraffic ? "healthy" : "unknown"
    : "unknown";
  const hasInsufficientConversion = scoped.some((row) => row.type === "INSUFFICIENT_CONVERSION_EVIDENCE");
  const hasMeaningfulConversion = scoped.some((row) =>
    row.evidenceQuality?.evidenceVolume === "meaningful" &&
    row.type !== "INSUFFICIENT_CONVERSION_EVIDENCE",
  );
  const conversionReadiness: ConversionReadinessSignal = qualityReady
    ? hasInsufficientConversion ? "not_judgable" : hasMeaningfulConversion ? "judgable" : "unknown"
    : "unknown";
  return {
    source: "Apple Ads",
    appId,
    market: market || null,
    window: windows.length === 1 ? windows[0] : null,
    trafficQuality,
    conversionReadiness,
  };
}

export function formatCrossSourceAgreement(value: CrossSourceAgreement) {
  const overlapText = value.overlapWindow
    ? ` Compared overlap: ${value.overlapWindow.start} to ${value.overlapWindow.end}.`
    : "";
  return `${value.label} — ${value.explanation}${overlapText}`;
}
