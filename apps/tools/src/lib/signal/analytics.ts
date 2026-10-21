import {
  dates,
  priorWindow,
  windowFor,
  type KeywordSeries,
  type RankFact,
  type SignalScope,
} from "./contracts";
export function rankSummary(
  rows: RankFact[],
  w: { start: string; end: string },
) {
  const p = rows.filter((r) => r.date >= w.start && r.date <= w.end),
    v = p.filter(
      (r) =>
        r.status === "observed" &&
        r.method === "vendor_sample" &&
        r.rank !== null,
    ),
    n = dates(w.start, w.end).length,
    mean = v.length ? v.reduce((s, r) => s + r.rank!, 0) / v.length : null;
  return {
    mean,
    volatility:
      mean === null
        ? null
        : Math.sqrt(
            v.reduce((s, r) => s + (r.rank! - mean) ** 2, 0) / v.length,
          ),
    first: v[0] ?? null,
    last: v.at(-1) ?? null,
    collected: p.filter(
      (r) =>
        r.method === "vendor_sample" &&
        ["observed", "absent"].includes(r.status),
    ).length,
    expected: n,
  };
}
export function rankComparison(series: KeywordSeries, s: SignalScope) {
  const current = rankSummary(series.points, windowFor(s)),
    previous = rankSummary(series.points, priorWindow(s));
  return {
    current,
    previous,
    movement:
      current.mean === null || previous.mean === null
        ? null
        : previous.mean - current.mean,
  };
}
export function rankScale(value: number, min = 1, max = 100) {
  return (value - min) / (max - min);
}
export const ratio = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : null;
export const cpa = (spend: number, downloads: number) =>
  ratio(spend, downloads);
export function toCSV(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))],
    cell = (v: unknown) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return [
    keys.map(cell).join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\n");
}
