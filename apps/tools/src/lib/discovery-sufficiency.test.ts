import { describe, expect, it } from "vitest";
import { assessDiscoveryEvidenceSufficiency, formatDiscoveryEvidenceSufficiency } from "./discovery-sufficiency";
import type { DiscoveryEvidenceQuality, DiscoveryReportQualityInput } from "./discovery-quality";

const NOW = new Date("2026-07-31T12:00:00.000Z");
const request: DiscoveryReportQualityInput = {
  resultState: "success",
  parserVersion: "discovery-v2",
  evidenceStart: "2026-07-24",
  evidenceEnd: "2026-07-29",
  sourceRowCount: 244,
  importedRowCount: 244,
  rejectedRowCount: 0,
  lastError: null,
};
const quality: DiscoveryEvidenceQuality = {
  state: "fresh",
  label: "Fresh",
  explanation: "Verified evidence.",
  parserVersion: "discovery-v2",
  evidenceEnd: "2026-07-29",
};
const productionShaped = {
  requests: [request],
  observedDates: ["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28"],
  quality,
  totals: { impressions: 2340, pageViews: 12, downloads: 0 },
  now: NOW,
};

describe("Discovery evidence sufficiency", () => {
  it("keeps a recent imported window aligned to a seven-day request within the reporting allowance", () => {
    const result = assessDiscoveryEvidenceSufficiency({
      ...productionShaped,
      days: 7,
      observedDates: productionShaped.observedDates.filter((date) => date >= "2026-07-25"),
      totals: { impressions: 2331, pageViews: 12, downloads: 0 },
    });

    expect(result).toMatchObject({
      requestedWindow: { start: "2026-07-25", end: "2026-07-31" },
      importedWindow: { start: "2026-07-24", end: "2026-07-29" },
      observedWindow: { start: "2026-07-25", end: "2026-07-28" },
      observedDays: 4,
      freshness: { state: "fresh" },
      completeness: { state: "complete" },
      windowAlignment: { state: "aligned" },
      volume: { state: "meaningful" },
      decisionReady: true,
    });
  });

  it("keeps the same imported rows isolated and waiting for a 28-day request", () => {
    const result = assessDiscoveryEvidenceSufficiency({ ...productionShaped, days: 28 });

    expect(result).toMatchObject({
      requestedWindow: { start: "2026-07-04", end: "2026-07-31" },
      observedWindow: { start: "2026-07-24", end: "2026-07-28" },
      windowAlignment: { state: "partial" },
      decisionReady: false,
      waitingTitle: "Discovery evidence only partially covers the requested period",
    });
  });

  it("blocks stale evidence independently of complete import and meaningful volume", () => {
    const result = assessDiscoveryEvidenceSufficiency({
      ...productionShaped,
      days: 7,
      requests: [{ ...request, evidenceStart: "2026-07-20", evidenceEnd: "2026-07-27" }],
      observedDates: ["2026-07-25", "2026-07-26", "2026-07-27"],
    });

    expect(result).toMatchObject({
      freshness: { state: "stale" },
      completeness: { state: "complete" },
      volume: { state: "meaningful" },
      decisionReady: false,
      waitingTitle: "Discovery evidence is stale",
    });
  });

  it("blocks partial imports even when the period overlaps", () => {
    const result = assessDiscoveryEvidenceSufficiency({
      ...productionShaped,
      days: 7,
      requests: [{ ...request, resultState: "partial", importedRowCount: 243, rejectedRowCount: 1 }],
      observedDates: productionShaped.observedDates.filter((date) => date >= "2026-07-25"),
      quality: { ...quality, state: "partial", label: "Partial", explanation: "One source row was rejected." },
    });

    expect(result).toMatchObject({
      completeness: { state: "partial", importedRows: 243, sourceRows: 244, rejectedRows: 1 },
      decisionReady: false,
      waitingTitle: "Discovery import is partial",
    });
  });

  it("blocks evidence that does not overlap the requested period", () => {
    const result = assessDiscoveryEvidenceSufficiency({
      ...productionShaped,
      days: 7,
      requests: [{ ...request, evidenceStart: "2026-06-01", evidenceEnd: "2026-06-07" }],
      observedDates: ["2026-06-01", "2026-06-07"],
    });

    expect(result).toMatchObject({
      windowAlignment: { state: "out_of_window" },
      decisionReady: false,
      waitingTitle: "Discovery evidence is stale",
    });
  });

  it("blocks very-low volume without collapsing the other quality dimensions", () => {
    const result = assessDiscoveryEvidenceSufficiency({
      ...productionShaped,
      days: 7,
      observedDates: ["2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28"],
      totals: { impressions: 12, pageViews: 1, downloads: 0 },
    });

    expect(result).toMatchObject({
      freshness: { state: "fresh" },
      completeness: { state: "complete" },
      volume: { state: "very_low" },
      decisionReady: false,
      waitingTitle: "Discovery evidence volume is very low",
    });
  });

  it("formats each quality dimension and exact window separately", () => {
    const result = assessDiscoveryEvidenceSufficiency({ ...productionShaped, days: 28 });
    expect(formatDiscoveryEvidenceSufficiency(result)).toContain("Requested: 28 days (2026-07-04 to 2026-07-31)");
    expect(formatDiscoveryEvidenceSufficiency(result)).toContain("Imported: 2026-07-24 to 2026-07-29");
    expect(formatDiscoveryEvidenceSufficiency(result)).toContain("Scoped: 2026-07-24 to 2026-07-28 (5 observed days)");
    expect(formatDiscoveryEvidenceSufficiency(result)).toContain("Freshness: Fresh");
    expect(formatDiscoveryEvidenceSufficiency(result)).toContain("Completeness: Complete import (244/244 rows; 0 rejected)");
    expect(formatDiscoveryEvidenceSufficiency(result)).toContain("Period coverage: Partial coverage");
    expect(formatDiscoveryEvidenceSufficiency(result)).toContain("Evidence volume: Meaningful");
  });
});
