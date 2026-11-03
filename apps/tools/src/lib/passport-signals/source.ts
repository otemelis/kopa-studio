import "server-only";
import { readerPool } from "@/lib/pois-live/source";
import type { PassportCount } from "./model";
import { parseVercelCount, parseVercelRows } from "./model";

const VERCEL_PROJECT = "prj_3ylPIg8gaghrIBedOnrG5coSxbOH";
const VERCEL_TEAM = "team_YZN5tQECK9yBH6kFQ54p5Ejw";

export function passportWindow(days: 7 | 28, now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { start, end };
}

export async function readPassportCounts(days: 7 | 28, channel: "appstore" | "testflight") {
  const { start, end } = passportWindow(days);
  const client = await readerPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows: identity } = await client.query(
      "SELECT current_user AS role, current_setting('transaction_read_only') AS read_only, has_table_privilege(current_user, 'passport_analytics.daily_counts', 'INSERT,UPDATE,DELETE') AS can_write",
    );
    if (identity[0]?.role !== "kopa_report_reader" || identity[0]?.read_only !== "on" || identity[0]?.can_write)
      throw new Error("PASSPORT source role is not read-only");
    const { rows } = await client.query(
      `SELECT day::text AS day, build_channel AS "buildChannel", app_version AS "appVersion",
              event, dims, count::text AS count, updated_at AS "updatedAt"
         FROM passport_analytics.daily_counts
        WHERE build_channel = $1 AND day BETWEEN $2 AND $3
        ORDER BY day, app_version, event, dims LIMIT 10001`,
      [channel, start, end],
    );
    if (rows.length > 10000) throw new Error("PASSPORT report row limit reached");
    const counts: PassportCount[] = rows.map((row) => {
      const count = Number(row.count);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("PASSPORT count is invalid");
      return {
        ...row, count,
        updatedAt: row.updatedAt.toISOString(),
      };
    });
    await client.query("COMMIT");
    return { counts, start, end };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type PassportWebResult =
  | { available: true; visitors: number; pageviews: number; daily: ReturnType<typeof parseVercelRows>; paths: ReturnType<typeof parseVercelRows>; referrers: ReturnType<typeof parseVercelRows>; queriedAt: string }
  | { available: false; reason: string };

export async function readPassportWeb(days: 7 | 28): Promise<PassportWebResult> {
  const token = process.env.KOPA_VERCEL_ANALYTICS_TOKEN;
  if (!token) return { available: false, reason: "Vercel Analytics read credential is not configured." };
  const { start, end } = passportWindow(days);
  const query = async (kind: "count" | "aggregate", by?: string) => {
    const url = new URL(`https://api.vercel.com/v1/query/web-analytics/visits/${kind}`);
    url.searchParams.set("projectId", VERCEL_PROJECT);
    url.searchParams.set("teamId", VERCEL_TEAM);
    url.searchParams.set("since", start);
    url.searchParams.set("until", end);
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
    return { available: false, reason: "Vercel Analytics could not be read; no cached or sample values were substituted." };
  }
}
