import test from "node:test";
import assert from "node:assert/strict";
import {
  assessAsoprogress,
  compareRankAroundChange,
  compareRankWindow,
  compareRecentAcquisitionWindows,
  parseCsv,
  summarizeMetricWindow,
  summarizeSnapshotDownloads,
} from "../../src/aso-progress.js";

const ranked = (date, rank, source = "apple_web_search", found = true, depth = 12) => ({
  captured_at: `${date}T12:00:00Z`, rank, source, found, result_depth: depth, collection_status: "partial",
});

test("rank movement compares a single source and positive means improved", () => {
  const web = compareRankWindow([ranked("2026-10-01", 8), ranked("2026-10-08", 5)], 7);
  const catalog = compareRankWindow([ranked("2026-10-01", 4, "public_store"), ranked("2026-10-08", 7, "public_store")], 7);
  assert.equal(web.delta, 3);
  assert.equal(catalog.delta, -3);
});

test("not observed within limited depth is not called unranked", () => {
  const row = compareRankWindow([ranked("2026-10-01", 8), ranked("2026-10-08", null, "apple_web_search", false, 9)], 7);
  assert.equal(row.state, "not_observed");
  assert.equal(row.delta, null);
  assert.equal(row.current.result_depth, 9);
});

test("metadata comparison pairs observations from before and after the change", () => {
  const row = compareRankAroundChange([
    { ...ranked("2026-09-01", 9), captured_on: "2026-09-01" },
    { ...ranked("2026-09-09", 5), captured_on: "2026-09-09" },
  ], "2026-09-05", 4);
  assert.equal(row.state, "comparable");
  assert.equal(row.delta, 4);
});

test("unreported ASC metrics remain unavailable, not zero", () => {
  const row = summarizeMetricWindow([], { start: "2026-10-01", end: "2026-10-07", event: "Impression", sourceType: "App Store search", country: "us" });
  assert.equal(row.available, false);
  assert.equal(row.value, null);
});

test("validated ASC snapshot distinguishes known download rows from missing dates", () => {
  const rows = parseCsv('\ufeffdate,app,metric,source,value,data_quality_status,acquisition_source,scope\n2026-10-11,InnerType,first_time_downloads,App Downloads Standard,4,reported_value,All sources,summary\n2026-10-10,InnerType,first_time_downloads,App Downloads Standard,0,zero_no_rows_in_validated_standard_extract,All sources,summary');
  const result = summarizeSnapshotDownloads(rows, { app: "InnerType", start: "2026-10-10", end: "2026-10-11" });
  assert.equal(result.value, 4);
  assert.equal(result.days, 2);
  assert.equal(result.complete, true);
  const incomplete = summarizeSnapshotDownloads(rows, { app: "InnerType", start: "2026-10-09", end: "2026-10-11" });
  assert.equal(incomplete.available, true);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.days, 2);
});

test("recent acquisition periods sum only observed ASC rows", () => {
  const rows = [
    { date: "2026-10-01", country: "us", event: "Impression", source_type: "App Store search", count: 10 },
    { date: "2026-10-08", country: "us", event: "Impression", source_type: "App Store search", count: 14 },
    { date: "2026-10-08", country: "us", event: "Page view", source_type: "App Store search", count: 3 },
  ];
  const pair = compareRecentAcquisitionWindows(rows, "2026-10-08", 7, { country: "us" });
  assert.equal(pair.before.impressions.value, 10);
  assert.equal(pair.after.impressions.value, 14);
  assert.equal(pair.after.impressions.days, 1);
  assert.equal(pair.after.pageViews.value, 3);
});

test("assessment requires source-specific rank observations and Search impressions", () => {
  const acquisition = { before: { impressions: { available: true, value: 10 } }, after: { impressions: { available: true, value: 15 } } };
  assert.equal(assessAsoprogress([{ state: "comparable", delta: 2 }], acquisition).status, "improving");
  const downloads = { before: { available: true, value: 13, start: "2026-09-28", end: "2026-10-04", days: 7, expectedDays: 7 }, after: { available: true, value: 9, start: "2026-10-05", end: "2026-10-11", days: 7, expectedDays: 7 } };
  assert.equal(assessAsoprogress([{ state: "comparable", delta: 2 }], acquisition, downloads).status, "mixed");
  assert.equal(assessAsoprogress([{ state: "not_observed", delta: null }], acquisition).status, "insufficient evidence");
});
