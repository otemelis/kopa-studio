import assert from "node:assert/strict";
import test from "node:test";
import rankingsHandler from "../collect-rankings.js";

function responseStub() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("rankings cron completes and releases its lock with a synthetic empty workload", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldCronSecret = process.env.CRON_SECRET;
  const oldFetch = globalThis.fetch;
  const calls = [];
  process.env.SUPABASE_URL = "https://synthetic-db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-only";
  process.env.CRON_SECRET = "synthetic-cron-only";

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const table = url.pathname.split("/rest/v1/")[1];
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ table, method: init.method, body });

    if (table === "rpc/aso_try_acquire_collection_lock") return Response.json(true);
    if (table === "aso_sync_runs" && init.method === "POST") return Response.json([{ id: "synthetic-run" }]);
    return Response.json([]);
  };

  try {
    const response = responseStub();
    await rankingsHandler({ method: "GET", headers: { authorization: "Bearer synthetic-cron-only" }, query: { slot: "test" } }, response);
    const result = response.body;
    assert.equal(response.statusCode, 200);
    assert.equal(result.ok, true);
    assert.equal(result.runId, "synthetic-run");
    assert.match(result.message, /Rankings-only collection ok/);

    const finalRunUpdate = calls.findLast((call) =>
      call.table === "aso_sync_runs" && call.method === "PATCH" && call.body?.status === "ok",
    );
    assert.ok(finalRunUpdate, "collector should mark the synthetic run complete");
    assert.ok(finalRunUpdate.body.finished_at, "completed run should have a finish timestamp");
    assert.equal(finalRunUpdate.body.processed, 0);
    assert.equal(finalRunUpdate.body.summary.scope, "rankings");
    assert.ok(calls.some((call) => call.table === "rpc/aso_release_collection_lock"));
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldCronSecret;
  }
});

test("rankings cron endpoint rejects missing and incorrect secrets without starting a run", async () => {
  const oldCronSecret = process.env.CRON_SECRET;
  const oldFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (...args) => { fetchCalls.push(args); throw new Error("Unauthorized request must not call Supabase."); };
  process.env.CRON_SECRET = "synthetic-cron-only";
  try {
    const missing = responseStub();
    await rankingsHandler({ method: "GET", headers: {}, query: {} }, missing);
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.body.ok, false);

    const incorrect = responseStub();
    await rankingsHandler({ method: "GET", headers: { authorization: "Bearer wrong" }, query: {} }, incorrect);
    assert.equal(incorrect.statusCode, 401);
    assert.equal(incorrect.body.ok, false);
    assert.equal(fetchCalls.length, 0);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldCronSecret;
  }
});

test("a run-record failure always releases the database lock and the warm instance can recover", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldCronSecret = process.env.CRON_SECRET;
  const oldFetch = globalThis.fetch;
  const calls = [];
  let runInsertAttempts = 0;
  process.env.SUPABASE_URL = "https://synthetic-db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-only";
  process.env.CRON_SECRET = "synthetic-cron-only";

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const table = url.pathname.split("/rest/v1/")[1];
    calls.push({ table, method: init.method });
    if (table === "rpc/aso_try_acquire_collection_lock") return Response.json(true);
    if (table === "aso_sync_runs" && init.method === "POST") {
      runInsertAttempts++;
      if (runInsertAttempts === 1) return new Response("synthetic insert failure", { status: 500 });
      return Response.json([{ id: "recovered-run" }]);
    }
    return Response.json([]);
  };

  try {
    const first = responseStub();
    await rankingsHandler({ method: "GET", headers: { authorization: "Bearer synthetic-cron-only" }, query: {} }, first);
    assert.equal(first.statusCode, 500);
    assert.equal(first.body.runId, null);
    assert.ok(calls.some((call) => call.table === "rpc/aso_release_collection_lock"), "failed startup releases the claimed lock");

    const second = responseStub();
    await rankingsHandler({ method: "GET", headers: { authorization: "Bearer synthetic-cron-only" }, query: {} }, second);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.runId, "recovered-run");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldCronSecret;
  }
});

test("an ambiguous lock-RPC response triggers a holder-scoped release attempt", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldCronSecret = process.env.CRON_SECRET;
  const oldFetch = globalThis.fetch;
  const calls = [];
  process.env.SUPABASE_URL = "https://synthetic-db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-only";
  process.env.CRON_SECRET = "synthetic-cron-only";

  globalThis.fetch = async (input) => {
    const url = new URL(input);
    const table = url.pathname.split("/rest/v1/")[1];
    calls.push(table);
    if (table === "rpc/aso_try_acquire_collection_lock") return new Response("synthetic lost response", { status: 500 });
    return Response.json([]);
  };

  try {
    const response = responseStub();
    await rankingsHandler({ method: "GET", headers: { authorization: "Bearer synthetic-cron-only" }, query: {} }, response);
    assert.equal(response.statusCode, 500);
    assert.ok(calls.includes("rpc/aso_release_collection_lock"), "the holder-scoped release is attempted after an ambiguous acquire response");
    assert.ok(!calls.includes("aso_sync_runs"), "no run is started without a confirmed lock acquisition");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldCronSecret;
  }
});
