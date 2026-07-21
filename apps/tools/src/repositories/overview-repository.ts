import { createAdminClient } from "@/lib/supabase/admin";
import type { OverviewMetrics, SyncRun } from "@/types/domain";

export async function getOverview(): Promise<OverviewMetrics> {
  const db = createAdminClient();
  const [apps, keywords, insights, latest] = await Promise.all([
    db.from("aso_apps").select("id", { count: "exact", head: true }),
    db.from("aso_app_keywords").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("aso_insights").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("aso_sync_runs").select("finished_at").in("status", ["ok", "partial"]).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (apps.error || keywords.error || insights.error || latest.error) throw new Error("Could not load overview metrics.");
  return { appCount: apps.count ?? 0, activeKeywords: keywords.count ?? 0, activeInsights: insights.count ?? 0, lastCollectionAt: latest.data?.finished_at ?? null };
}

export async function listRecentRuns(): Promise<SyncRun[]> {
  const { data, error } = await createAdminClient().from("aso_sync_runs").select("id,provider,trigger,status,started_at,finished_at,processed,succeeded,failed,error").order("started_at", { ascending: false }).limit(10);
  if (error) throw new Error("Could not load collection history.");
  return (data ?? []).map((row) => ({ id: row.id, provider: row.provider, trigger: row.trigger, status: row.status, startedAt: row.started_at, finishedAt: row.finished_at, processed: row.processed, succeeded: row.succeeded, failed: row.failed, error: row.error }));
}
