"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContestedTermRow } from "@/repositories/contested-terms-repository";
import type { ExperimentRow, InsightRow, KeywordRow } from "@/types/domain";

type KeywordManagerProps = {
  apps: Array<{ id: string; name: string }>;
  rows: KeywordRow[];
  contestedTerms?: ContestedTermRow[];
  insights?: InsightRow[];
  changes?: ExperimentRow[];
};

type ColumnKey = "keyword" | "app" | "market" | "priority" | "rank" | "change7d" | "change30d" | "best" | "metadata" | "ads" | "updated" | "status";
type SortKey = ColumnKey;
type KeywordColumn = { key: ColumnKey; label: string; value: (row: KeywordRow) => string; sortValue: (row: KeywordRow) => string | number };
type SavedKeywordView = { search: string; rankBucket: string; metadataFilter: string; adsFilter: string; sortKey: SortKey; sortDirection: "asc" | "desc"; visibleColumns: ColumnKey[] };

const delta = (value: number | null) => value == null ? "-" : `${value > 0 ? "+" : ""}${value}`;
const rank = (value: number | null) => value ? `#${value}` : "Not ranked";
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value)) : "-";
const textIncludes = (haystack: string | null | undefined, needle: string) => (haystack ?? "").toLowerCase().includes(needle.toLowerCase());
const columns: KeywordColumn[] = [
  { key: "keyword", label: "Keyword", value: (row) => row.term, sortValue: (row) => row.term.toLowerCase() },
  { key: "app", label: "App", value: (row) => row.appName, sortValue: (row) => row.appName.toLowerCase() },
  { key: "market", label: "Market", value: (row) => row.country.toUpperCase(), sortValue: (row) => row.country },
  { key: "priority", label: "Priority", value: (row) => row.priority, sortValue: (row) => ({ high: 0, medium: 1, low: 2 })[row.priority] },
  { key: "rank", label: "Current rank", value: (row) => rank(row.rank), sortValue: (row) => row.rank ?? 999 },
  { key: "change7d", label: "7d", value: (row) => delta(row.change7d), sortValue: (row) => row.change7d ?? -999 },
  { key: "change30d", label: "30d", value: (row) => delta(row.change30d), sortValue: (row) => row.change30d ?? -999 },
  { key: "best", label: "Best", value: (row) => row.bestRank ? `#${row.bestRank}` : "-", sortValue: (row) => row.bestRank ?? 999 },
  { key: "metadata", label: "Metadata", value: (row) => row.metadataPresence, sortValue: (row) => row.metadataPresence },
  { key: "ads", label: "Ads", value: (row) => row.adsStatus, sortValue: (row) => row.adsStatus },
  { key: "updated", label: "Updated", value: (row) => shortDate(row.capturedAt), sortValue: (row) => row.capturedAt ? Date.parse(row.capturedAt) : 0 },
  { key: "status", label: "Status", value: (row) => row.status, sortValue: (row) => row.status },
];
const defaultVisible = new Set<ColumnKey>(columns.map((column) => column.key));
const storageKey = "kopa.keyword-intelligence.view.v1";
const defaultView: SavedKeywordView = { search: "", rankBucket: "all", metadataFilter: "all", adsFilter: "all", sortKey: "rank", sortDirection: "asc", visibleColumns: columns.map((column) => column.key) };
const columnKeys = new Set(columns.map((column) => column.key));

function isColumnKey(value: string): value is ColumnKey {
  return columnKeys.has(value as ColumnKey);
}

export function KeywordManager({ apps, rows, contestedTerms = [], insights = [], changes = [] }: KeywordManagerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | string | null>(null);
  const [selected, setSelected] = useState<KeywordRow | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");
  const [rankBucket, setRankBucket] = useState("all");
  const [metadataFilter, setMetadataFilter] = useState("all");
  const [adsFilter, setAdsFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(defaultVisible);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SavedKeywordView>;
      if (typeof parsed.search === "string") setSearch(parsed.search);
      if (typeof parsed.rankBucket === "string") setRankBucket(parsed.rankBucket);
      if (typeof parsed.metadataFilter === "string") setMetadataFilter(parsed.metadataFilter);
      if (typeof parsed.adsFilter === "string") setAdsFilter(parsed.adsFilter);
      if (typeof parsed.sortKey === "string" && isColumnKey(parsed.sortKey)) setSortKey(parsed.sortKey);
      if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") setSortDirection(parsed.sortDirection);
      if (Array.isArray(parsed.visibleColumns)) {
        const restored = parsed.visibleColumns.filter((key): key is ColumnKey => typeof key === "string" && isColumnKey(key));
        if (restored.length) setVisibleColumns(new Set(restored));
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  const filteredRows = rows
    .filter((row) => !search || row.term.toLowerCase().includes(search.toLowerCase()) || row.appName.toLowerCase().includes(search.toLowerCase()))
    .filter((row) => rankBucket === "all" || (rankBucket === "top10" && row.rank != null && row.rank <= 10) || (rankBucket === "top25" && row.rank != null && row.rank <= 25) || (rankBucket === "top100" && row.rank != null && row.rank <= 100) || (rankBucket === "unranked" && row.rank == null))
    .filter((row) => metadataFilter === "all" || row.metadataPresence === metadataFilter)
    .filter((row) => adsFilter === "all" || row.adsStatus === adsFilter);
  const visibleColumnList = columns.filter((column) => visibleColumns.has(column.key));
  const sortedRows = [...filteredRows].sort((a, b) => {
    const column = columns.find((item) => item.key === sortKey) ?? columns[0];
    const aValue = column.sortValue(a);
    const bValue = column.sortValue(b);
    const result = typeof aValue === "number" && typeof bValue === "number" ? aValue - bValue : String(aValue).localeCompare(String(bValue));
    return sortDirection === "asc" ? result : -result;
  });

  function changeSort(next: SortKey) {
    if (next === sortKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(next);
    setSortDirection(next === "rank" || next === "best" ? "asc" : "desc");
  }

  function toggleColumn(key: ColumnKey) {
    const next = new Set(visibleColumns);
    if (next.has(key) && next.size > 1) next.delete(key);
    else next.add(key);
    setVisibleColumns(next);
  }

  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
    const header = visibleColumnList.map((column) => column.label);
    const lines = sortedRows.map((row) => visibleColumnList.map((column) => escape(column.value(row))).join(","));
    const blob = new Blob([[header.map(escape).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kopa-keyword-intelligence.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function saveView() {
    const payload: SavedKeywordView = { search, rankBucket, metadataFilter, adsFilter, sortKey, sortDirection, visibleColumns: [...visibleColumns] };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setSavedMessage("View saved on this browser.");
  }

  function resetView() {
    window.localStorage.removeItem(storageKey);
    setSearch(defaultView.search);
    setRankBucket(defaultView.rankBucket);
    setMetadataFilter(defaultView.metadataFilter);
    setAdsFilter(defaultView.adsFilter);
    setSortKey(defaultView.sortKey);
    setSortDirection(defaultView.sortDirection);
    setVisibleColumns(new Set(defaultView.visibleColumns));
    setSavedMessage("View reset.");
  }

  async function request(url: string, method: string, body?: unknown): Promise<void> {
    setPending(true);
    setMessage("");
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Request failed.");
      return;
    }
    setMode(null);
    setSelected(null);
    router.refresh();
  }

  return <>
    <div className="section-head"><h2>Tracked keyword strategy</h2><button className="primary compact" onClick={() => setMode(mode === "add" ? null : "add")}>{mode === "add" ? "Close" : "Add keywords"}</button></div>
    {mode === "add" && <form action={(form) => request("/api/keywords", "POST", { appId: form.get("appId"), terms: String(form.get("terms")).split(/[\n,]/).map((item) => item.trim()).filter(Boolean), country: form.get("country"), priority: form.get("priority") })} className="management-form">
      <label>App<select name="appId">{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
      <label>Keywords (comma or line separated)<textarea name="terms" required /></label>
      <label>Storefront<input name="country" defaultValue="us" maxLength={2} required /></label>
      <label>Priority<select name="priority" defaultValue="medium"><option>high</option><option>medium</option><option>low</option></select></label>
      <button className="primary" disabled={pending}>{pending ? "Saving..." : "Start tracking"}</button>
    </form>}
    {message && <p className="error">{message}</p>}
    <div className="table-tools">
      <input aria-label="Search keywords" placeholder="Search keywords or apps" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select aria-label="Rank bucket" value={rankBucket} onChange={(event) => setRankBucket(event.target.value)}><option value="all">All ranks</option><option value="top10">Top 10</option><option value="top25">Top 25</option><option value="top100">Top 100</option><option value="unranked">Unranked</option></select>
      <select aria-label="Metadata presence" value={metadataFilter} onChange={(event) => setMetadataFilter(event.target.value)}><option value="all">All metadata</option><option value="title">Title</option><option value="subtitle">Subtitle</option><option value="missing">Missing</option><option value="unknown">Unknown</option></select>
      <select aria-label="Ads activity" value={adsFilter} onChange={(event) => setAdsFilter(event.target.value)}><option value="all">All ads states</option><option value="both">Exact + broad</option><option value="exact">Exact</option><option value="broad">Broad</option><option value="negative">Negative</option><option value="inactive">Inactive</option><option value="none">No paid coverage</option></select>
      <select aria-label="Sort keywords" value={sortKey} onChange={(event) => changeSort(event.target.value as SortKey)}>{columns.map((column) => <option key={column.key} value={column.key}>Sort by {column.label}</option>)}</select>
      <button type="button" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}>{sortDirection === "asc" ? "Ascending" : "Descending"}</button>
      <button type="button" onClick={saveView}>Save view</button>
      <button type="button" onClick={resetView}>Reset view</button>
      <button type="button" onClick={exportCsv}>Export CSV</button>
      <span>{sortedRows.length} of {rows.length}</span>
    </div>
    {savedMessage ? <p className="data-note">{savedMessage}</p> : null}
    <details className="column-controls"><summary>Columns</summary><div>{columns.map((column) => <label key={column.key}><input type="checkbox" checked={visibleColumns.has(column.key)} onChange={() => toggleColumn(column.key)} /> {column.label}</label>)}</div></details>
    <div className="table-wrap keyword-table"><table>
      <thead><tr>{visibleColumnList.map((column) => <th key={column.key}><button className="table-sort" type="button" onClick={() => changeSort(column.key)}>{column.label}{sortKey === column.key ? ` ${sortDirection === "asc" ? "↑" : "↓"}` : ""}</button></th>)}<th>Actions</th></tr></thead>
      <tbody>{sortedRows.length ? sortedRows.map((row) => <KeywordLine key={row.linkId} row={row} columns={visibleColumnList} editing={mode === row.linkId} pending={pending} onOpen={() => setSelected(row)} onEdit={() => setMode(row.linkId)} onCancel={() => setMode(null)} onSave={(form) => request(`/api/keywords/${row.linkId}`, "PATCH", { term: form.get("term"), country: form.get("country"), priority: form.get("priority"), status: form.get("status") })} onDelete={() => { if (confirm(`Stop tracking "${row.term}" for ${row.appName}?`)) request(`/api/keywords/${row.linkId}`, "DELETE"); }} />) : <tr><td colSpan={visibleColumnList.length + 1}>No keyword records match these filters.</td></tr>}</tbody>
    </table></div>
    {selected ? <KeywordDetailDrawer row={selected} contestedTerms={contestedTerms} insights={insights} changes={changes} onClose={() => setSelected(null)} /> : null}
  </>;
}

function KeywordLine({ row, columns, editing, pending, onOpen, onEdit, onCancel, onSave, onDelete }: { row: KeywordRow; columns: KeywordColumn[]; editing: boolean; pending: boolean; onOpen: () => void; onEdit: () => void; onCancel: () => void; onSave: (form: FormData) => void; onDelete: () => void }) {
  if (editing) return <tr><td colSpan={columns.length + 1}><form action={onSave} className="inline-form"><input name="term" defaultValue={row.term} required /><input name="country" defaultValue={row.country} maxLength={2} required /><select name="priority" defaultValue={row.priority}><option>high</option><option>medium</option><option>low</option></select><select name="status" defaultValue={row.status}><option>active</option><option>paused</option></select><button disabled={pending}>Save</button><button type="button" onClick={onCancel}>Cancel</button></form></td></tr>;
  return <tr className="clickable-row" onClick={onOpen}>
    {columns.map((column) => <td key={column.key}>{column.value(row)}</td>)}<td><button onClick={(event) => { event.stopPropagation(); onEdit(); }}>Edit</button> <button onClick={(event) => { event.stopPropagation(); onDelete(); }}>Delete</button></td>
  </tr>;
}

function KeywordDetailDrawer({ row, contestedTerms, insights, changes, onClose }: { row: KeywordRow; contestedTerms: ContestedTermRow[]; insights: InsightRow[]; changes: ExperimentRow[]; onClose: () => void }) {
  const competitorsAbove = contestedTerms.filter((term) => term.appName === row.appName && term.term.toLowerCase() === row.term.toLowerCase() && term.country === row.country && term.competitorRank !== null && (row.rank === null || term.competitorRank < row.rank)).slice(0, 6);
  const relatedInsights = insights.filter((insight) => (!insight.appName || insight.appName === row.appName) && (textIncludes(insight.title, row.term) || textIncludes(insight.observation, row.term) || textIncludes(insight.recommendation, row.term))).slice(0, 4);
  const relatedChanges = changes.filter((change) => change.appId === row.appId && (change.country === row.country || change.country === "all")).slice(0, 4);

  return <aside className="detail-drawer" aria-label="Keyword detail">
    <header><div><p className="eyebrow">Keyword detail</p><h2>{row.term}</h2><span>{row.appName} · {row.country.toUpperCase()}</span></div><button onClick={onClose} aria-label="Close keyword detail">Close</button></header>
    <section className="drawer-metrics">
      <div><span>Current rank</span><strong>{rank(row.rank)}</strong></div>
      <div><span>Best rank</span><strong>{row.bestRank ? `#${row.bestRank}` : "-"}</strong></div>
      <div><span>7d movement</span><strong>{delta(row.change7d)}</strong></div>
      <div><span>Updated</span><strong>{shortDate(row.capturedAt)}</strong></div>
    </section>
    <dl className="drawer-details">
      <div><dt>Priority</dt><dd>{row.priority}</dd></div>
      <div><dt>Metadata presence</dt><dd>{row.metadataPresence}</dd></div>
      <div><dt>Apple Ads status</dt><dd>{row.adsStatus}</dd></div>
      <div><dt>Tracking status</dt><dd>{row.status}</dd></div>
    </dl>
    <section><h3>Competitors above us</h3>{competitorsAbove.length ? <ul className="drawer-list">{competitorsAbove.map((item) => <li key={item.key}><span>{item.competitorName}</span><strong>{rank(item.competitorRank)}</strong></li>)}</ul> : <p>No imported competitor is currently above this app for the keyword.</p>}</section>
    <section><h3>Recommendations</h3>{relatedInsights.length ? <ul className="drawer-copy-list">{relatedInsights.map((insight) => <li key={insight.id}><strong>{insight.title}</strong><span>{insight.recommendation}</span></li>)}</ul> : <p>No active recommendation directly references this keyword.</p>}</section>
    <section><h3>Change Log annotations</h3>{relatedChanges.length ? <ul className="drawer-copy-list">{relatedChanges.map((change) => <li key={change.id}><strong>{change.title}</strong><span>{change.startDate ?? "Not dated"} · {change.changeType.replaceAll("_", " ")}</span></li>)}</ul> : <p>No related logged changes for this app and market.</p>}</section>
  </aside>;
}
