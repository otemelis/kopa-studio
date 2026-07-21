import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadRecentRankings } from "@/services/ranking-service";

export const dynamic = "force-dynamic";
const movement = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${value}`;
export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const { app: appId } = await searchParams; const apps = await listApps(); const selected = appId || apps[0]?.id; const rows = selected ? await loadRecentRankings(selected) : [];
  return <PageShell title="Rankings"><form className="filter-form"><select name="app" defaultValue={selected ?? ""}>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><button type="submit">Load history</button></form><div className="section-head"><h2>Owned-app rank history</h2><span>Latest 35 days · {rows.length} observations</span></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Keyword</th><th>Market</th><th>Rank</th><th>7-day movement</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row.keyword}:${row.capturedOn}:${index}`}><td>{row.capturedOn}</td><td>{row.keyword}</td><td>{row.country.toUpperCase()}</td><td>{row.rank ? `#${row.rank}` : "Not ranked"}</td><td>{movement(row.change7d)}</td></tr>) : <tr><td colSpan={5}>Choose an app with active keywords to see collected rank history.</td></tr>}</tbody></table></div><p className="data-note">Source: existing public App Store collector. The migration does not recalculate historical rank fields.</p></PageShell>;
}
