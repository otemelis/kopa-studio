import { createAdminClient } from "@/lib/supabase/admin";
import type { AppStoreConnectStatus } from "@/types/domain";

export async function getAppStoreConnectStatus(): Promise<AppStoreConnectStatus> {
  const db = createAdminClient();
  const [{ data: connection, error: connectionError }, { data: requests, error: requestsError }] = await Promise.all([
    db.from("aso_platform_connections").select("status,last_test_at,last_test_ok,last_test_message,last_sync_at").eq("provider", "appstore_connect").maybeSingle(),
    db.from("aso_analytics_report_requests").select("app_id,status,last_checked_at,last_error").order("created_at", { ascending: false }).limit(100),
  ]);
  if (connectionError || requestsError) throw new Error("Could not read App Store Connect status.");
  const ids = [...new Set((requests ?? []).map((request) => request.app_id))];
  const { data: apps, error: appsError } = ids.length ? await db.from("aso_apps").select("id,name").in("id", ids) : { data: [], error: null };
  if (appsError) throw new Error("Could not resolve report-request apps.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));
  return { status: connection?.status ?? "unconfigured", lastTestAt: connection?.last_test_at ?? null, lastTestOk: connection?.last_test_ok ?? null, lastTestMessage: connection?.last_test_message ?? null, lastSyncAt: connection?.last_sync_at ?? null, reportRequests: (requests ?? []).map((request) => ({ appName: names.get(request.app_id) ?? "Unknown app", status: request.status, lastCheckedAt: request.last_checked_at, lastError: request.last_error })) };
}
