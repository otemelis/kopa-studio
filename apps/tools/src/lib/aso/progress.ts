export type RankSource = "apple_web_search" | "itunes_catalog" | "public_store";
export type RankObservation = {
  captured_at: string;
  captured_on: string;
  rank: number | null;
  found: boolean;
  result_depth: number;
  collection_status: "ok" | "partial" | "failed";
  source: string;
};

export type RankMovement = {
  state: "comparable" | "not_observed" | "insufficient";
  current: RankObservation | null;
  previous: RankObservation | null;
  positions: number | null;
};

export function isCollectionRunStalled(status: string, startedAt: string, now = Date.now()): boolean {
  return status === "running" && now - Date.parse(startedAt) > 6 * 60_000;
}

export function rankMovement(rows: RankObservation[], days: 1 | 7 | 28): RankMovement {
  const usable = rows.filter((row) => row.collection_status !== "failed")
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  const current = usable.at(-1) ?? null;
  if (!current) return { state: "insufficient", current: null, previous: null, positions: null };
  const target = Date.parse(current.captured_on) - days * 86_400_000;
  const tolerance = days === 1 ? 2 : days === 7 ? 3 : 5;
  const previous = usable.slice(0, -1).map((row) => ({ row, distance: Math.abs(Date.parse(row.captured_on) - target) }))
    .filter(({ distance }) => distance <= tolerance * 86_400_000)
    .sort((a, b) => a.distance - b.distance)[0]?.row ?? null;
  if (!previous) return { state: "insufficient", current, previous: null, positions: null };
  if (!current.found || current.rank == null || !previous.found || previous.rank == null) {
    return { state: "not_observed", current, previous, positions: null };
  }
  return { state: "comparable", current, previous, positions: previous.rank - current.rank };
}

export function sourceLabel(source: string): string {
  if (source === "apple_web_search") return "Apple web search";
  if (source === "itunes_catalog" || source === "public_store") return "iTunes Search catalog";
  return source || "Unknown source";
}

export function canonicalRankSource(source: string): string {
  // The legacy public_store rank rows were written only by searchApps(), the
  // iTunes Search provider. Normalize that historical alias without joining
  // it to Apple web search observations.
  return source === "public_store" ? "itunes_catalog" : source;
}

export function observedRank(row: RankObservation | null): string {
  if (!row) return "No snapshot";
  if (row.collection_status === "failed") return "Unavailable";
  if (row.found && row.rank != null) return `#${row.rank}`;
  return `Not found in first ${row.result_depth}`;
}

export function sourceCaveat(source: string): string {
  if (source === "apple_web_search") return "Web result order; labeled ads excluded, other placements may be uncertain.";
  if (source === "public_store" || source === "itunes_catalog") return "Catalog order; not native organic rank.";
  return "Source-specific observation.";
}
