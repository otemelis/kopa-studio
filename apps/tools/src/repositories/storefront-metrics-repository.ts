import { summarizeStorefrontMetrics } from "@/lib/metrics";
import { createAdminClient } from "@/lib/supabase/admin";

export async function listStorefrontMetricSummaries(days = 28) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const db = createAdminClient();
  const { data, error } = await db.from("aso_storefront_metrics").select("app_id,country,event,count").gte("date", since).order("date", { ascending: false }).limit(5000);
  if (error) throw new Error("Could not read storefront analytics.");
  const summaries = summarizeStorefrontMetrics((data ?? []).map((row) => ({ appId: row.app_id, country: row.country, event: row.event, count: row.count })));
  if (!summaries.length) return [];
  const { data: apps, error: appsError } = await db.from("aso_apps").select("id,name").in("id", [...new Set(summaries.map((summary) => summary.appId))]);
  if (appsError) throw new Error("Could not resolve storefront analytics apps.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));
  return summaries.map((summary) => ({ ...summary, appName: names.get(summary.appId) ?? "Unknown app" }));
}
