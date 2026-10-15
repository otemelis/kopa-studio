import { describe, expect, it } from "vitest";
import { buildProductReport, sessionFunnel, sessionJourney } from "./engine";
import {
  parseProductScope,
  localSnapshotEnabled,
  localRequestAllowed,
  type ProductEvent,
} from "./contracts";
const cutoff = "2026-10-15T06:40:58.000Z";
const scope = parseProductScope(
  new URLSearchParams("start=2026-10-01&end=2026-10-14"),
  cutoff,
);
const event = (
  name: string,
  time: string,
  changes: Partial<ProductEvent> = {},
): ProductEvent => ({
  id: name + time,
  app: "innertype",
  environment: "prod",
  name,
  anonymousId: "fragment-a",
  sessionId: "recorded-session-a",
  time: `2026-10-01T${time}Z`,
  received: "2026-10-02T00:00:00Z",
  country: "DE",
  version: "1",
  platform: "ios",
  osVersion: "18",
  properties: { assessment_type: "type", language: "en", source: "organic" },
  ...changes,
});
const manifest = {
  project: "test",
  app: "innertype",
  cutoff,
  verifiedStableRead: true,
  tables: { events: { rows: 3, sha256: "test" } },
};
const w = [
  Date.parse("2026-10-01"),
  Date.parse("2026-10-15"),
  Date.parse(cutoff),
] as const;
describe("observed real telemetry contract", () => {
  it("counts fragmented anonymous IDs as one recorded session without claiming people", () => {
    const es = [
      event("assessment_started", "01:00:00"),
      event("assessment_completed", "01:10:00", { anonymousId: "fragment-b" }),
      event("result_viewed", "01:11:00", { anonymousId: "fragment-c" }),
    ];
    const report = buildProductReport(es, [], manifest, scope);
    expect(report.funnel.steps.map((s) => s.sessions)).toEqual([1, 1, 1]);
    expect(report.quality.fragmentedSessions).toBe(1);
    expect(report.quality.anonymousIds).toBe(3);
    expect(report.quality.userMetricsAvailable).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/fragment-a|recorded-session-a/);
  });
  it("does not cross assessment types, but accepts a later valid attempt in the same session", () => {
    const es = [
      event("assessment_started", "01:00:00"),
      event("assessment_completed", "01:10:00", {
        properties: { assessment_type: "relationship" },
      }),
      event("result_viewed", "01:11:00", {
        properties: { assessment_type: "relationship" },
      }),
    ];
    expect(sessionFunnel(es, scope, ...w).steps.map((s) => s.sessions)).toEqual(
      [1, 0, 0],
    );
    es.push(
      event("assessment_started", "01:05:00", {
        properties: { assessment_type: "relationship" },
      }),
    );
    expect(sessionFunnel(es, scope, ...w).steps.map((s) => s.sessions)).toEqual(
      [1, 1, 1],
    );
  });
  it("preserves raw retry candidates without inflating session funnels", () => {
    const start = event("assessment_started", "01:00:00");
    const report = buildProductReport(
      [start, { ...start, id: "retry", received: "2026-10-03T00:00:00Z" }],
      [],
      manifest,
      scope,
    );
    expect(report.metrics.events).toBe(2);
    expect(report.quality.possibleDuplicateRows).toBe(1);
    expect(report.funnel.steps[0].sessions).toBe(1);
  });
  it("does not fabricate equal-time ordering or backfill missing start events", () => {
    const es = [
      event("assessment_completed", "01:00:00"),
      event("assessment_started", "01:00:00"),
      event("result_viewed", "01:01:00"),
    ];
    expect(sessionFunnel(es, scope, ...w).steps.map((s) => s.sessions)).toEqual(
      [1, 0, 0],
    );
    expect(sessionJourney(es, scope, ...w).children[0].name).toBe(
      "Ambiguous event order",
    );
    expect(
      sessionFunnel(
        es.filter((e) => e.name !== "assessment_started"),
        scope,
        ...w,
      ).steps[0].sessions,
    ).toBe(0);
  });
  it("honors entry dates, the following 24-hour window and right censoring", () => {
    const es = [
      event("assessment_started", "23:55:00", { time: "2026-10-14T23:55:00Z" }),
      event("assessment_completed", "00:01:00", {
        time: "2026-10-15T00:01:00Z",
      }),
      event("result_viewed", "00:01:00", { time: "2026-10-16T00:01:00Z" }),
    ];
    const result = sessionFunnel(es, scope, ...w);
    expect(result.steps.map((s) => s.sessions)).toEqual([1, 1, 0]);
    expect(result.censored).toBe(1);
  });
  it("marks a session provisional when a later qualifying entry still has an open horizon", () => {
    const es = [
      event("assessment_started", "01:00:00", { time: "2026-10-13T01:00:00Z" }),
      event("assessment_started", "23:00:00", { time: "2026-10-14T23:00:00Z" }),
    ];
    expect(sessionFunnel(es, scope, ...w).censored).toBe(1);
  });
  it("keeps prod/app scope isolated and treats absent days as gaps", () => {
    const es = [
      event("app_opened", "01:00:00"),
      event("app_opened", "01:00:01", { environment: "dev" }),
      event("app_opened", "01:00:02", { app: "other" }),
    ];
    const report = buildProductReport(es, [], manifest, scope);
    expect(report.metrics.events).toBe(1);
    expect(report.trend[1].events).toBeNull();
    expect(report.trend[0].events).toBe(1);
  });
  it("applies captured-event segmentation and retains source definitions in exports", () => {
    const report = buildProductReport(
      [
        event("app_opened", "01:00:00"),
        event("app_opened", "01:00:02", { country: "US" }),
      ],
      [],
      manifest,
      { ...scope, country: "US" },
    );
    expect(report.metrics.events).toBe(1);
    expect(report.scope.country).toBe("US");
    expect(report.source.mode).toBe("restored-read-only-snapshot");
    expect(report.quality.schemaVersion).toBe("legacy-unversioned");
  });
  it("conserves journey branch sessions and labels observation boundaries", () => {
    const es = [
      event("assessment_started", "01:00:00"),
      event("assessment_started", "01:00:00", { sessionId: "b" }),
      event("assessment_completed", "01:10:00"),
    ];
    const root = sessionJourney(es, scope, ...w);
    expect(root.children.reduce((sum, child) => sum + child.sessions, 0)).toBe(
      root.sessions,
    );
    expect(root.children.some((c) => c.name === "No next recorded step")).toBe(
      true,
    );
  });
  it("rejects invalid windows, other apps and production preview enablement", () => {
    expect(() =>
      parseProductScope(new URLSearchParams("start=2026-02-30"), cutoff),
    ).toThrow();
    expect(() =>
      parseProductScope(
        new URLSearchParams("start=2026-10-14&end=2026-10-13"),
        cutoff,
      ),
    ).toThrow();
    expect(() =>
      buildProductReport([], [], manifest, { ...scope, app: "pois" }),
    ).toThrow();
    expect(
      localSnapshotEnabled({
        NODE_ENV: "production",
        KOPA_SIGNAL_UI: "1",
        KOPA_SIGNAL_LOCAL_READONLY: "1",
      }),
    ).toBe(false);
    expect(localRequestAllowed("127.0.0.1:4339", "https://evil.example")).toBe(
      false,
    );
    expect(localRequestAllowed("evil.example:4339", null)).toBe(false);
    expect(localRequestAllowed("127.0.0.1:4339", "http://127.0.0.1:4339")).toBe(
      true,
    );
  });
});
