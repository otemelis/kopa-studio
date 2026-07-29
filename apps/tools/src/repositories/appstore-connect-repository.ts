import { createAdminClient } from "@/lib/supabase/admin";
import type { AppStoreConnectStatus } from "@/types/domain";

export async function getAppStoreConnectStatus(): Promise<AppStoreConnectStatus> {
  const db = createAdminClient();
  const [{ data: connection, error: connectionError }, { data: requests, error: requestsError }] = await Promise.all([
    db.from("aso_platform_connections").select("status,last_test_at,last_test_ok,last_test_message,last_sync_at").eq("provider", "appstore_connect").maybeSingle(),
    db.from("aso_analytics_report_requests").select("app_id,status,last_checked_at,last_error,last_result_state,last_result_detail,parser_version,last_segment_count,last_source_row_count,last_imported_row_count,last_rejected_row_count,last_report_headers,last_evidence_start,last_evidence_end").order("created_at", { ascending: false }).limit(100),
  ]);
  if (connectionError || requestsError) throw new Error("Could not read App Store Connect status.");
  const ids = [...new Set((requests ?? []).map((request) => request.app_id))];
  const { data: apps, error: appsError } = ids.length ? await db.from("aso_apps").select("id,name").in("id", ids) : { data: [], error: null };
  if (appsError) throw new Error("Could not resolve report-request apps.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));
  return {
    status: connection?.status ?? "unconfigured",
    lastTestAt: connection?.last_test_at ?? null,
    lastTestOk: connection?.last_test_ok ?? null,
    lastTestMessage: connection?.last_test_message ?? null,
    lastSyncAt: connection?.last_sync_at ?? null,
    reportRequests: (requests ?? []).map((request) => ({
      appName: names.get(request.app_id) ?? "Unknown app",
      status: request.status,
      lastCheckedAt: request.last_checked_at,
      lastError: request.last_error,
      lastResultState: request.last_result_state,
      lastResultDetail: request.last_result_detail,
      parserVersion: request.parser_version,
      segmentCount: request.last_segment_count,
      sourceRowCount: request.last_source_row_count,
      importedRowCount: request.last_imported_row_count,
      rejectedRowCount: request.last_rejected_row_count,
      reportHeaders: Array.isArray(request.last_report_headers) ? request.last_report_headers.filter((header): header is string => typeof header === "string") : [],
      evidenceStart: request.last_evidence_start,
      evidenceEnd: request.last_evidence_end,
    })),
  };
}
