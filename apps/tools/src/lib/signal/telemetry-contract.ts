import type { EventFact, SampleApp } from "./contracts";
export type TelemetryRow = Record<string, unknown>;
export type TelemetryMapping = {
  sourceAppId: string;
  app: SampleApp;
  eventIdColumn: "event_id" | "id";
  rowIdIsStableEventId: boolean;
};
export type TelemetryResult =
  | { ok: true; event: EventFact }
  | { ok: false; reason: string };
/** No aliases, received-time substitution, user merges or settled-revenue inference. */
export function normalizeTelemetry(
  row: TelemetryRow,
  mapping: TelemetryMapping,
): TelemetryResult {
  if (row.app_id !== mapping.sourceAppId)
    return { ok: false, reason: "App mapping mismatch" };
  if (row.environment !== "prod" && row.environment !== "production")
    return { ok: false, reason: "Non-production or unknown environment" };
  if (mapping.eventIdColumn === "id" && !mapping.rowIdIsStableEventId)
    return {
      ok: false,
      reason: "Database row ID is not a validated deduplication key",
    };
  const eventId = row[mapping.eventIdColumn];
  if (typeof eventId !== "string" || !eventId)
    return { ok: false, reason: "Stable event ID unavailable" };
  if (
    typeof row.client_event_time !== "string" ||
    !Number.isFinite(Date.parse(row.client_event_time))
  )
    return { ok: false, reason: "Valid client event timestamp required" };
  if (
    typeof row.received_at === "string" &&
    Date.parse(row.client_event_time) > Date.parse(row.received_at) + 86400000
  )
    return { ok: false, reason: "Future client clock exceeds allowed skew" };
  if (
    typeof row.event_name !== "string" ||
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(row.event_name)
  )
    return { ok: false, reason: "Event name invalid" };
  if (
    typeof row.schema_version !== "number" ||
    !Number.isInteger(row.schema_version) ||
    row.schema_version < 1
  )
    return { ok: false, reason: "Versioned event schema required" };
  if (row.country !== "DE" && row.country !== "US")
    return { ok: false, reason: "Requested market not supported or captured" };
  const properties =
    row.properties &&
    typeof row.properties === "object" &&
    !Array.isArray(row.properties)
      ? (row.properties as Record<string, unknown>)
      : {};
  const safe: EventFact["properties"] = {};
  if (
    typeof properties.locale === "string" &&
    /^[a-z]{2}[-_][A-Z]{2}$/.test(properties.locale)
  )
    safe.locale = properties.locale;
  if (
    typeof properties.cue === "string" &&
    ["gentle", "standard", "strong"].includes(properties.cue)
  )
    safe.cue = properties.cue;
  return {
    ok: true,
    event: {
      id: eventId,
      app: mapping.app,
      name: row.event_name,
      at: new Date(row.client_event_time).toISOString(),
      environment: "prod",
      installId:
        typeof row.anonymous_id === "string" && row.anonymous_id
          ? row.anonymous_id
          : null,
      sessionId:
        typeof row.session_id === "string" && row.session_id
          ? row.session_id
          : null,
      version:
        typeof row.app_version === "string"
          ? row.app_version.slice(0, 40)
          : "unknown",
      country: row.country,
      schemaVersion: row.schema_version,
      properties: safe,
    },
  };
}
export function telemetryReadiness(
  results: TelemetryResult[],
  complete: boolean,
) {
  const valid = results
      .filter((r): r is Extract<TelemetryResult, { ok: true }> => r.ok)
      .map((r) => r.event),
    missingInstall = valid.filter((e) => !e.installId).length,
    missingSession = valid.filter((e) => !e.sessionId).length;
  return {
    received: results.length,
    accepted: valid.length,
    rejected: results.length - valid.length,
    missingInstall,
    missingSession,
    canReportInstallFunnel:
      complete &&
      valid.length > 0 &&
      missingInstall === 0 &&
      results.every((r) => r.ok),
    canReportSessionFunnel:
      complete &&
      valid.length > 0 &&
      missingInstall === 0 &&
      missingSession === 0 &&
      results.every((r) => r.ok),
  };
}
