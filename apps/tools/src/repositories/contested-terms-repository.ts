import { createAdminClient } from "@/lib/supabase/admin";

export type ContestedTermRow = { key: string; appName: string; competitorName: string; term: string; country: string; priority: string; ownedRank: number | null; competitorRank: number | null };

export async function listContestedTerms(appId?: string): Promise<ContestedTermRow[]> {
  const db = createAdminClient();
  const { data: apps, error: appsError } = await db.from("aso_apps").select("id,name,store_app_id").limit(100);
  if (appsError) throw new Error("Could not read apps for rank comparison.");
  const scopedApps = appId ? (apps ?? []).filter((app) => app.id === appId) : apps ?? [];
  if (!scopedApps.length) return [];
  const { data: competitors, error: competitorsError } = await db.from("aso_competitors").select("id,app_id,name,store_app_id").in("app_id", scopedApps.map((app) => app.id)).limit(200);
  if (competitorsError || !competitors?.length) return [];
  const { data: links, error: linksError } = await db.from("aso_app_keywords").select("app_id,keyword_id,priority,status").in("app_id", scopedApps.map((app) => app.id)).eq("status", "active").limit(500);
  if (linksError || !links?.length) return [];
  const keywordIds = [...new Set(links.map((link) => link.keyword_id))];
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString();
  const [{ data: keywords, error: keywordsError }, { data: snapshots, error: snapshotsError }] = await Promise.all([
    db.from("aso_keywords").select("id,term,country,priority").in("id", keywordIds),
    db.from("aso_keyword_rank_snapshots").select("keyword_id,store_app_id,app_kind,rank,captured_at").in("keyword_id", keywordIds).gte("captured_at", since).order("captured_at", { ascending: false }).limit(5000),
  ]);
  if (keywordsError || snapshotsError) throw new Error("Could not read rank comparison data.");
  const latest = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const snapshot of snapshots ?? []) { const key = `${snapshot.keyword_id}:${snapshot.store_app_id}`; if (!latest.has(key)) latest.set(key, snapshot); }
  const appById = new Map(scopedApps.map((app) => [app.id, app])); const keywordById = new Map((keywords ?? []).map((keyword) => [keyword.id, keyword]));
  return competitors.flatMap((competitor) => links.filter((link) => link.app_id === competitor.app_id).flatMap((link) => { const app = appById.get(link.app_id); const keyword = keywordById.get(link.keyword_id); if (!app || !keyword) return []; const owned = latest.get(`${keyword.id}:${app.store_app_id}`)?.rank ?? null; const rival = latest.get(`${keyword.id}:${competitor.store_app_id}`)?.rank ?? null; if (owned == null && rival == null) return []; return [{ key: `${competitor.id}:${keyword.id}`, appName: app.name, competitorName: competitor.name, term: keyword.term, country: keyword.country, priority: link.priority ?? keyword.priority, ownedRank: owned, competitorRank: rival }]; })).sort((a, b) => (b.ownedRank ?? 101) - (b.competitorRank ?? 101) - ((a.ownedRank ?? 101) - (a.competitorRank ?? 101))).slice(0, 100);
}
