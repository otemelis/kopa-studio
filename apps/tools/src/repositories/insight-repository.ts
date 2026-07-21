import { createAdminClient } from "@/lib/supabase/admin";
import type { InsightRow } from "@/types/domain";

export async function listActiveInsights({ appId, priority, limit = 100 }: { appId?: string; priority?: string; limit?: number } = {}): Promise<InsightRow[]> {
  const db = createAdminClient();
  let query = db.from("aso_insights").select("id,app_id,title,observation,recommendation,priority,confidence,impact,effort,rule_id,created_at").eq("status", "active").order("created_at", { ascending: false }).limit(limit);
  if (appId) query = query.eq("app_id", appId);
  if (priority && ["high", "medium", "low"].includes(priority)) query = query.eq("priority", priority);
  const { data, error } = await query;
  if (error) throw new Error("Could not read active insights.");
  const ids = [...new Set((data ?? []).map((row) => row.app_id).filter(Boolean))];
  const { data: apps, error: appsError } = ids.length ? await db.from("aso_apps").select("id,name").in("id", ids) : { data: [], error: null };
  if (appsError) throw new Error("Could not resolve insight app records.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));
  return (data ?? []).map((row) => ({ id: row.id, appName: row.app_id ? names.get(row.app_id) ?? null : null, title: row.title, observation: row.observation, recommendation: row.recommendation, priority: row.priority, confidence: row.confidence, impact: row.impact, effort: row.effort, ruleId: row.rule_id, createdAt: row.created_at }));
}
