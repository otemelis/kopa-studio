#!/usr/bin/env node
// Official Apple Analytics + existing Kopa rows, read-only. No database mutations.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { syncDiscoveryAnalytics } from "../../api/aso/_lib/appstore-analytics.js";
import { serviceClient } from "../../api/aso/_lib/supabase.js";

const argv = process.argv.slice(2);
const option = (name) => argv[argv.indexOf(name) + 1];
if (!argv.includes("--env-dir") || !argv.includes("--start") || !argv.includes("--end") || !argv.includes("--output")) {
  throw new Error("Usage: node scripts/app-store/passport-analytics-dry-run.mjs --env-dir /path/to/existing/kopa-repo --start YYYY-MM-DD --end YYYY-MM-DD --output /private/path.json");
}
const envDir = resolve(option("--env-dir"));
process.loadEnvFile(resolve(envDir, ".env.local"));
process.loadEnvFile(resolve(envDir, "apps/tools/.env.local"));
if (argv.includes("--p8")) process.env.APP_STORE_CONNECT_PRIVATE_KEY = readFileSync(resolve(option("--p8")), "utf8");
if (argv.includes("--key-id")) process.env.APP_STORE_CONNECT_KEY_ID = option("--key-id");
if (argv.includes("--issuer-id")) process.env.APP_STORE_CONNECT_ISSUER_ID = option("--issuer-id");
const reader = serviceClient();
const readonly = {
  select: reader.select,
  upsert: () => { throw new Error("Dry-run attempted a database write."); },
  update: () => { throw new Error("Dry-run attempted a database write."); },
  rpc: () => { throw new Error("Dry-run attempted an RPC."); },
};
const apps = await readonly.select("aso_apps", "store_app_id=eq.6822753543&select=id,name,store_app_id,appstore_connect_id");
if (apps.length !== 1) throw new Error("PASSPORT app mapping was not unique.");
const result = await syncDiscoveryAnalytics(readonly, apps, {
  dryRun: true, historyStart: option("--start"), historyEnd: option("--end"), maxInstances: 35,
});
const evidence = { generatedAt: new Date().toISOString(), app: { id: apps[0].id, appleId: apps[0].store_app_id },
  interval: { start: option("--start"), end: option("--end"), timezone: "UTC Analytics report Date" },
  state: result.state, requests: result.requests, sourceRows: result.sourceRows, segments: result.segments,
  partitions: [] };
for (const part of result.partitions) {
  const oldStore = await readonly.select("aso_storefront_metrics", `app_id=eq.${part.app_id}&date=eq.${part.date}&source=eq.${part.source}&select=import_key,count,unique_count,source_type,event,page_type,country&limit=5001`);
  const dailySource = part.source === "appstore_connect_downloads" ? "appstore_connect_first_time_downloads" : part.source;
  const oldDaily = await readonly.select("aso_daily_metrics", `app_id=eq.${part.app_id}&date=eq.${part.date}&source=eq.${dailySource}&select=import_key,impressions,page_views,downloads,country&limit=5001`);
  if (oldStore.length > 5000 || oldDaily.length > 5000) throw new Error("Existing partition exceeds dry-run comparison bound.");
  const oldStoreMap = new Map(oldStore.map((row) => [row.import_key, row]));
  const newStoreMap = new Map(part.storefront_rows.map((row) => [row.import_key, row]));
  const oldDailyMap = new Map(oldDaily.map((row) => [row.import_key, row]));
  const newDailyMap = new Map(part.daily_rows.map((row) => [row.import_key, row]));
  const diff = (oldMap, newMap) => ({ added: [...newMap.keys()].filter((key) => !oldMap.has(key)), removed: [...oldMap.keys()].filter((key) => !newMap.has(key)), changed: [...newMap.keys()].filter((key) => oldMap.has(key) && ["count", "unique_count", "impressions", "page_views", "downloads"].some((field) => (oldMap.get(key)[field] ?? null) !== (newMap.get(key)[field] ?? null))) });
  const sourceTotals = Object.groupBy(part.storefront_rows, (row) => `${row.event}|${row.page_type}|${row.source_type}`);
  evidence.partitions.push({ date: part.date, source: part.source, processingDate: part.processing_date,
    payloadHash: part.payload_hash, before: { storefrontRows: oldStore.length, dailyRows: oldDaily.length },
    after: { storefrontRows: part.storefront_rows.length, dailyRows: part.daily_rows.length },
    storefrontDiff: diff(oldStoreMap, newStoreMap), dailyDiff: diff(oldDailyMap, newDailyMap),
    totals: Object.fromEntries(Object.entries(sourceTotals).map(([key, rows]) => [key, rows.reduce((sum, row) => sum + row.count, 0)])),
    segmentChecksums: [...new Set(part.storefront_rows.flatMap((row) => (row.raw_payload.sourceRows ?? []).map((source) => source.segmentChecksum)).filter(Boolean))].sort(),
  });
}
writeFileSync(resolve(option("--output")), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ state: evidence.state, partitions: evidence.partitions.length, dates: [...new Set(evidence.partitions.map((part) => part.date))], output: resolve(option("--output")) }));
