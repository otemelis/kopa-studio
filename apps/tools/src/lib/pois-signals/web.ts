import "server-only";
import { parseVercelCount, parseVercelRows } from "@/lib/passport-signals/model";

const PROJECT = "prj_OK5yKf2OyzWBVfsopoeCer5bdPFx"; // withpois
const TEAM = "team_YZN5tQECK9yBH6kFQ54p5Ejw";

export type PoisWebResult =
  | { available: true; visitors: number; pageviews: number; daily: ReturnType<typeof parseVercelRows>; paths: ReturnType<typeof parseVercelRows>; referrers: ReturnType<typeof parseVercelRows>; queriedAt: string }
  | { available: false; reason: string };

export async function readPoisWeb(days: 7 | 28): Promise<PoisWebResult> {
  const token = process.env.KOPA_POIS_VERCEL_ANALYTICS_TOKEN;
  if (!token) return { available: false, reason: "POIS website analytics credential is not configured." };
  const now = new Date();
  const since = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  const query = async (kind: "count" | "aggregate", by?: string) => {
    const url = new URL(`https://api.vercel.com/v1/query/web-analytics/visits/${kind}`);
    url.searchParams.set("projectId", PROJECT);
    url.searchParams.set("teamId", TEAM);
    url.searchParams.set("since", since);
    url.searchParams.set("until", until);
    if (by) { url.searchParams.set("by", by); url.searchParams.set("limit", by === "day" ? "30" : "10"); }
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Vercel Analytics HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  try {
    const [count, daily, paths, referrers] = await Promise.all([
      query("count"), query("aggregate", "day"), query("aggregate", "requestPath"), query("aggregate", "referrerHostname"),
    ]);
    return { available: true, ...parseVercelCount(count),
      daily: parseVercelRows(daily, "day"), paths: parseVercelRows(paths, "requestPath"),
      referrers: parseVercelRows(referrers, "referrerHostname"), queriedAt: new Date().toISOString() };
  } catch {
    return { available: false, reason: "POIS Vercel Analytics could not be read; no cached or sample values were substituted." };
  }
}
