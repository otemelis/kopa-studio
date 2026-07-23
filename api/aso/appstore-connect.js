import { hasAppStoreConnectConfig, listAppStoreConnectApps } from "./_lib/appstore-connect.js";
import { hasDiscoveryAnalyticsProvisioning, provisionDiscoveryRequests, syncDiscoveryAnalytics } from "./_lib/appstore-analytics.js";
import { hasSalesReportsConfig, salesSyncMessage, syncDailySalesMetrics } from "./_lib/appstore-sales.js";
import { requireAdmin, serviceClient } from "./_lib/supabase.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const action = request.body?.action ?? "status";
  const cronSecret = process.env.CRON_SECRET;
  const isServerToServer = Boolean(cronSecret && request.headers.authorization === `Bearer ${cronSecret}`);
  if (!isServerToServer) {
    try {
      await requireAdmin(request.headers.authorization);
    } catch (error) {
      response.status(error.status ?? 401).json({ error: error.message });
      return;
    }
  } else if (!["status", "analytics_status", "sync_sales", "sync_analytics"].includes(action)) {
    response.status(403).json({ error: "This App Store Connect action requires an owner session." });
    return;
  }

  const db = serviceClient();

  if (action === "status") {
    const [[connection], requests] = await Promise.all([
      db.select("aso_platform_connections", "provider=eq.appstore_connect&select=*"),
      db.select("aso_analytics_report_requests", "select=app_id,status,last_checked_at,last_error,created_at"),
    ]);
    response.status(200).json({ configured: hasAppStoreConnectConfig(), provisioningConfigured: hasDiscoveryAnalyticsProvisioning(), connection: connection ?? null, analytics: requests });
    return;
  }

  if (action === "analytics_status") {
    const requests = await db.select("aso_analytics_report_requests", "select=app_id,status,last_checked_at,last_error,created_at");
    response.status(200).json({ configured: hasAppStoreConnectConfig(), provisioningConfigured: hasDiscoveryAnalyticsProvisioning(), requests });
    return;
  }

  if (action !== "test" && action !== "sync_sales" && action !== "provision_analytics" && action !== "sync_analytics") {
    response.status(400).json({ error: "Unknown App Store Connect action." });
    return;
  }

  if (action !== "provision_analytics" && !hasAppStoreConnectConfig()) {
    response.status(400).json({ error: "App Store Connect is not configured in Vercel yet." });
    return;
  }

  if (action === "provision_analytics") {
    if (!hasDiscoveryAnalyticsProvisioning()) {
      response.status(400).json({ error: "Missing the temporary App Store Connect Admin setup key in Vercel environment variables." });
      return;
    }
    try {
      const apps = await db.select("aso_apps", "platform=eq.ios&appstore_connect_id=not.is.null&select=id,name,appstore_connect_id");
      if (!apps.length) {
        response.status(400).json({ error: "No tracked iOS apps are mapped to App Store Connect. Test the connection first." });
        return;
      }
      const result = await provisionDiscoveryRequests(db, apps);
      response.status(200).json({ ok: true, message: result.created ? `Requested Discovery and Engagement analytics for ${result.created} app(s). Apple may take 1-2 days to begin generating reports.` : "Discovery and Engagement analytics is already requested for every mapped app.", ...result });
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : "Analytics provisioning failed." });
    }
    return;
  }

  if (action === "sync_analytics") {
    try {
      const apps = await db.select("aso_apps", "platform=eq.ios&appstore_connect_id=not.is.null&select=id,name,appstore_connect_id");
      const result = await syncDiscoveryAnalytics(db, apps);
      response.status(200).json({ ok: true, message: result.segments ? `Imported ${result.dailyRows} country-day storefront metric row(s) from ${result.segments} Apple report segment(s).` : "Apple has not generated a Discovery and Engagement report yet. The first ongoing report can take 1-2 days.", ...result });
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : "Storefront analytics sync failed." });
    }
    return;
  }

  if (action === "sync_sales") {
    if (!hasSalesReportsConfig()) {
      response.status(400).json({ error: "Missing APP_STORE_CONNECT_VENDOR_NUMBER in Vercel environment variables." });
      return;
    }
    try {
      const apps = await db.select("aso_apps", "platform=eq.ios&select=id,name,store_app_id");
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
