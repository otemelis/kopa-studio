import { createAdminClient } from "@/lib/supabase/admin";

export type SearchResult = { store_app_id?: string; name?: string; observed_position?: number | null; organic_position?: number | null; catalog_position?: number | null; explicit_ad?: boolean; classification?: string };
export type SearchSnapshot = { captured_at: string; captured_on: string; source: string; result_depth: number; results: SearchResult[] };

export async function getKeywordCompetition(appId: string, keywordId?: string, days = 28) {
  const db = createAdminClient();
  const [{ data: app, error: appError }, { data: links, error: linksError }, { data: competitors, error: competitorError }] = await Promise.all([
    db.from("aso_apps").select("id,name,store_app_id").eq("id", appId).maybeSingle(),
    db.from("aso_app_keywords").select("keyword_id").eq("app_id", appId).eq("status", "active").limit(1000),
    db.from("aso_competitors").select("id,name,store_app_id").eq("app_id", appId).order("name").limit(100),
  ]);
  if (appError || linksError || competitorError || !app) throw new Error("Could not read keyword competition setup.");
  const ids = (links ?? []).map((row) => row.keyword_id);
  const { data: keywords, error: keywordError } = ids.length
    ? await db.from("aso_keywords").select("id,term,country").in("id", ids).order("country").order("term").limit(1000)
    : { data: [], error: null };
  if (keywordError) throw new Error("Could not read tracked keywords.");
  const selected = keywordId
    ? (keywords ?? []).find((row) => row.id === keywordId) ?? null
    : (keywords ?? []).find((row) => row.country === "us" && row.term.toLowerCase() === "country counter") ?? (keywords ?? [])[0] ?? null;
  const snapshots: SearchSnapshot[] = [];
  if (selected) {
    const since = new Date(Date.now() - (days + 1) * 86_400_000).toISOString().slice(0, 10);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("aso_keyword_search_results")
        .select("captured_at,captured_on,source,result_depth,results")
        .eq("keyword_id", selected.id).gte("captured_on", since)
        .order("captured_at", { ascending: true }).range(offset, offset + 999);
      if (error) throw new Error("Could not read stored search-result observations.");
      snapshots.push(...(data ?? []) as SearchSnapshot[]);
      if ((data ?? []).length < 1000) break;
    }
  }
  return { app, keywords: keywords ?? [], competitors: competitors ?? [], selected, snapshots };
}
