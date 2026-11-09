import { AppleAdsApiV1Provider } from "@/lib/apple-ads/apple-ads-v1-provider";
import { applePopularityGenre, latestPublishedAppleWeek, refreshApplePopularity } from "@/lib/aso/apple-popularity";
import { createAdminClient } from "@/lib/supabase/admin";

type App = { id: string; category: string };
type Link = { app_id: string; keyword_id: string };
type Keyword = { id: string; country: string };
type Observation = { keyword_id: string; genre: string };
export type PopularityGroup = { appId: string; country: string; genre: string };

export const MAX_POPULARITY_GROUPS_PER_RUN = 20;

/** A group is complete only when every active keyword has an observation for Apple's latest week. */
export function planApplePopularityRefresh(apps: App[], links: Link[], keywords: Keyword[], observations: Observation[]) {
  const genreByApp = new Map(apps.map((app) => [app.id, applePopularityGenre(app.category)]));
  const keywordById = new Map(keywords.map((keyword) => [keyword.id, keyword]));
  const observed = new Set(observations.map((row) => `${row.keyword_id}:${row.genre}`));
  const groups = new Map<string, { group: PopularityGroup; missing: boolean }>();
  let unsupported = 0;
  for (const link of links) {
    const keyword = keywordById.get(link.keyword_id);
    const genre = genreByApp.get(link.app_id);
    if (!keyword || genre === undefined) throw new Error("Active popularity catalog has an unresolved app or keyword.");
    if (!genre) { unsupported++; continue; }
    const country = keyword.country.toUpperCase();
    const key = `${link.app_id}:${country}`;
    const existing = groups.get(key);
    if (existing) existing.missing ||= !observed.has(`${keyword.id}:${genre}`);
    else groups.set(key, { group: { appId: link.app_id, country, genre }, missing: !observed.has(`${keyword.id}:${genre}`) });
  }
  const pending = [...groups.values()].filter((entry) => entry.missing).map((entry) => entry.group)
    .sort((a, b) => a.appId.localeCompare(b.appId) || a.country.localeCompare(b.country));
  return { totalGroups: groups.size, pendingGroups: pending.length, unsupportedLinks: unsupported,
    selected: pending.slice(0, MAX_POPULARITY_GROUPS_PER_RUN) };
}

/** A bounded daily catch-up: each app/storefront is queried at most once per published Apple week. */
export async function refreshPendingApplePopularity() {
  const weekStart = latestPublishedAppleWeek();
  const db = createAdminClient();
  const [appsResult, linksResult, observationsResult] = await Promise.all([
    db.from("aso_apps").select("id,category").limit(1000),
    db.from("aso_app_keywords").select("app_id,keyword_id").eq("status", "active").limit(1000),
    db.from("aso_apple_keyword_popularity").select("keyword_id,genre").eq("week_start", weekStart).limit(1000),
  ]);
  if (appsResult.error || linksResult.error || observationsResult.error) throw new Error("Could not read the Apple demand refresh catalog.");
  if ((appsResult.data ?? []).length >= 1000 || (linksResult.data ?? []).length >= 1000 || (observationsResult.data ?? []).length >= 1000)
    throw new Error("Apple demand refresh catalog exceeded its safe read limit.");
  const links = (linksResult.data ?? []) as Link[];
  const keywordIds = [...new Set(links.map((link) => link.keyword_id))];
  const keywords: Keyword[] = [];
  for (let offset = 0; offset < keywordIds.length; offset += 200) {
    const { data, error } = await db.from("aso_keywords").select("id,country").in("id", keywordIds.slice(offset, offset + 200)).limit(200);
    if (error) throw new Error("Could not read active Apple demand keywords.");
    keywords.push(...(data ?? []));
  }
  const plan = planApplePopularityRefresh((appsResult.data ?? []) as App[], links, keywords, (observationsResult.data ?? []) as Observation[]);
  const api = new AppleAdsApiV1Provider();
  const failures: { appId: string; country: string; error: string }[] = [];
  let completed = 0;
  let observed = 0;
  let notReported = 0;
  for (const group of plan.selected) {
    try {
      const result = await refreshApplePopularity(group.appId, group.country, weekStart, api);
      completed++;
      observed += result.observed;
      notReported += result.notReported;
    } catch (error) {
      failures.push({ appId: group.appId, country: group.country, error: error instanceof Error ? error.message : "Refresh failed." });
    }
  }
  return { weekStart, totalGroups: plan.totalGroups, pendingAtStart: plan.pendingGroups, selected: plan.selected.length,
    completed, observed, notReported, remaining: plan.pendingGroups - completed, unsupportedLinks: plan.unsupportedLinks, failures };
}
