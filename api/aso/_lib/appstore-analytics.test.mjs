import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  DISCOVERY_PARSER_VERSION,
  DiscoveryReportParseError,
  inspectDiscoveryReport,
  parseDiscoveryReport,
  inspectDownloadsReport,
  latestProcessingRows,
} from "./appstore-analytics.js";

const productionFixture = readFileSync(new URL("./fixtures/appstore-discovery-innertype-sanitized.tsv", import.meta.url), "utf8");

test("parseDiscoveryReport reads the production-shaped tab-delimited Discovery fixture", () => {
  assert.deepEqual(parseDiscoveryReport(productionFixture), [
    {
      date: "2026-07-27",
      event: "Impression",
      pageType: "No page",
      sourceType: "App Store search",
      country: "gb",
      count: 12,
      uniqueCount: 10,
    },
    {
      date: "2026-07-27",
      event: "Page view",
      pageType: "Product page",
      sourceType: "App Store search",
      country: "gb",
      count: 2,
      uniqueCount: 2,
    },
    {
      date: "2026-07-27",
      event: "Tap",
      pageType: "No page",
      sourceType: "App Store search",
      country: "us",
      count: 1,
      uniqueCount: 1,
    },
  ]);
});

test("inspectDiscoveryReport records parser provenance and the exact source row", () => {
  const result = inspectDiscoveryReport(productionFixture);
  assert.equal(result.parserVersion, DISCOVERY_PARSER_VERSION);
  assert.equal(result.state, "success");
  assert.equal(result.sourceRowCount, 3);
  assert.equal(result.importedRowCount, 3);
  assert.equal(result.rejectedRowCount, 0);
  assert.deepEqual(result.headers, [
    "Date",
    "App Name",
    "App Apple Identifier",
    "Event",
    "Page Type",
    "Source Type",
    "Engagement Type",
    "Device",
    "Platform Version",
    "Territory",
    "Counts",
    "Unique Counts",
  ]);
  assert.deepEqual(result.rows[0].rawPayload, {
    Date: "2026-07-27",
    "App Name": "InnerType Personality Test",
    "App Apple Identifier": "6785764991",
    Event: "Impression",
    "Page Type": "No page",
    "Source Type": "App Store search",
    "Engagement Type": "None",
    Device: "iPhone",
    "Platform Version": "iOS 18",
    Territory: "GB",
    Counts: "12",
    "Unique Counts": "10",
  });
});

test("inspectDiscoveryReport distinguishes a valid zero-row report", () => {
  const header = productionFixture.split(/\r?\n/, 1)[0];
  const result = inspectDiscoveryReport(`${header}\n`);
  assert.equal(result.state, "zero");
  assert.equal(result.sourceRowCount, 0);
  assert.equal(result.importedRowCount, 0);
  assert.equal(result.rejectedRowCount, 0);
});

test("inspectDiscoveryReport marks mixed valid and invalid rows as partial", () => {
  const report = `${productionFixture.trim()}\n2026-07-27\tInnerType Personality Test\t6785764991\tImpression\tNo page\tApp Store search\tNone\tiPhone\tiOS 18\t\t5\t5\n`;
  const result = inspectDiscoveryReport(report);
  assert.equal(result.state, "partial");
  assert.equal(result.sourceRowCount, 4);
  assert.equal(result.importedRowCount, 3);
  assert.equal(result.rejectedRowCount, 1);
  assert.deepEqual(result.issues, [{ rowNumber: 5, codes: ["missing_territory"] }]);
});

test("inspectDiscoveryReport fails when required source columns are missing", () => {
  assert.throws(
    () => inspectDiscoveryReport("Date\tEvent\tTerritory\n2026-07-27\tImpression\tGB"),
    (error) => error instanceof DiscoveryReportParseError
      && error.details.missingHeaders.includes("Counts")
      && error.parserVersion === DISCOVERY_PARSER_VERSION,
  );
});

test("inspectDiscoveryReport fails instead of reporting zero when every source row is invalid", () => {
  const report = `${productionFixture.split(/\r?\n/, 1)[0]}\nnot-a-date\tInnerType Personality Test\t6785764991\t\tNo page\tApp Store search\tNone\tiPhone\tiOS 18\t\tnope\t\n`;
  assert.throws(
    () => inspectDiscoveryReport(report),
    (error) => error instanceof DiscoveryReportParseError
      && error.details.sourceRowCount === 1
      && error.details.rejectedRowCount === 1,
  );
});

test("parseDiscoveryReport keeps legacy comma-delimited fixture support", () => {
  const report = [
    "Date,Event,Page Type,Source Type,Territory,Counts,Unique Counts",
    "2026-07-20,Page view,Product page,App Store browse,SE,45,40",
  ].join("\n");

  assert.deepEqual(parseDiscoveryReport(report), [
    {
      date: "2026-07-20",
      event: "Page view",
      pageType: "Product page",
      sourceType: "App Store browse",
      country: "se",
      count: 45,
      uniqueCount: 40,
    },
  ]);
});

test("latest processing partition wins without losing multiple segments for its date", () => {
  const header = productionFixture.split("\n")[0];
  const original = productionFixture.split("\n")[1];
  const newer = original.replace("\t12\t10", "\t5\t5");
  const files = [
    { text: `${header}\n${original}\n`, processingDate: "2026-07-28", segmentId: "old" },
    { text: `${header}\n${newer}\n`, processingDate: "2026-07-29", segmentId: "new-a" },
    { text: `${header}\n${newer}\n`, processingDate: "2026-07-29", segmentId: "new-b" },
  ];
  const selected = latestProcessingRows(files, inspectDiscoveryReport, "6785764991");
  assert.deepEqual(selected.map((row) => row.file.segmentId), ["new-a", "new-b"]);
  assert.equal(selected.reduce((sum, row) => sum + row.count, 0), 10);
  assert.throws(() => latestProcessingRows(files, inspectDiscoveryReport, "6820665225"), /app ID/);
});

test("Downloads parser selects first-time downloads and rejects invalid counts", () => {
  const header = "Date\tApp Apple Identifier\tDownload Type\tSource Type\tTerritory\tCounts";
  const text = `${header}\n2026-10-25\t6820665225\tFirst-time download\tApp Store search\tAU\t1\n2026-10-25\t6820665225\tRedownload\tApp Store search\tAU\t2\n`;
  assert.deepEqual(inspectDownloadsReport(text).rows.map((row) => [row.date, row.country, row.count]), [["2026-10-25", "au", 1]]);
  assert.throws(() => inspectDownloadsReport(`${header}\n2026-10-25\t6820665225\tFirst-time download\tApp Store search\tAU\tbad\n`), /invalid rows/);
});
