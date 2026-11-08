import { AppleAdsApiV1Provider, type AppleAdsV1Result } from "@/lib/apple-ads/apple-ads-v1-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const APPLE_POPULARITY_SOURCE = "apple_ads_search_term_popularity";
const GENRES: Record<string, string> = {
  Lifestyle: "LIFESTYLE",
  Travel: "TRAVEL",
  "Health & Fitness": "HEALTH_FITNESS",
};

export const applePopularityGenre = (category: string): string | null => GENRES[category] ?? null;

export type PopularityObservation = {
  keyword_id: string; country: string; genre: string; week_start: string;
  status: "observed" | "not_reported";
  popularity_1_to_100: number | null; popularity_in_genre: number | null;
  popularity_1_to_5: number | null; rank_in_genre: number | null;
  collected_at: string; request_sha256: string; response_sha256: string; source: typeof APPLE_POPULARITY_SOURCE;
};

const termKey = (term: string) => term.normalize("NFKC").trim().toLocaleLowerCase("und");
const score = (value: unknown, max: number) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;

/** Apple publishes the previous Sunday–Saturday week on Monday at 07:00 UTC. */
export function latestPublishedAppleWeek(now = new Date()): string {
  const utcDay = now.getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday, 7);
  const publishedMonday = now.getTime() < monday ? monday - 7 * 86_400_000 : monday;
  return new Date(publishedMonday - 8 * 86_400_000).toISOString().slice(0, 10);
}

export function parseApplePopularity(
  keywords: { id: string; term: string }[], country: string, genre: string, weekStart: string,
  pages: AppleAdsV1Result<Record<string, unknown>>[],
): PopularityObservation[] {
  const byTerm = new Map(keywords.map((keyword) => [termKey(keyword.term), keyword.id]));
  if (byTerm.size !== keywords.length) throw new Error("Duplicate normalized tracked terms in this market.");
  const found = new Map<string, Record<string, unknown>>();
  for (const page of pages) {
    if (page.status !== 200 || !Array.isArray(page.result.rows)) throw new Error("Apple popularity response was incomplete.");
    for (const raw of page.result.rows) {
      if (!raw || typeof raw !== "object") throw new Error("Apple popularity row was malformed.");
      const row = raw as Record<string, unknown>;
      if (row.countryOrRegion !== country || row.genre !== genre || row.week !== weekStart || typeof row.searchTerm !== "string") throw new Error("Apple popularity scope did not match the request.");
      const key = termKey(row.searchTerm);
      if (!byTerm.has(key)) throw new Error("Apple returned an unrequested term.");
      if (found.has(key)) throw new Error("Apple returned duplicate popularity rows.");
      found.set(key, row);
    }
  }
  const collectedAt = pages.at(-1)?.receivedAt;
  if (!collectedAt || !pages.length) throw new Error("No successful Apple popularity response.");
  return keywords.map(({ id, term }) => {
    const row = found.get(termKey(term));
    return {
      keyword_id: id, country, genre, week_start: weekStart,
      status: row ? "observed" : "not_reported",
      popularity_1_to_100: row ? score(row.searchPopularity1to100, 100) : null,
      popularity_in_genre: row ? score(row.searchPopularityInGenre, 100) : null,
      popularity_1_to_5: row ? score(row.searchPopularity1to5, 5) : null,
      rank_in_genre: row ? score(row.rankInGenre, Number.MAX_SAFE_INTEGER) : null,
      collected_at: collectedAt,
      request_sha256: pages[0].requestSha256,
      response_sha256: pages.at(-1)!.responseSha256,
      source: APPLE_POPULARITY_SOURCE,
    };
  });
}

/** Apple's response pageSize can equal the returned count, including zero; use the requested limit. */
export function hasNextApplePopularityPage(rowCount: number, requestedPageSize: number): boolean {
  if (!Number.isSafeInteger(rowCount) || rowCount < 0 || rowCount > requestedPageSize) throw new Error("Apple popularity page length was invalid.");
  return rowCount === requestedPageSize;
}

export async function refreshApplePopularity(appId: string, countryInput: string, weekStart = latestPublishedAppleWeek(), api = new AppleAdsApiV1Provider()) {
  const country = countryInput.toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("A two-letter storefront country is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 0 || weekStart > latestPublishedAppleWeek()) throw new Error("Choose a published Sunday-start Apple week.");
  const db = createAdminClient();
  const { data: app, error: appError } = await db.from("aso_apps").select("id,category").eq("id", appId).single();
  if (appError || !app) throw new Error("Tracked app was not found.");
  const genre = applePopularityGenre(app.category);
  if (!genre) throw new Error("The app's Apple genre has not been mapped for popularity queries.");
  const { data: links, error: linksError } = await db.from("aso_app_keywords").select("keyword_id").eq("app_id", appId).eq("status", "active").limit(1000);
  if (linksError) throw new Error("Could not read active keyword links.");
  const ids = (links ?? []).map((link) => link.keyword_id);
  if (!ids.length) return { country, genre, weekStart, tracked: 0, observed: 0, notReported: 0 };
  const { data: rawKeywords, error: keywordsError } = await db.from("aso_keywords").select("id,term,country").in("id", ids).eq("country", country.toLowerCase()).limit(1000);
  if (keywordsError) throw new Error("Could not read tracked keywords.");
  const keywords = (rawKeywords ?? []).map(({ id, term }) => ({ id, term }));
  if (!keywords.length) return { country, genre, weekStart, tracked: 0, observed: 0, notReported: 0 };
  if (keywords.length > 100) throw new Error("This market exceeds the bounded 100-term refresh limit.");
  const end = new Date(Date.parse(`${weekStart}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  const pages: AppleAdsV1Result<Record<string, unknown>>[] = [];
  let offset = 0;
  const pageSize = 100;
  for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
    const page = await api.querySearchTermPopularity({ countryOrRegion: country, genre, start: weekStart, end, searchTerms: keywords.map((keyword) => keyword.term), weeks: [weekStart], offset, pageSize });
    pages.push(page);
    const rows = page.result.rows;
    if (!Array.isArray(rows)) throw new Error("Apple popularity response did not contain rows.");
    if (page.pagination?.offset !== undefined && page.pagination.offset !== offset) throw new Error("Apple popularity pagination offset did not match the request.");
    if (!hasNextApplePopularityPage(rows.length, pageSize)) break;
    offset += rows.length;
    if (pageNumber === 9) throw new Error("Apple popularity pagination exceeded the safe page limit.");
  }
  const observations = parseApplePopularity(keywords, country, genre, weekStart, pages);
  const { error: writeError } = await db.from("aso_apple_keyword_popularity").upsert(observations, { onConflict: "keyword_id,genre,week_start" });
  if (writeError) throw new Error("Could not store validated Apple popularity observations.");
  return { country, genre, weekStart, tracked: observations.length, observed: observations.filter((row) => row.status === "observed").length, notReported: observations.filter((row) => row.status === "not_reported").length };
}
