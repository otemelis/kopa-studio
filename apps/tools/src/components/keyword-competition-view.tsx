"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { positionSummary, type AppPosition } from "@/lib/aso/keyword-competition";

type Series = { id: string; name: string; owned: boolean; tracked: boolean; points: AppPosition[] };
const colors = ["#176344", "#5969c6", "#c47b33", "#a14f83", "#238b78", "#aa554f", "#638844", "#8065ad", "#577487"];
const rankLabel = (point: AppPosition | null) => !point ? "Unavailable" : point.rank === null ? `Not seen · first ${point.depth}` : `#${point.rank}`;

export function KeywordCompetitionView({ series, source, keyword }: { series: Series[]; source: string; keyword: string }) {
  const [plotted, setPlotted] = useState<string[]>(series.filter((item) => item.owned || (item.tracked && positionSummary(item.points).latest?.rank != null)).slice(0, 4).map((item) => item.id));
  const [showAll, setShowAll] = useState(false);
  const visibleSeries = [...(showAll ? series : series.filter((item) => item.tracked))].sort((a, b) => (positionSummary(a.points).latest?.rank ?? 999) - (positionSummary(b.points).latest?.rank ?? 999) || Number(b.owned) - Number(a.owned) || a.name.localeCompare(b.name));
  const allDays = [...new Set(series.flatMap((item) => item.points.map((point) => point.day)))].sort();
  const dates: string[] = [];
  if (allDays.length) for (let day = Date.parse(`${allDays[0]}T00:00:00Z`); day <= Date.parse(`${allDays.at(-1)}T00:00:00Z`); day += 86_400_000) dates.push(new Date(day).toISOString().slice(0, 10));
  const chart = dates.map((date) => Object.fromEntries([["date", date], ...series.map((item) => [item.id, item.points.find((point) => point.day === date)?.rank ?? null])]));
  const maxRank = Math.max(10, ...series.flatMap((item) => item.points.map((point) => point.rank ?? 0)));
  return <>
    <section className="panel rank-selected-chart">
      <div className="panel-head"><div><h2>Position history · {keyword}</h2><p>{source} · lower position is better · gaps mean no ranked observation</p></div><span>{allDays.length ? `${allDays[0]}–${allDays.at(-1)} UTC` : "No snapshots"}</span></div>
      {chart.length ? <div className="rank-chart-frame"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 12, right: 20, bottom: 10, left: 3 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
        <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis reversed domain={[1, maxRank]} tickFormatter={(value) => `#${value}`} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={42} />
        <Tooltip contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", color: "var(--ink)" }} formatter={(value) => value == null ? "Unavailable" : `#${value}`} labelFormatter={(value) => `${value} UTC`} />
        <Legend />
        {series.filter((item) => plotted.includes(item.id)).map((item) => <Line key={item.id} dataKey={item.id} name={item.name} stroke={colors[series.indexOf(item) % colors.length]} strokeWidth={item.owned ? 3 : 2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
      </LineChart></ResponsiveContainer></div> : <p className="empty-state">No stored search-result snapshots for this keyword and source yet.</p>}
    </section>
    <div className="section-head"><h2>App movements</h2><span>First to latest stored observation in this window</span></div>
    <div className="rank-legend"><button type="button" className="secondary" aria-pressed={!showAll} onClick={() => setShowAll(false)}>Tracked apps ({series.filter((item) => item.tracked).length})</button><button type="button" className="secondary" aria-pressed={showAll} onClick={() => setShowAll(true)}>All observed apps ({series.length})</button></div>
    <div className="table-wrap rank-table-wrap"><table aria-label="Competitor keyword movements"><thead><tr><th>Plot</th><th>App</th><th>First</th><th>Latest</th><th>Change</th><th>Best in window</th><th>Last observed</th></tr></thead><tbody>
      {visibleSeries.map((item) => { const summary = positionSummary(item.points); const change = summary.change; return <tr key={item.id} className={item.owned ? "is-plotted" : undefined}>
        <td><input type="checkbox" aria-label={`Plot ${item.name}`} checked={plotted.includes(item.id)} onChange={() => setPlotted((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length < 6 ? [...current, item.id] : current)} /></td>
        <td><strong>{item.name}</strong>{item.owned ? <small>Your app</small> : item.tracked ? <small>Tracked competitor</small> : <small>Observed app</small>}<small>Apple ID {item.id}</small></td>
        <td>{rankLabel(summary.first)}</td>
        <td><span className={`rank-current ${summary.latest?.rank == null ? "rank-current-muted" : "rank-current-found"}`}>{rankLabel(summary.latest)}</span></td>
        <td><span className={`rank-movement rank-movement-${change == null ? "unknown" : change > 0 ? "up" : change < 0 ? "down" : "flat"}`}>{change == null ? summary.first && summary.latest && summary.first.day !== summary.latest.day && summary.first.rank === null && summary.latest.rank !== null ? "Newly observed" : summary.first && summary.latest && summary.first.day !== summary.latest.day && summary.first.rank !== null && summary.latest.rank === null ? "Left observed depth" : "Insufficient comparison" : change > 0 ? `↑ +${change} places` : change < 0 ? `↓ ${Math.abs(change)} places` : "= Unchanged"}</span></td>
        <td>{summary.best == null ? "Unavailable" : `#${summary.best}`}</td>
        <td>{summary.latest?.capturedAt ? new Date(summary.latest.capturedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC" : "No snapshot"}</td>
      </tr>; })}
    </tbody></table></div>
    <p className="rank-explorer-note">Positions come from stored ordered app IDs, excluding explicitly labeled ads. Apple web order can include uncertain placements; iTunes Search is catalog order, not native iPhone rank. “Not seen” means absent only within that snapshot’s depth. Missing snapshots and unranked observations are not zero positions. A change requires ranked observations on two different days.</p>
  </>;
}
