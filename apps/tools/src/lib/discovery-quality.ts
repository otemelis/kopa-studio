export const DISCOVERY_PARSER_VERSION = "discovery-v2";
export const DISCOVERY_FRESHNESS_DAYS = 3;

export type DiscoveryEvidenceQualityState = "fresh" | "stale" | "partial" | "zero" | "invalid" | "absent";

export type DiscoveryReportQualityInput = {
  resultState: "success" | "zero" | "partial" | "error" | null;
  parserVersion: string | null;
  evidenceStart: string | null;
  evidenceEnd: string | null;
  sourceRowCount: number | null;
  importedRowCount: number | null;
  rejectedRowCount: number | null;
  lastError: string | null;
};

export type DiscoveryEvidenceQuality = {
  state: DiscoveryEvidenceQualityState;
  label: string;
  explanation: string;
  parserVersion: string | null;
  evidenceEnd: string | null;
};

const labels: Record<DiscoveryEvidenceQualityState, string> = {
  fresh: "Fresh",
  stale: "Stale",
  partial: "Partial",
  zero: "Valid zero-row report",
  invalid: "Invalid",
  absent: "Absent",
};

function quality(
  state: DiscoveryEvidenceQualityState,
  explanation: string,
  request?: DiscoveryReportQualityInput,
): DiscoveryEvidenceQuality {
  return {
    state,
    label: labels[state],
    explanation,
    parserVersion: request?.parserVersion ?? null,
    evidenceEnd: request?.evidenceEnd ?? null,
  };
}

function calendarAgeInDays(date: string, now: Date): number {
  const evidenceDate = new Date(`${date}T00:00:00.000Z`);
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Math.max(0, Math.floor((today.getTime() - evidenceDate.getTime()) / 86_400_000));
}

export function assessDiscoveryEvidenceQuality(input: {
  requests: DiscoveryReportQualityInput[];
  scopedRowCount: number;
  now?: Date;
}): DiscoveryEvidenceQuality {
  const now = input.now ?? new Date();
  if (!input.requests.length) {
    return quality("absent", "No App Store Connect Discovery report result exists for the selected app.");
  }

  const invalid = input.requests.find((request) =>
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
  if (invalid) {
    return quality(
      "invalid",
      invalid.lastError ?? `The latest Discovery evidence does not have verified ${DISCOVERY_PARSER_VERSION} provenance.`,
      invalid,
    );
  }

  const partial = input.requests.find((request) =>
    request.resultState === "partial" ||
    Number(request.rejectedRowCount ?? 0) > 0 ||
    (
      request.sourceRowCount !== null &&
      request.importedRowCount !== null &&
      request.importedRowCount < request.sourceRowCount
    ),
  );
  if (partial) {
    return quality(
      "partial",
      `The latest Discovery import accepted ${partial.importedRowCount ?? 0} of ${partial.sourceRowCount ?? 0} source rows and rejected ${partial.rejectedRowCount ?? 0}. Wait for a complete import before acting.`,
      partial,
    );
  }

  const zero = input.requests.find((request) => request.resultState === "zero");
  if (zero) {
    return quality(
      "zero",
      "Apple returned a valid Discovery report with zero evidence rows. This is not evidence of zero traffic or failed conversion.",
      zero,
    );
  }

  const pending = input.requests.find((request) => request.resultState !== "success");
  if (pending || input.scopedRowCount === 0) {
    return quality(
      "absent",
      "No successful Discovery evidence rows exist for the selected app, market, and period.",
      pending ?? input.requests[0],
    );
  }

  const stale = input.requests.find((request) =>
    request.evidenceEnd && calendarAgeInDays(request.evidenceEnd, now) > DISCOVERY_FRESHNESS_DAYS,
  );
  if (stale) {
    return quality(
      "stale",
      `The latest valid Discovery evidence ends on ${stale.evidenceEnd}, more than ${DISCOVERY_FRESHNESS_DAYS} days ago. Refresh the import before acting.`,
      stale,
    );
  }

  const latestEvidenceEnd = input.requests
    .map((request) => request.evidenceEnd)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1) ?? null;
  const sourceRows = input.requests.reduce((sum, request) => sum + Number(request.sourceRowCount ?? 0), 0);
  return quality(
    "fresh",
    `Verified ${DISCOVERY_PARSER_VERSION} evidence through ${latestEvidenceEnd}; ${sourceRows} source rows were accepted with none rejected.`,
    { ...input.requests[0], evidenceEnd: latestEvidenceEnd },
  );
}
