import { it, expect } from "vitest";
import { normalizeTelemetry, telemetryReadiness } from "./telemetry-contract";
const mapping = {
  sourceAppId: "source-pois",
  app: "pois" as const,
  eventIdColumn: "event_id" as const,
  rowIdIsStableEventId: false,
};
const row = {
  app_id: "source-pois",
  environment: "prod",
  event_id: "1",
  client_event_time: "2026-10-01T10:00Z",
  received_at: "2026-10-01T10:01Z",
  event_name: "first_open",
  schema_version: 1,
  anonymous_id: "install",
  session_id: "session",
  country: "DE",
  properties: {
    email: "private@example.test",
    text: "private journal",
    revenue: 9,
    locale: "de-DE",
    cue: "gentle",
  },
};
it("minimizes properties and never interprets a client money property", () => {
  const r = normalizeTelemetry(row, mapping);
  expect(r.ok).toBe(true);
  if (r.ok)
    expect(r.event.properties).toEqual({ locale: "de-DE", cue: "gentle" });
});
it("does not silently turn unknown environment, timestamp or schema into live facts", () => {
  for (const change of [
    { environment: null },
    { client_event_time: null },
    { schema_version: undefined },
    { app_id: "another-app" },
  ])
    expect(normalizeTelemetry({ ...row, ...change }, mapping).ok).toBe(false);
});
it("requires evidence before database row IDs become deduplication keys", () => {
  expect(
    normalizeTelemetry(
      { ...row, id: "database-row" },
      { ...mapping, eventIdColumn: "id" },
    ).ok,
  ).toBe(false);
});
it("missing identity or incomplete partitions block live funnel readiness", () => {
  const valid = normalizeTelemetry(row, mapping),
    missing = normalizeTelemetry({ ...row, anonymous_id: null }, mapping);
  expect(telemetryReadiness([valid], true).canReportInstallFunnel).toBe(true);
  expect(telemetryReadiness([valid], false).canReportInstallFunnel).toBe(false);
  expect(telemetryReadiness([missing], true).canReportInstallFunnel).toBe(
    false,
  );
});
