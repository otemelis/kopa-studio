import test from "node:test";
import assert from "node:assert/strict";
import { renderAsoProgress } from "../../src/aso-progress-view.js";

test("progress view keeps ranking sources separate and displays labeled acquisition snapshot data", async () => {
  const store = new Map([["kopa-aso-progress-country-v1", "us"], ["kopa-aso-progress-days-v1", "7"]]);
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  globalThis.fetch = async (url) => String(url).includes("aso-monitoring.json")
    ? { ok: true, json: async () => ({ apps: [{ storeAppId: "6785764991", snapshotAppName: "InnerType" }] }) }
    : { ok: true, text: async () => "date,app,metric,source,value,data_quality_status,acquisition_source,scope\n2026-10-08,InnerType,first_time_downloads,App Downloads Standard,10,reported_value,All sources,summary\n2026-10-08,InnerType,first_time_downloads,App Downloads Standard,6,reported_value,App Store search,source_breakdown" };
  const tables = {
    aso_apps: [{ id: "app-1", name: "InnerType Personality Test", store_app_id: "6785764991" }],
    aso_app_keywords: [{ id: "link-1", app_id: "app-1", keyword_id: "kw-1", status: "active", priority: "high" }],
    aso_keywords: [{ id: "kw-1", term: "personality test", country: "us", language: "en" }],
    aso_keyword_rank_snapshots: [
      { keyword_id: "kw-1", captured_at: "2026-10-01T12:00:00Z", captured_on: "2026-10-01", rank: 5, found: true, result_depth: 97, collection_status: "ok", source: "public_store" },
      { keyword_id: "kw-1", captured_at: "2026-10-08T12:00:00Z", captured_on: "2026-10-08", rank: 3, found: true, result_depth: 98, collection_status: "ok", source: "public_store" },
      { keyword_id: "kw-1", captured_at: "2026-09-10T12:00:00Z", captured_on: "2026-09-10", rank: 6, found: true, result_depth: 12, collection_status: "partial", source: "apple_web_search" },
      { keyword_id: "kw-1", captured_at: "2026-10-18T12:00:00Z", captured_on: "2026-10-18", rank: 4, found: true, result_depth: 12, collection_status: "partial", source: "apple_web_search" },
    ],
    aso_storefront_metrics: [
      { date: "2026-10-01", country: "us", event: "Impression", source_type: "App Store search", count: 10, unique_count: 8 },
      { date: "2026-10-08", country: "us", event: "Impression", source_type: "App Store search", count: 14, unique_count: 11 },
      { date: "2026-10-08", country: "us", event: "Page view", source_type: "App Store search", count: 2, unique_count: 2 },
    ],
    aso_daily_metrics: [],
    aso_metadata_change_events: [],
    apple_ads_daily_metrics: [],
  };
  const pg = async (table) => tables[table];
  const panel = { innerHTML: "", querySelector: () => null };
  const addDays = (day, amount) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); };
  await renderAsoProgress(panel, { pg, formatNumber: (n) => Number(n).toLocaleString("en-US"), addDays, toDateStr: () => "2026-10-18", escapeHtml: (value) => String(value ?? ""), workspaceAppScope: "all" });
  assert.match(panel.innerHTML, /Apple web App Store/);
  assert.match(panel.innerHTML, /iTunes Search API/);
  assert.match(panel.innerHTML, /First-time downloads/);
  assert.match(panel.innerHTML, /10/);
  assert.match(panel.innerHTML, /all storefronts/);
  assert.match(panel.innerHTML, /App Store Search first-time downloads: 6/);
  assert.match(panel.innerHTML, /First-time downloads · all storefronts<\/span><strong>10<\/strong>/);
  assert.match(panel.innerHTML, /#3/);
  assert.match(panel.innerHTML, /Apple web App Store/);
  assert.match(panel.innerHTML, /ranking observations through 2026-10-18/);
  assert.match(panel.innerHTML, /Progress assessments use rank observations no later than this date/);
  assert.match(panel.innerHTML, /App Store Search impressions/);
  assert.match(panel.innerHTML, /Need an earlier comparable snapshot/);
});
