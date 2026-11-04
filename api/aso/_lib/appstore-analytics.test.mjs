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
  approvedRequestForApp,
  paginatedAppleRows,
  validateHistoryWindow,
  buildAnalyticsPartitions,
  persistAnalyticsRows,
  passportBackfillScope,
} from "./appstore-analytics.js";

test("PASSPORT partitions use the new RPC while POIS keeps its existing upsert path", async () => {
  const calls = [];
  const db = { upsert: async (table, rows) => calls.push({ method: "upsert", table, appIds: rows.map((row) => row.app_id) }), rpc: async (name, args) => calls.push({ method: "rpc", name, appId: args.p.app_id }) };
  const parts = [{ app_id: "passport", storefront_rows: [], daily_rows: [] }, { app_id: "pois", storefront_rows: [], daily_rows: [] }];
  const store = [{ app_id: "passport" }, { app_id: "pois" }];
  const daily = [{ app_id: "passport" }, { app_id: "pois" }];
  await persistAnalyticsRows(db, parts, store, daily, new Set(["passport"]));
  assert.deepEqual(calls, [
    { method: "upsert", table: "aso_storefront_metrics", appIds: ["pois"] },
    { method: "upsert", table: "aso_daily_metrics", appIds: ["pois"] },
    { method: "rpc", name: "aso_replace_analytics_partition", appId: "passport" },
  ]);
});

test("bounded PASSPORT backfill excludes POIS and rejects ambiguous or broad scope", () => {
  const apps = [
    { id: "passport", store_app_id: "6822753543", appstore_connect_id: "6822753543" },
    { id: "pois", store_app_id: "6820665225", appstore_connect_id: "6820665225" },
  ];
  assert.deepEqual(passportBackfillScope({ appId: "6822753543", start: "2026-10-29", end: "2026-11-03" }, apps),
    { apps: [apps[0]], historyStart: "2026-10-29", historyEnd: "2026-11-03" });
  assert.throws(() => passportBackfillScope({ appId: "6820665225", start: "2026-10-29", end: "2026-11-03" }, apps));
  assert.throws(() => passportBackfillScope({ appId: "6822753543" }, apps));
});

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

test("only an exact approved app/request pairing can be auto-mapped", () => {
  assert.equal(approvedRequestForApp({ store_app_id: "6822753543", appstore_connect_id: "6822753543" }), "1a1002c3-3a07-4d10-afca-6352b89790d5");
  assert.equal(approvedRequestForApp({ store_app_id: "6820665225", appstore_connect_id: "6820665225" }), "0a5174c1-f952-401f-abea-3f9fd6487a36");
  assert.equal(approvedRequestForApp({ store_app_id: "6822753543", appstore_connect_id: "different" }), null);
  assert.equal(approvedRequestForApp({ store_app_id: "unknown", appstore_connect_id: "unknown" }), null);
});

test("Apple report pagination keeps order and rejects off-host and loops", async () => {
  const pages = new Map([
    ["/v1/reports?limit=1", { data: [{ id: "first" }], links: { next: "https://api.appstoreconnect.apple.com/v1/reports?cursor=2" } }],
    ["/v1/reports?cursor=2", { data: [{ id: "second" }], links: {} }],
  ]);
  assert.deepEqual((await paginatedAppleRows("/v1/reports?limit=1", async (path) => pages.get(path))).map((row) => row.id), ["first", "second"]);
  await assert.rejects(paginatedAppleRows("/v1/reports", async () => ({ data: [], links: { next: "https://example.com/v1/reports" } })), /host or path/);
  await assert.rejects(paginatedAppleRows("/v1/reports", async () => ({ data: [], links: { next: "/v1/reports" } })), /safe bound/);
});

test("backfill dates must be explicit and limited to 35 UTC reporting days", () => {
  assert.deepEqual(validateHistoryWindow("2026-10-01", "2026-11-04"), { start: "2026-10-01", end: "2026-11-04" });
  assert.throws(() => validateHistoryWindow("2026-09-01", "2026-11-04"), /35/);
  assert.throws(() => validateHistoryWindow("2026-11-04", null), /explicit/);
  assert.throws(() => validateHistoryWindow("2026-11-05", "2026-11-04"), /35/);
});

test("revised partitions include only latest Apple rows, including changed source types", () => {
  const base = { app_id: "app-passport", date: "2026-11-03", country: "us", event: "Impression", page_type: "No page", source: "appstore_connect_discovery" };
  const older = { ...base, source_type: "App Store browse", count: 10, import_key: "old", raw_payload: { sourceRows: [{ processingDate: "2026-11-04" }] } };
  const revised = { ...base, source_type: "App Store search", count: 8, import_key: "new", raw_payload: { sourceRows: [{ processingDate: "2026-11-05" }] } };
  const [partition] = buildAnalyticsPartitions([revised], []);
  assert.equal(partition.processing_date, "2026-11-05");
  assert.deepEqual(partition.storefront_rows.map((row) => row.import_key), ["new"]);
  assert.equal(partition.storefront_rows.some((row) => row.import_key === older.import_key), false);
  assert.match(partition.payload_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(buildAnalyticsPartitions([revised], []), [partition]);
  assert.throws(() => buildAnalyticsPartitions([older, revised], []), /Mixed Apple processing revisions/);
});

test("Downloads source breakdown and daily totals replace as one partition", () => {
  const source = { app_id: "app-passport", date: "2026-11-03", country: "us", event: "First-time download", page_type: "No page", source_type: "Web referrer", count: 2, source: "appstore_connect_downloads", import_key: "download-source", raw_payload: { sourceRows: [{ processingDate: "2026-11-04" }] } };
  const daily = { app_id: "app-passport", date: "2026-11-03", country: "us", downloads: 2, source: "appstore_connect_first_time_downloads", import_key: "download-daily", raw_payload: { sourceRows: [{ processingDate: "2026-11-04" }] } };
  const [part] = buildAnalyticsPartitions([source], [daily]);
  assert.equal(part.source, "appstore_connect_downloads");
  assert.equal(part.storefront_rows.length, 1);
  assert.equal(part.daily_rows.length, 1);
  assert.equal(part.processing_date, "2026-11-04");
});
