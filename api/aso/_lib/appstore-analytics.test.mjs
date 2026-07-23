import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDiscoveryReport } from "./appstore-analytics.js";

test("parseDiscoveryReport reads Apple's tab-delimited Discovery report", () => {
  const report = [
    "Date\tApp Name\tApp Apple Identifier\tEvent\tPage Type\tSource Type\tEngagement Type\tDevice\tPlatform Version\tTerritory\tCounts\tUnique Counts",
    "2026-07-20\tInnerType Personality Test\t123456789\tImpression\tNo page\tApp Store search\tNone\tiPhone\tiOS 18\tUS\t1,234\t987",
  ].join("\n");

  assert.deepEqual(parseDiscoveryReport(report), [
    {
      date: "2026-07-20",
      event: "Impression",
      pageType: "No page",
      sourceType: "App Store search",
      country: "us",
      count: 1234,
      uniqueCount: 987,
    },
  ]);
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
