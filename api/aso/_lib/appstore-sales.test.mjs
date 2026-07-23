import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDailySalesSummary, salesSyncMessage } from "./appstore-sales.js";

test("parseDailySalesSummary keeps sales row diagnostics", () => {
  const report = [
    "Provider\tSKU\tTitle\tProduct Type Identifier\tUnits\tDeveloper Proceeds\tEnd Date\tCountry Code\tCurrency of Proceeds\tApple Identifier",
    "KOPA\tINNER\tInnerType Personality Test\t1F\t2\t1.20\t2026-07-22\tUS\tUSD\t6785764991",
  ].join("\n");

  assert.deepEqual(parseDailySalesSummary(report), [
    {
      storeAppId: "6785764991",
      title: "InnerType Personality Test",
      sku: "INNER",
      productTypeIdentifier: "1F",
      date: "2026-07-22",
      rawDate: "2026-07-22",
      country: "us",
      downloads: 2,
      proceeds: 1.2,
      proceedsCurrency: "USD",
    },
  ]);
});

test("parseDailySalesSummary normalizes Apple slash dates", () => {
  const report = [
    "Provider\tSKU\tTitle\tProduct Type Identifier\tUnits\tDeveloper Proceeds\tEnd Date\tCountry Code\tCurrency of Proceeds\tApple Identifier",
    "KOPA\tINNER\tInnerType Personality Test\t1F\t2\t1.20\t7/22/2026\tUS\tUSD\t6785764991",
  ].join("\n");

  const [row] = parseDailySalesSummary(report);

  assert.equal(row.storeAppId, "6785764991");
  assert.equal(row.date, "2026-07-22");
  assert.equal(row.rawDate, "7/22/2026");
});

test("salesSyncMessage shows unmatched Apple identifiers and tracked ids", () => {
  assert.equal(
    salesSyncMessage({
      imported: 0,
      reportRows: 2,
      unmatchedSamples: [{ storeAppId: "123", title: "Other App" }, { storeAppId: "456", title: null }],
      trackedStoreAppIds: ["6785764991"],
    }),
    "Apple returned 2 sales row(s), but none match Kopa's tracked apps. Apple report app IDs: 123 · Other App; 456. Kopa currently tracks: 6785764991.",
  );
});

test("salesSyncMessage identifies tracked rows with invalid date or country", () => {
  assert.equal(
    salesSyncMessage({
      imported: 0,
      reportRows: 2,
      invalidRows: 2,
      unmatchedSamples: [],
      invalidSamples: [{ storeAppId: "6785764991", title: "InnerType Personality Test", rawDate: "July 22, 2026", country: "" }],
    }),
    "Apple returned 2 sales row(s) for tracked apps, but their date or country fields were not importable. Sample rows: 6785764991 · InnerType Personality Test · date July 22, 2026 · missing country.",
  );
});
