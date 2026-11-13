"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AsoChangeNotes } from "@/components/aso-change-notes";
import type { ChangeAnnotation } from "@/lib/aso/change-annotations";

type Point = { date: string; averageRank: number | null; observed: number };

export function AsoSourceTrendChart({ source, caveat, points, changes = [], appId = "" }: { source: string; caveat: string; points: Point[]; changes?: ChangeAnnotation[]; appId?: string }) {
  const visible = points.some((point) => point.averageRank != null);
  const dates = [...new Set(changes.map((change) => change.date))];
  const plottedPoints = [...points];
  for (const date of dates) if (!plottedPoints.some((point) => point.date === date)) plottedPoints.push({ date, averageRank: null, observed: 0 });
  plottedPoints.sort((a, b) => a.date.localeCompare(b.date));
  return <section className="panel">
    <div className="panel-head"><div><h2>{source}</h2><p>{caveat}</p></div><span>Observed positions only</span></div>
    {visible ? <div style={{ height: 220, width: "100%" }}><ResponsiveContainer><LineChart data={plottedPoints} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
      <YAxis reversed domain={["dataMax + 4", "dataMin - 2"]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
      <Tooltip contentStyle={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--foreground)" }} formatter={(value, _name, item) => [`#${Number(value).toFixed(1)} · ${item.payload.observed} ranked terms`, "Mean position"]} />
      {dates.map((date) => <ReferenceLine key={date} x={date} stroke="var(--accent)" strokeDasharray="3 4" label={{ value: "●", position: "top", fill: "var(--accent)" }} />)}
      <Line type="monotone" dataKey="averageRank" connectNulls={false} stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
    </LineChart></ResponsiveContainer></div> : <p className="empty-state">No ranked observations for this source in the selected period.</p>}
    <AsoChangeNotes changes={changes} appId={appId} />
  </section>;
}

export type AcquisitionPoint = { date: string; impressions: number | null; pageViews: number | null; searchDownloads: number | null };

export function AsoAcquisitionTrendChart({ points }: { points: AcquisitionPoint[] }) {
  const visible = points.some((point) => point.impressions != null || point.pageViews != null || point.searchDownloads != null);
  return <section className="panel">
    <div className="panel-head"><div><h2>App Store acquisition</h2><p>App Store Connect · search and browse source rows</p></div><span>Last available reporting window</span></div>
    {visible ? <div style={{ height: 230, width: "100%" }}><ResponsiveContainer><LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
      <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
      <Tooltip contentStyle={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--foreground)" }} formatter={(value, name) => [value == null ? "Unavailable" : Number(value).toLocaleString(), name]} />
      <Legend />
      <Line type="monotone" dataKey="impressions" name="Impressions" connectNulls={false} stroke="var(--accent)" strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="pageViews" name="Product-page views" connectNulls={false} stroke="#2c9d85" strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="searchDownloads" name="Search downloads" connectNulls={false} stroke="#d38b39" strokeWidth={2} dot={false} />
    </LineChart></ResponsiveContainer></div> : <p className="empty-state">No App Store Connect acquisition events are available in this window.</p>}
  </section>;
}
