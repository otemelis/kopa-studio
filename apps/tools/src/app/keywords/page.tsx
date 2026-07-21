import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadKeywords } from "@/services/keyword-service";

export const dynamic = "force-dynamic";
const delta = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${value}`;
export default async function KeywordsPage({ searchParams }: { searchParams: Promise<{ app?: string; country?: string }> }) {
  const filters = await searchParams; const [apps, rows] = await Promise.all([listApps(), loadKeywords({ appId: filters.app, country: filters.country, limit: 100 })]);
  const countries = [...new Set(rows.map((row) => row.country))].sort();
  return <PageShell title="Keywords"><form className="filter-form"><select name="app" defaultValue={filters.app ?? ""}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><select name="country" defaultValue={filters.country ?? ""}><option value="">All storefronts</option>{countries.map((country) => <option key={country} value={country}>{country.toUpperCase()}</option>)}</select><button type="submit">Apply filters</button></form><div className="section-head"><h2>Tracked keyword strategy</h2><span>{rows.length} shown · latest owned-app rank snapshot</span></div><div className="table-wrap"><table><thead><tr><th>Keyword</th><th>App</th><th>Market</th><th>Rank</th><th>7d</th><th>30d</th><th>Best</th><th>Priority</th><th>Status</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.linkId}><td>{row.term}</td><td><Link href={`/apps/${row.appId}`}>{row.appName}</Link></td><td>{row.country.toUpperCase()}</td><td>{row.rank ? `#${row.rank}` : "Not ranked"}</td><td>{delta(row.change7d)}</td><td>{delta(row.change30d)}</td><td>{row.bestRank ? `#${row.bestRank}` : "—"}</td><td>{row.priority}</td><td>{row.status}</td></tr>) : <tr><td colSpan={9}>No keyword records match these filters.</td></tr>}</tbody></table></div><p className="data-note">Source: public App Store collection. Results are paginated and read-only during this migration.</p></PageShell>;
}
