import { syncDiscoveryAnalytics } from "./_lib/appstore-analytics.js";
import { serviceClient } from "./_lib/supabase.js";

const PASSPORT_APPLE_ID = "6822753543";
const REPORTING_DAYS = 10;

export function passportAnalyticsWindow(now = new Date()) {
  const through = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const start = new Date(through);
  start.setUTCDate(start.getUTCDate() - REPORTING_DAYS + 1);
  return { start: start.toISOString().slice(0, 10), end: through.toISOString().slice(0, 10) };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  const secret = process.env.CRON_SECRET;
  if (!secret) return response.status(503).json({ error: "CRON_SECRET is not configured." });
  if (request.headers.authorization !== `Bearer ${secret}`) return response.status(401).json({ error: "Unauthorized." });

  let stage = "database";
  try {
    const db = serviceClient();
    const apps = await db.select("aso_apps", `platform=eq.ios&store_app_id=eq.${PASSPORT_APPLE_ID}&select=id,name,store_app_id,appstore_connect_id`);
    if (apps.length !== 1 || String(apps[0].appstore_connect_id) !== PASSPORT_APPLE_ID) {
      return response.status(409).json({ error: "PASSPORT App Store Connect mapping is missing or ambiguous." });
    }
    const window = passportAnalyticsWindow();
    stage = "apple_reports";
    const result = await syncDiscoveryAnalytics(db, apps, {
      historyStart: window.start,
      historyEnd: window.end,
      maxInstances: 16,
    });
    if (result.skippedConflicts) console.warn("PASSPORT Analytics kept conflicting same-date Apple revisions", { count: result.skippedConflicts });
    if (result.state !== "success" && result.state !== "zero") console.error("PASSPORT Analytics refresh incomplete", { state: result.state, reports: result.requests });
    return response.status(result.state === "success" || result.state === "zero" ? 200 : 502).json({
      ok: result.state === "success" || result.state === "zero",
      appId: PASSPORT_APPLE_ID,
      window,
      state: result.state,
      segments: result.segments,
      rejectedRows: result.rejectedRows,
      skippedConflicts: result.skippedConflicts,
      partitions: result.partitions.length,
      reports: result.requests,
    });
  } catch (error) {
    console.error("PASSPORT Analytics refresh failed", { stage, message: error instanceof Error ? error.message : String(error) });
    return response.status(502).json({ error: error instanceof Error ? error.message : "PASSPORT Analytics refresh failed." });
  }
}
