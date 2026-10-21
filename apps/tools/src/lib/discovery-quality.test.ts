import { describe, expect, it } from "vitest";
import { assessDiscoveryEvidenceQuality, type DiscoveryReportQualityInput } from "./discovery-quality";

const NOW = new Date("2026-07-31T12:00:00.000Z");
const success: DiscoveryReportQualityInput = {
  resultState: "success",
  parserVersion: "discovery-v2",
  evidenceStart: "2026-07-24",
  evidenceEnd: "2026-07-28",
  sourceRowCount: 183,
  importedRowCount: 183,
  rejectedRowCount: 0,
  lastError: null,
};

describe("Discovery evidence quality", () => {
  it("accepts complete versioned evidence inside the freshness threshold", () => {
    expect(assessDiscoveryEvidenceQuality({ requests: [success], scopedRowCount: 10, now: NOW }))
      .toMatchObject({ state: "fresh", label: "Fresh", parserVersion: "discovery-v2", evidenceEnd: "2026-07-28" });
  });

  it("marks otherwise valid evidence stale after three calendar days", () => {
    expect(assessDiscoveryEvidenceQuality({
      requests: [{ ...success, evidenceEnd: "2026-07-27" }],
      scopedRowCount: 10,
      now: NOW,
    })).toMatchObject({ state: "stale", label: "Stale" });
  });

  it("blocks partial imports even when valid rows were retained", () => {
    expect(assessDiscoveryEvidenceQuality({
      requests: [{ ...success, resultState: "partial", sourceRowCount: 184, rejectedRowCount: 1 }],
      scopedRowCount: 10,
      now: NOW,
    })).toMatchObject({ state: "partial", label: "Partial" });
  });

  it("distinguishes a valid zero-row report from zero traffic", () => {
    expect(assessDiscoveryEvidenceQuality({
      requests: [{ ...success, resultState: "zero", evidenceStart: null, evidenceEnd: null, sourceRowCount: 0, importedRowCount: 0 }],
      scopedRowCount: 0,
      now: NOW,
    })).toMatchObject({ state: "zero", label: "Valid zero-row report" });
  });

  it("marks parser errors and unverified parser versions invalid", () => {
    expect(assessDiscoveryEvidenceQuality({
      requests: [{ ...success, resultState: "error", lastError: "Missing required columns" }],
      scopedRowCount: 10,
      now: NOW,
    })).toMatchObject({ state: "invalid", label: "Invalid" });
    expect(assessDiscoveryEvidenceQuality({
      requests: [{ ...success, parserVersion: "discovery-v1" }],
      scopedRowCount: 10,
      now: NOW,
    })).toMatchObject({ state: "invalid", label: "Invalid" });
  });

  it("marks missing requests or missing scoped rows absent", () => {
    expect(assessDiscoveryEvidenceQuality({ requests: [], scopedRowCount: 0, now: NOW }))
      .toMatchObject({ state: "absent", label: "Absent" });
    expect(assessDiscoveryEvidenceQuality({ requests: [success], scopedRowCount: 0, now: NOW }))
      .toMatchObject({ state: "absent", label: "Absent" });
  });
});
