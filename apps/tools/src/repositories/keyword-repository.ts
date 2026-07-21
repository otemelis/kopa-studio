import { createAdminClient } from "@/lib/supabase/admin";
import type { KeywordRow } from "@/types/domain";

export async function listKeywordRows({ appId, country, limit = 200 }: { appId?: string; country?: string; limit?: number } = {}): Promise<KeywordRow[]> {
  const db = createAdminClient();
  let links = db.from("aso_app_keywords").select("id,app_id,keyword_id,priority,status").order("created_at", { ascending: false }).limit(limit);
  if (appId) links = links.eq("app_id", appId);
  const { data: linkRows, error: linkError } = await links;
  if (linkError) throw new Error("Could not read keyword assignments.");
  if (!linkRows?.length) return [];
  const appIds = [...new Set(linkRows.map((row) => row.app_id))];
  const keywordIds = [...new Set(linkRows.map((row) => row.keyword_id))];
  const [{ data: apps, error: appsError }, { data: keywords, error: keywordsError }] = await Promise.all([
    db.from("aso_apps").select("id,name,store_app_id").in("id", appIds),
    db.from("aso_keywords").select("id,term,country,priority").in("id", keywordIds),
  ]);
  if (appsError || keywordsError) throw new Error("Could not resolve keyword references.");
  const scopedKeywords = (keywords ?? []).filter((keyword) => !country || keyword.country === country);
  const scopedIds = scopedKeywords.map((keyword) => keyword.id);
  const { data: snapshots, error: snapshotsError } = scopedIds.length ? await db.from("aso_keyword_rank_snapshots").select("keyword_id,store_app_id,rank,change_7d,change_30d,best_rank,captured_at").eq("app_kind", "owned").in("keyword_id", scopedIds).order("captured_at", { ascending: false }).limit(1000) : { data: [], error: null };
  if (snapshotsError) throw new Error("Could not read rank snapshots.");
  const appById = new Map((apps ?? []).map((app) => [app.id, app]));
  const keywordById = new Map(scopedKeywords.map((keyword) => [keyword.id, keyword]));
  const latest = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const snapshot of snapshots ?? []) { const key = `${snapshot.keyword_id}:${snapshot.store_app_id}`; if (!latest.has(key)) latest.set(key, snapshot); }
  return linkRows.flatMap((link) => {
    const app = appById.get(link.app_id); const keyword = keywordById.get(link.keyword_id);
    if (!app || !keyword) return [];
    const latestSnapshot = latest.get(`${keyword.id}:${app.store_app_id}`);
    return [{ linkId: link.id, appId: app.id, appName: app.name, term: keyword.term, country: keyword.country, priority: link.priority ?? keyword.priority, status: link.status, rank: latestSnapshot?.rank ?? null, change7d: latestSnapshot?.change_7d ?? null, change30d: latestSnapshot?.change_30d ?? null, bestRank: latestSnapshot?.best_rank ?? null, capturedAt: latestSnapshot?.captured_at ?? null }];
  });
}
