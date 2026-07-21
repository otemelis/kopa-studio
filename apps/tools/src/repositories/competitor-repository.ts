import { createAdminClient } from "@/lib/supabase/admin";
import type { CompetitorRow } from "@/types/domain";

export async function listCompetitors(appId?: string): Promise<CompetitorRow[]> {
  const db = createAdminClient();
  let query = db.from("aso_competitors").select("id,app_id,name").order("name").limit(100);
  if (appId) query = query.eq("app_id", appId);
  const { data: competitors, error } = await query;
  if (error) throw new Error("Could not read competitors.");
  if (!competitors?.length) return [];
  const ids = competitors.map((competitor) => competitor.id);
  const appIds = [...new Set(competitors.map((competitor) => competitor.app_id))];
  const [{ data: apps, error: appsError }, { data: snapshots, error: snapshotsError }] = await Promise.all([
    db.from("aso_apps").select("id,name").in("id", appIds),
    db.from("aso_competitor_snapshots").select("competitor_id,rating,current_version,captured_at").in("competitor_id", ids).order("captured_at", { ascending: false }).limit(500),
  ]);
  if (appsError || snapshotsError) throw new Error("Could not resolve competitor details.");
  const appById = new Map((apps ?? []).map((app) => [app.id, app.name]));
  const latest = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const snapshot of snapshots ?? []) if (!latest.has(snapshot.competitor_id)) latest.set(snapshot.competitor_id, snapshot);
  return competitors.map((competitor) => { const snapshot = latest.get(competitor.id); return { id: competitor.id, name: competitor.name, appId: competitor.app_id, appName: appById.get(competitor.app_id) ?? "Unknown app", rating: snapshot?.rating ?? null, version: snapshot?.current_version ?? null, capturedAt: snapshot?.captured_at ?? null }; });
}
