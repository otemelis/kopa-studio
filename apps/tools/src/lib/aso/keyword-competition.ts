import { canonicalRankSource } from "@/lib/aso/progress";
import type { SearchSnapshot } from "@/repositories/keyword-competition-repository";

export type AppPosition = { day: string; capturedAt: string; rank: number | null; depth: number };

export function positionInSnapshot(snapshot: SearchSnapshot, storeAppId: string): number | null {
  const row = snapshot.results.find((result) => String(result.store_app_id) === storeAppId && result.explicit_ad !== true);
  if (!row) return null;
  const position = canonicalRankSource(snapshot.source) === "itunes_catalog" ? row.catalog_position : row.organic_position;
  return Number.isInteger(position) && (position ?? 0) > 0 ? position! : null;
}

export function observedPositions(snapshots: SearchSnapshot[], source: string, storeAppId: string): AppPosition[] {
  const latestByDay = new Map<string, SearchSnapshot>();
  for (const row of snapshots) {
    if (canonicalRankSource(row.source) !== source || !Array.isArray(row.results)) continue;
    const prior = latestByDay.get(row.captured_on);
    if (!prior || prior.captured_at < row.captured_at) latestByDay.set(row.captured_on, row);
  }
  return [...latestByDay.values()].sort((a, b) => a.captured_on.localeCompare(b.captured_on)).map((row) => ({
    day: row.captured_on, capturedAt: row.captured_at, rank: positionInSnapshot(row, storeAppId), depth: row.result_depth,
  }));
}

export function positionSummary(points: AppPosition[]) {
  const first = points[0] ?? null;
  const latest = points.at(-1) ?? null;
  const ranked = points.filter((point) => point.rank !== null);
  return { first, latest, best: ranked.length ? Math.min(...ranked.map((point) => point.rank!)) : null,
    change: first?.rank != null && latest?.rank != null && first.day !== latest.day ? first.rank - latest.rank : null };
}
