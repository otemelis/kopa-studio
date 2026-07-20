import { hasAppStoreConnectConfig, listAppStoreConnectApps } from "./_lib/appstore-connect.js";
import { hasSalesReportsConfig, salesSyncMessage, syncDailySalesMetrics } from "./_lib/appstore-sales.js";
import { requireAdmin, serviceClient } from "./_lib/supabase.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await requireAdmin(request.headers.authorization);
  } catch (error) {
    response.status(error.status ?? 401).json({ error: error.message });
    return;
  }

  const action = request.body?.action ?? "status";
  const db = serviceClient();

  if (action === "status") {
    const [connection] = await db.select("aso_platform_connections", "provider=eq.appstore_connect&select=*");
    response.status(200).json({ configured: hasAppStoreConnectConfig(), connection: connection ?? null });
    return;
  }

  if (action !== "test" && action !== "sync_sales") {
    response.status(400).json({ error: "Unknown App Store Connect action." });
    return;
  }

  if (!hasAppStoreConnectConfig()) {
    response.status(400).json({ error: "App Store Connect is not configured in Vercel yet." });
    return;
  }

  if (action === "sync_sales") {
    if (!hasSalesReportsConfig()) {
      response.status(400).json({ error: "Missing APP_STORE_CONNECT_VENDOR_NUMBER in Vercel environment variables." });
      return;
    }
    try {
      const apps = await db.select("aso_apps", "platform=eq.ios&select=id,store_app_id");
      const result = await syncDailySalesMetrics(db, apps);
      await db.upsert(
        "aso_platform_connections",
        [{ provider: "appstore_connect", status: "configured", last_sync_at: new Date().toISOString(), last_test_ok: true, last_test_message: salesSyncMessage(result), last_test_at: new Date().toISOString() }],
        "provider",
      );
      response.status(200).json({ ok: true, message: salesSyncMessage(result), ...result });
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : "Sales sync failed." });
    }
    return;
  }

  try {
    const remoteApps = await listAppStoreConnectApps();
    const ownedApps = await db.select("aso_apps", "platform=eq.ios&select=id,bundle_id");
    let mapped = 0;
    for (const owned of ownedApps) {
      const match = remoteApps.find((remote) => remote.bundleId === owned.bundle_id);
      if (!match) continue;
      await db.update("aso_apps", { appstore_connect_id: match.id, updated_at: new Date().toISOString() }, `id=eq.${owned.id}`);
      mapped++;
    }
    const now = new Date().toISOString();
    await db.upsert(
      "aso_platform_connections",
      [{ provider: "appstore_connect", status: "configured", last_test_at: now, last_test_ok: true, last_test_message: `${remoteApps.length} app(s) visible; ${mapped} owned app(s) matched by bundle id.`, last_sync_at: null }],
      "provider",
    );
    response.status(200).json({ ok: true, visibleApps: remoteApps.length, mappedApps: mapped });
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Connection test failed.";
    await db
      .upsert(
        "aso_platform_connections",
        [{ provider: "appstore_connect", status: "error", last_test_at: now, last_test_ok: false, last_test_message: message, last_sync_at: null }],
        "provider",
      )
      .catch(() => undefined);
    response.status(502).json({ error: message });
  }
}
