import { DISCOVERY_FRESHNESS_DAYS, DISCOVERY_PARSER_VERSION, type DiscoveryEvidenceQuality, type DiscoveryReportQualityInput } from "./discovery-quality";
import { discoveryQueryStart, normalizeDiscoveryDays, type DiscoveryEvidenceWindow } from "./discovery-period";

export type DiscoveryFreshnessState = "fresh" | "stale" | "unknown";
export type DiscoveryCompletenessState = "complete" | "partial" | "zero" | "invalid" | "absent";
export type DiscoveryWindowAlignmentState = "aligned" | "partial" | "out_of_window" | "unknown";
export type DiscoveryEvidenceVolumeState = "very_low" | "directional" | "meaningful";

export type DiscoveryEvidenceSufficiency = {
  requestedDays: number;
  requestedWindow: { start: string; end: string };
  importedWindow: DiscoveryEvidenceWindow;
  observedWindow: DiscoveryEvidenceWindow;
  observedDays: number;
  freshness: {
    state: DiscoveryFreshnessState;
    label: string;
    explanation: string;
  };
  completeness: {
    state: DiscoveryCompletenessState;
    label: string;
    sourceRows: number;
    importedRows: number;
    rejectedRows: number;
    explanation: string;
  };
  windowAlignment: {
    state: DiscoveryWindowAlignmentState;
    label: string;
    explanation: string;
  };
  volume: {
    state: DiscoveryEvidenceVolumeState;
    label: string;
    impressions: number;
    pageViews: number;
    downloads: number;
    explanation: string;
  };
  decisionReady: boolean;
  waitingTitle: string | null;
  waitingExplanation: string | null;
};

function today(now: Date) {
  return now.toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function calendarAgeInDays(date: string, now: Date): number {
  return Math.max(0, Math.floor((
    new Date(`${today(now)}T00:00:00.000Z`).getTime() -
    new Date(`${date}T00:00:00.000Z`).getTime()
  ) / 86_400_000));
}

function windowFromDates(dates: Array<string | null | undefined>): DiscoveryEvidenceWindow {
  const ordered = dates.filter((date): date is string => Boolean(date)).sort();
  return { start: ordered[0] ?? null, end: ordered.at(-1) ?? null };
}

const completenessLabels: Record<DiscoveryCompletenessState, string> = {
  complete: "Complete import",
  partial: "Partial import",
  zero: "Valid zero-row report",
  invalid: "Invalid import",
  absent: "No scoped evidence",
};

const freshnessLabels: Record<DiscoveryFreshnessState, string> = {
  fresh: "Fresh",
  stale: "Stale",
  unknown: "Unknown",
};

const alignmentLabels: Record<DiscoveryWindowAlignmentState, string> = {
  aligned: "Aligned",
  partial: "Partial coverage",
  out_of_window: "Out of window",
  unknown: "Unknown",
};

const volumeLabels: Record<DiscoveryEvidenceVolumeState, string> = {
  very_low: "Very low",
  directional: "Directional",
  meaningful: "Meaningful",
};

function assessVolume(input: { impressions: number; pageViews: number; downloads: number; observedDays: number }) {
  const state: DiscoveryEvidenceVolumeState =
    input.observedDays < 2 || (input.impressions < 50 && input.pageViews < 5 && input.downloads < 2)
      ? "very_low"
      : input.impressions < 300 && input.pageViews < 20 && input.downloads < 10
        ? "directional"
        : "meaningful";
  const explanations: Record<DiscoveryEvidenceVolumeState, string> = {
    very_low: "The scoped window has too little observed traffic for a directional Discovery conclusion.",
    directional: "The scoped traffic can support directional interpretation, not a statistical claim.",
    meaningful: "The scoped traffic is large enough for the current deterministic Discovery checks.",
  };
  return {
    state,
    label: volumeLabels[state],
    impressions: input.impressions,
    pageViews: input.pageViews,
    downloads: input.downloads,
    explanation: explanations[state],
  };
}

export function assessDiscoveryEvidenceSufficiency(input: {
  days: number;
  requests: DiscoveryReportQualityInput[];
  observedDates: string[];
  quality: DiscoveryEvidenceQuality;
  totals: { impressions: number; pageViews: number; downloads: number };
  now?: Date;
}): DiscoveryEvidenceSufficiency {
  const now = input.now ?? new Date();
  const requestedDays = normalizeDiscoveryDays(input.days);
  const requestedWindow = { start: discoveryQueryStart(requestedDays, now), end: today(now) };
  const importedStarts = windowFromDates(input.requests.map((request) => request.evidenceStart));
  const importedEnds = windowFromDates(input.requests.map((request) => request.evidenceEnd));
  const importedWindow = {
    start: importedStarts.start,
    end: importedEnds.end,
  };
  const observedDates = [...new Set(input.observedDates)].sort();
  const observedWindow = windowFromDates(observedDates);
  const observedDays = observedDates.length;
  const latestEvidenceEnd = observedWindow.end ?? importedWindow.end;
  const freshnessState: DiscoveryFreshnessState = latestEvidenceEnd
    ? calendarAgeInDays(latestEvidenceEnd, now) <= DISCOVERY_FRESHNESS_DAYS ? "fresh" : "stale"
    : "unknown";
  const freshness = {
    state: freshnessState,
    label: freshnessLabels[freshnessState],
    explanation: latestEvidenceEnd
      ? freshnessState === "fresh"
        ? `Latest evidence ends on ${latestEvidenceEnd}, within the ${DISCOVERY_FRESHNESS_DAYS}-day reporting allowance.`
        : `Latest evidence ends on ${latestEvidenceEnd}, outside the ${DISCOVERY_FRESHNESS_DAYS}-day reporting allowance.`
      : "No valid evidence end date is available.",
  };

  const sourceRows = input.requests.reduce((sum, request) => sum + Number(request.sourceRowCount ?? 0), 0);
  const importedRows = input.requests.reduce((sum, request) => sum + Number(request.importedRowCount ?? 0), 0);
  const rejectedRows = input.requests.reduce((sum, request) => sum + Number(request.rejectedRowCount ?? 0), 0);
  const invalidRequest = input.requests.find((request) =>
    request.resultState === "error" ||
    Boolean(request.lastError) ||
    request.parserVersion !== DISCOVERY_PARSER_VERSION ||
    (request.resultState === "success" && (
      !request.evidenceStart ||
      !request.evidenceEnd ||
      request.sourceRowCount === null ||
      request.importedRowCount === null
    )),
  );
  const partialRequest = input.requests.find((request) =>
    request.resultState === "partial" ||
    Number(request.rejectedRowCount ?? 0) > 0 ||
    (
      request.sourceRowCount !== null &&
      request.importedRowCount !== null &&
      request.importedRowCount < request.sourceRowCount
    ),
  );
  const completenessState: DiscoveryCompletenessState = !input.requests.length
    ? "absent"
    : invalidRequest
      ? "invalid"
      : partialRequest
        ? "partial"
        : input.requests.some((request) => request.resultState === "zero")
          ? "zero"
          : input.requests.some((request) => request.resultState === "success")
            ? "complete"
            : "absent";
  const completeness = {
    state: completenessState,
    label: completenessLabels[completenessState],
    sourceRows,
    importedRows,
    rejectedRows,
    explanation: completenessState === "complete"
      ? `${importedRows} of ${sourceRows} source rows were imported with ${rejectedRows} rejected.`
      : input.quality.explanation,
  };

  const comparableWindows = [importedWindow, observedWindow].filter(
    (window): window is { start: string; end: string } => Boolean(window.start && window.end),
  );
  let windowAlignmentState: DiscoveryWindowAlignmentState = "unknown";
  if (observedWindow.start && observedWindow.end && comparableWindows.length) {
    const overlaps = comparableWindows.map((window) =>
      window.end >= requestedWindow.start && window.start <= requestedWindow.end,
    );
    if (overlaps.some((overlap) => !overlap)) {
      windowAlignmentState = "out_of_window";
    } else {
      const latestAcceptedEnd = shiftDate(requestedWindow.end, -DISCOVERY_FRESHNESS_DAYS);
      windowAlignmentState = comparableWindows.every((window) =>
        window.start <= requestedWindow.start && window.end >= latestAcceptedEnd,
      ) ? "aligned" : "partial";
    }
  }
  const windowAlignment = {
    state: windowAlignmentState,
    label: alignmentLabels[windowAlignmentState],
    explanation: windowAlignmentState === "aligned"
      ? `Imported and scoped evidence cover the ${requestedDays}-day request within the reporting allowance.`
      : windowAlignmentState === "partial"
        ? `Available evidence overlaps the ${requestedDays}-day request but does not cover its full decision window.`
        : windowAlignmentState === "out_of_window"
          ? `Available evidence does not overlap the ${requestedDays}-day request.`
          : `Evidence-window alignment cannot be verified for the ${requestedDays}-day request.`,
  };

  const volume = assessVolume({ ...input.totals, observedDays });
  const decisionReady =
    freshness.state === "fresh" &&
    completeness.state === "complete" &&
    observedDays > 0 &&
    windowAlignment.state === "aligned" &&
    volume.state !== "very_low";

  const incompleteTitles: Record<Exclude<DiscoveryCompletenessState, "complete">, string> = {
    partial: "Discovery import is partial",
    zero: "Discovery report contains no evidence rows",
    invalid: "Discovery evidence is invalid",
    absent: "Waiting for scoped Discovery evidence",
  };
  const blocker = !decisionReady
    ? freshness.state === "stale"
      ? ["Discovery evidence is stale", freshness.explanation]
      : completeness.state !== "complete"
        ? [incompleteTitles[completeness.state], completeness.explanation]
        : observedDays === 0
          ? ["Waiting for scoped Discovery evidence", "No successful Discovery evidence rows exist for the selected app, market, and period."]
        : windowAlignment.state === "out_of_window"
          ? ["Discovery evidence is outside the requested period", windowAlignment.explanation]
          : windowAlignment.state !== "aligned"
            ? ["Discovery evidence only partially covers the requested period", windowAlignment.explanation]
            : volume.state === "very_low"
              ? ["Discovery evidence volume is very low", volume.explanation]
              : ["Waiting for sufficient Discovery evidence", "The scoped evidence is not ready for a directional conclusion."]
    : null;

  return {
    requestedDays,
    requestedWindow,
    importedWindow,
    observedWindow,
    observedDays,
    freshness,
    completeness,
    windowAlignment,
    volume,
    decisionReady,
    waitingTitle: blocker?.[0] ?? null,
    waitingExplanation: blocker?.[1] ?? null,
  };
}

export function formatDiscoveryEvidenceSufficiency(assessment: DiscoveryEvidenceSufficiency): string {
  const window = (value: DiscoveryEvidenceWindow) => value.start && value.end ? `${value.start} to ${value.end}` : "unavailable";
  return [
    `Requested: ${assessment.requestedDays} days (${assessment.requestedWindow.start} to ${assessment.requestedWindow.end})`,
    `Imported: ${window(assessment.importedWindow)}`,
    `Scoped: ${window(assessment.observedWindow)} (${assessment.observedDays} observed day${assessment.observedDays === 1 ? "" : "s"})`,
    `Freshness: ${assessment.freshness.label}`,
    `Completeness: ${assessment.completeness.label} (${assessment.completeness.importedRows}/${assessment.completeness.sourceRows} rows; ${assessment.completeness.rejectedRows} rejected)`,
    `Period coverage: ${assessment.windowAlignment.label}`,
    `Evidence volume: ${assessment.volume.label} (${assessment.volume.impressions} impressions; ${assessment.volume.pageViews} page views; ${assessment.volume.downloads} downloads)`,
  ].join(" · ");
}
