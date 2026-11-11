import assert from "node:assert/strict";
import test from "node:test";

import handler, { passportAnalyticsWindow } from "../refresh-passport-analytics.js";
import { persistAnalyticsRows } from "./appstore-analytics.js";

test("daily PASSPORT Analytics window uses ten complete UTC reporting days", () => {
  assert.deepEqual(passportAnalyticsWindow(new Date("2026-11-11T23:59:00Z")), { start: "2026-11-01", end: "2026-11-10" });
  assert.deepEqual(passportAnalyticsWindow(new Date("2027-01-01T00:01:00Z")), { start: "2026-12-22", end: "2026-12-31" });
});

test("scheduled route rejects unauthenticated requests before accessing the database", async () => {
  const original = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-only-secret";
  const response = {
    statusCode: null,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  try {
    await handler({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.payload, { error: "Unauthorized." });
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});

test("PASSPORT refresh preserves conflicting same-date revisions and imports new dates", async () => {
  const appId = "926ad3c6-c68d-4b70-9dd0-c0073916d771";
  const calls = [];
  const db = {
    select: async () => [{ date: "2026-11-04", source: "appstore_connect_discovery", processing_date: "2026-11-05", payload_hash: "original" }],
    rpc: async (_name, { p }) => { calls.push(p.date); return { state: "replaced" }; },
  };
  const parts = [
    { app_id: appId, date: "2026-11-04", source: "appstore_connect_discovery", processing_date: "2026-11-05", payload_hash: "changed" },
    { app_id: appId, date: "2026-11-05", source: "appstore_connect_discovery", processing_date: "2026-11-08", payload_hash: "new" },
  ];
  const result = await persistAnalyticsRows(db, parts, [], [], new Set([appId]));
  assert.deepEqual(calls, ["2026-11-05"]);
  assert.equal(result.skippedConflicts, 1);
  assert.equal(result.passportPartitions, 1);
});
