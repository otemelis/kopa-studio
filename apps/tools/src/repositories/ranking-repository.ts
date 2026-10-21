import { createAdminClient } from "@/lib/supabase/admin";
import type { RankingHistoryRow } from "@/types/domain";

export async function listRecentRankings(appId: string, days = 35): Promise<RankingHistoryRow[]> {
  const db = createAdminClient();
  const { data: app, error: appError } = await db.from("aso_apps").select("id,store_app_id").eq("id", appId).maybeSingle();
  if (appError || !app) return [];
  const { data: links, error: linksError } = await db.from("aso_app_keywords").select("keyword_id").eq("app_id", appId).eq("status", "active").limit(200);
  if (linksError || !links?.length) return [];
  const ids = links.map((link) => link.keyword_id);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: keywords, error: keywordError }, { data: snapshots, error: snapshotError }] = await Promise.all([
    db.from("aso_keywords").select("id,term,country").in("id", ids),
    db.from("aso_keyword_rank_snapshots").select("keyword_id,captured_on,rank,change_7d").eq("store_app_id", app.store_app_id).eq("app_kind", "owned").gte("captured_at", since).in("keyword_id", ids).order("captured_at", { ascending: false }).limit(1000),
  ]);
  if (keywordError || snapshotError) throw new Error("Could not read ranking history.");
  const byId = new Map((keywords ?? []).map((keyword) => [keyword.id, keyword]));
  return (snapshots ?? []).flatMap((snapshot) => { const keyword = byId.get(snapshot.keyword_id); return keyword ? [{ keyword: keyword.term, country: keyword.country, capturedOn: snapshot.captured_on, rank: snapshot.rank, change7d: snapshot.change_7d }] : []; });
}
