"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { listingCoverageLabel, type ListingCoverage } from "@/lib/aso/listing-coverage";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  canonicalRankSource,
  rankMovement,
  sourceCaveat,
  sourceLabel,
  type RankObservation,
} from "@/lib/aso/progress";

type Keyword = { id: string; term: string; country: string };
type Snapshot = RankObservation & { keyword_id: string };
type Props = { keywords: Keyword[]; snapshots: Snapshot[]; days: 1 | 7 | 28; listingCoverage?: Record<string, ListingCoverage>; listingHref?: string };

const COLORS = ["#5969c6", "#d18443", "#238b78", "#a14f83", "#638844"];
const signed = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value}`;

function rankText(row: RankObservation | null) {
  if (!row) return "No observation";
  if (row.collection_status === "failed") return "Unavailable";
  if (row.found && row.rank !== null) return `#${row.rank}`;
  return `Unranked · first ${row.result_depth}`;
}

type DailySnapshot = [string, Snapshot | null];

function observedDailyRows(rows: Snapshot[], startDate: string, endDate: string): DailySnapshot[] {
  const days = new Map<string, Snapshot>();
  for (const row of rows) {
    if (row.captured_on < startDate) continue;
    const prior = days.get(row.captured_on);
    if (!prior || prior.captured_at < row.captured_at) days.set(row.captured_on, row);
  }
  const result: DailySnapshot[] = [];
  for (let time = Date.parse(`${startDate}T00:00:00Z`); time <= Date.parse(`${endDate}T00:00:00Z`); time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    result.push([date, days.get(date) ?? null]);
  }
  return result;
}

function Sparkline({ rows, color, label }: { rows: DailySnapshot[]; color: string; label: string }) {
  const width = 112;
  const height = 34;
  const valid = rows.filter(([, row]) => row?.found && row.rank !== null && row.collection_status !== "failed");
  if (valid.length < 2) return <span className="rank-spark-empty">{valid.length ? "1 point" : "No trend"}</span>;
  const maxRank = Math.max(10, ...valid.map(([, row]) => row?.rank ?? 1));
  let path = "";
  let drawing = false;
  rows.forEach(([, row], index) => {
    if (!row?.found || row.rank === null || row.collection_status === "failed") {
      drawing = false;
      return;
    }
    const x = (index / Math.max(1, rows.length - 1)) * (width - 4) + 2;
    const y = 2 + ((row.rank - 1) / Math.max(1, maxRank - 1)) * (height - 4);
    path += `${drawing ? " L" : " M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    drawing = true;
  });
  return (
    <svg className="rank-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AsoKeywordRankExplorer({ keywords, snapshots, days, listingCoverage: coverage = {}, listingHref }: Props) {
  const sourceNames = useMemo(
    () => [...new Set(snapshots.map((row) => canonicalRankSource(row.source)))].sort(),
    [snapshots],
  );
  const [source, setSource] = useState(sourceNames[0] ?? "");
  const latestDate = snapshots.reduce((latest, row) => canonicalRankSource(row.source) === source && row.captured_on > latest ? row.captured_on : latest, "");
  const startDate = latestDate
    ? new Date(Date.parse(`${latestDate}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10)
    : "9999-12-31";
  const endDate = latestDate || startDate;
  const byKeyword = useMemo(() => {
    const output = new Map<string, Snapshot[]>();
    for (const row of snapshots) {
      if (canonicalRankSource(row.source) !== source) continue;
      const rows = output.get(row.keyword_id) ?? [];
      rows.push(row);
      output.set(row.keyword_id, rows);
    }
    for (const rows of output.values()) rows.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    return output;
  }, [snapshots, source]);
  const withRows = keywords.map((keyword) => {
    const rows = byKeyword.get(keyword.id) ?? [];
    const daily = observedDailyRows(rows, startDate, endDate);
    const latest = rows.at(-1) ?? null;
    const best = rows
      .filter((row) => row.captured_on >= startDate && row.captured_on <= endDate && row.collection_status !== "failed" && row.found && row.rank !== null)
      .reduce<number | null>((value, row) => value === null ? row.rank : Math.min(value, row.rank!), null);
    const movement = rankMovement(rows, days);
    return { keyword, rows, daily, latest, best, movement };
  });
  const selectable = withRows.filter(({ rows }) => rows.length > 0);
  const [selected, setSelected] = useState<string[] | null>(null);
  const savedSelection = selected?.filter((id) => selectable.some(({ keyword }) => keyword.id === id)).slice(0, 5) ?? null;
  const activeSelected = savedSelection ?? selectable.slice(0, Math.min(3, selectable.length)).map(({ keyword }) => keyword.id);
  const plottedIds = activeSelected;
  const toggle = (id: string) => {
    setSelected((current) => {
      const existing = (current ?? activeSelected).filter((item) => selectable.some(({ keyword }) => keyword.id === item));
      if (existing.includes(id)) return existing.filter((item) => item !== id);
      if (existing.length >= 5) return existing;
      return [...existing, id];
    });
  };

  const dates = [...new Set(selectable.flatMap(({ daily }) => daily.map(([date]) => date)))].sort();
  const chartRows = dates.map((date) => {
    const point: Record<string, string | number | null> = { date };
    for (const id of plottedIds) {
      const keyword = selectable.find((item) => item.keyword.id === id);
      const row = keyword?.daily.find(([day]) => day === date)?.[1];
      point[id] = row?.found && row.rank !== null && row.collection_status !== "failed" ? row.rank : null;
    }
    return point;
  });
  const maxDepth = Math.max(10, ...snapshots.filter((row) => canonicalRankSource(row.source) === source).map((row) => row.result_depth));

  if (!sourceNames.length) return <p className="notice">No ranking observations are available yet. Missing data is not shown as rank zero.</p>;

  return (
    <section className="rank-explorer" aria-label="Keyword ranking explorer">
      <div className="rank-source-bar">
        <div>
          <strong>Ranking source</strong>
          <p>{sourceCaveat(source)}</p>
        </div>
        <div className="rank-source-options" role="group" aria-label="Select ranking source">
          {sourceNames.map((name) => (
            <button key={name} type="button" aria-pressed={source === name} onClick={() => { setSource(name); setSelected(null); }}>
              {sourceLabel(name)}
            </button>
          ))}
        </div>
      </div>

      <section className="panel rank-selected-chart">
        <div className="panel-head">
          <div><h2>Selected keyword trends</h2><p>Observed positions only · rank #1 is at the top · lines connect observations across missed collection days</p></div>
          <span>{days}-day window</span>
        </div>
        {plottedIds.length && chartRows.length ? (
          <div className="rank-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 10, right: 18, bottom: 8, left: 2 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis reversed domain={[1, maxDepth]} ticks={[1, 10, 25, 50, 75, 100].filter((tick) => tick <= maxDepth)} tickFormatter={(value) => `#${value}`} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", color: "var(--ink)" }} formatter={(value, name) => [value == null ? "Unranked / unavailable" : `#${value}`, name]} labelFormatter={(label) => `Observed ${label}`} />
                <Legend />
                {plottedIds.map((id) => {
                  const item = selectable.find(({ keyword }) => keyword.id === id);
                  if (!item) return null;
                  const color = COLORS[keywords.findIndex((keyword) => keyword.id === id) % COLORS.length];
                  return <Line key={id} type="linear" dataKey={id} name={item.keyword.term} stroke={color} strokeWidth={2.5} connectNulls dot={{ r: 2.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="empty-state">Select tracked keywords with observations to compare their trend.</p>}
      </section>

      <div className="section-head"><h2>Keyword rankings</h2><span>Best rank is the lowest position number observed in this window and source</span></div>
      <div className="table-wrap rank-table-wrap">
        <table aria-label="Keyword rankings">
          <thead><tr><th>Plot</th><th>Keyword</th><th>Market</th><th>Listing match</th><th>Latest rank</th><th>Change · {days}d</th><th>Best · {days}d</th><th>Trend</th><th>Observed</th></tr></thead>
          <tbody>{withRows.map(({ keyword, rows, daily, latest, best, movement }, index) => {
            const color = COLORS[index % COLORS.length];
            const latestStatus = latest?.collection_status === "failed" ? "Unavailable" : latest?.collection_status === "partial" ? "Partial results" : "Observed";
            const currentIsLatestFromWindow = latest && latest.captured_on >= startDate;
            const movementText = movement.state === "comparable" ? `${signed(movement.positions)} positions` : movement.state === "not_observed" ? "Unranked in comparison" : "Insufficient history";
            return <tr key={keyword.id} className={activeSelected.includes(keyword.id) ? "is-plotted" : undefined}>
              <td><input type="checkbox" aria-label={`Plot ${keyword.term}`} checked={activeSelected.includes(keyword.id)} disabled={!rows.length && !activeSelected.includes(keyword.id)} onChange={() => toggle(keyword.id)} /></td>
              <td><strong>{keyword.term}</strong></td>
              <td>{keyword.country.toUpperCase()}</td>
              <td>{listingHref ? <><Link href={listingHref}>{listingCoverageLabel(coverage[keyword.id] ?? "unavailable")}</Link>{coverage[keyword.id] === "not_visible" && currentIsLatestFromWindow && latest?.found && latest.rank !== null && latest.rank <= 10 ? <small>Top 10 here · review metadata</small> : null}</> : "Choose one market"}</td>
              <td><strong>{currentIsLatestFromWindow ? rankText(latest) : "No recent observation"}</strong><small>{latest?.collection_status === "partial" ? "Partial web results" : latest?.collection_status === "failed" ? "Collection failed" : latest && !latest.found ? `Not found in first ${latest.result_depth}` : ""}</small></td>
              <td className={movement.positions === null ? "" : movement.positions >= 0 ? "rank-improved" : "rank-declined"}>{movementText}</td>
              <td>{best === null ? "Unavailable" : `#${best}`}</td>
              <td><Sparkline rows={daily} color={color} label={`${keyword.term} observed rank trend for the last ${days} days`} /></td>
              <td>{latest ? <><span>{latestStatus}</span><small>{new Date(latest.captured_at).toLocaleDateString("en-GB", { timeZone: "UTC" })} UTC</small></> : "No snapshot"}</td>
            </tr>;
          })}{!withRows.length ? <tr><td colSpan={9}>No tracked keywords in this market.</td></tr> : null}</tbody>
        </table>
      </div>
      <p className="rank-explorer-note">Listing match checks the current public catalog name and description, not Apple&apos;s private keyword field. A strong rank without a visible match is worth reviewing, not proof of a metadata gap. Change is previous position minus current position, so positive means improved. Unranked means absent within the source&apos;s observed result depth; unavailable means the collection failed. Sources are never combined.</p>
    </section>
  );
}
