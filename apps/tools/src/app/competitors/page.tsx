import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadCompetitors } from "@/services/competitor-service";
import { loadContestedTerms } from "@/services/contested-terms-service";
import { requireUser } from "@/lib/auth";
import { CompetitorCreateForm } from "@/components/competitor-create-form";

export const dynamic = "force-dynamic";
type ContestedTerm = Awaited<ReturnType<typeof loadContestedTerms>>[number];
type CompetitorSummary = {
  key: string;
  competitorName: string;
  appName: string;
  sharedKeywords: number;
  markets: string[];
  averageAdvantage: number | null;
  strongestCluster: string;
  lastChecked: string | null;
  terms: ContestedTerm[];
};

function rankAdvantage(term: ContestedTerm) {
  if (term.competitorRank == null && term.ownedRank == null) return null;
  return (term.ownedRank ?? 101) - (term.competitorRank ?? 101);
}

function summarizeCompetitors(competitors: Awaited<ReturnType<typeof loadCompetitors>>, terms: ContestedTerm[]): CompetitorSummary[] {
  const latestByName = new Map<string, string | null>();
  for (const competitor of competitors) {
    const key = `${competitor.appName}:${competitor.name}`;
    const current = latestByName.get(key);
    if (!current || (competitor.capturedAt && competitor.capturedAt > current)) latestByName.set(key, competitor.capturedAt);
  }
  const grouped = new Map<string, CompetitorSummary>();
  for (const term of terms) {
    const key = `${term.appName}:${term.competitorName}`;
    const existing = grouped.get(key) ?? { key, competitorName: term.competitorName, appName: term.appName, sharedKeywords: 0, markets: [], averageAdvantage: null, strongestCluster: "No clear cluster", lastChecked: latestByName.get(key) ?? null, terms: [] };
    existing.terms.push(term);
    grouped.set(key, existing);
  }
  for (const summary of grouped.values()) {
    summary.sharedKeywords = new Set(summary.terms.map((term) => term.term)).size;
    summary.markets = [...new Set(summary.terms.map((term) => term.country.toUpperCase()))].sort();
    const advantages = summary.terms.map(rankAdvantage).filter((value): value is number => value !== null);
    summary.averageAdvantage = advantages.length ? Math.round((advantages.reduce((total, value) => total + value, 0) / advantages.length) * 10) / 10 : null;
    const highPriority = summary.terms.find((term) => term.priority === "high");
    const strongest = [...summary.terms].sort((a, b) => (rankAdvantage(b) ?? -999) - (rankAdvantage(a) ?? -999))[0];
    summary.strongestCluster = highPriority?.term ?? strongest?.term ?? "No clear cluster";
  }
  const empty = competitors.filter((competitor) => !grouped.has(`${competitor.appName}:${competitor.name}`)).map((competitor) => ({ key: `${competitor.appName}:${competitor.name}`, competitorName: competitor.name, appName: competitor.appName, sharedKeywords: 0, markets: [], averageAdvantage: null, strongestCluster: "No rank overlap yet", lastChecked: competitor.capturedAt, terms: [] }));
  return [...grouped.values(), ...empty].sort((a, b) => (b.averageAdvantage ?? -999) - (a.averageAdvantage ?? -999) || b.sharedKeywords - a.sharedKeywords || a.competitorName.localeCompare(b.competitorName));
}

const rank = (value: number | null) => value ? `#${value}` : "Not ranked";
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "No snapshot yet";

export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  await requireUser(); const { app: appId } = await searchParams; const [apps, competitors, terms] = await Promise.all([listApps(), loadCompetitors(appId), loadContestedTerms(appId)]);
  const summaries = summarizeCompetitors(competitors, terms);
  return <PageShell title="Competitors"><form className="filter-form"><select name="app" defaultValue={appId ?? ""}><option value="">All tracked apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><button type="submit">Apply filters</button></form><div className="section-head"><h2>Competitor list</h2><CompetitorCreateForm apps={apps.map((app) => ({ id: app.id, name: app.name }))} /></div><div className="table-wrap"><table><thead><tr><th>Competitor</th><th>Tracked against</th><th>Shared keywords</th><th>Markets</th><th>Average advantage</th><th>Strongest cluster</th><th>Last checked</th></tr></thead><tbody>{summaries.length ? summaries.map((summary) => <tr key={summary.key}><td>{summary.competitorName}</td><td>{summary.appName}</td><td>{summary.sharedKeywords}</td><td>{summary.markets.length ? summary.markets.join(", ") : "—"}</td><td>{summary.averageAdvantage == null ? "—" : `${summary.averageAdvantage > 0 ? "+" : ""}${summary.averageAdvantage}`}</td><td>{summary.strongestCluster}</td><td>{date(summary.lastChecked)}</td></tr>) : <tr><td colSpan={7}>No competitors match this filter.</td></tr>}</tbody></table></div><div className="section-head"><h2>Competitor detail</h2><span>Grouped evidence, not repeated cards</span></div><section className="competitor-detail-list">{summaries.length ? summaries.map((summary) => <details className="competitor-detail" key={summary.key}><summary><span>{summary.competitorName}</span><small>{summary.sharedKeywords} shared keyword{summary.sharedKeywords === 1 ? "" : "s"} · {summary.markets.length ? summary.markets.join(", ") : "No market overlap"}</small></summary><div className="table-wrap"><table><thead><tr><th>Term</th><th>Market</th><th>Priority</th><th>Owned rank</th><th>Competitor rank</th><th>Advantage</th></tr></thead><tbody>{summary.terms.length ? summary.terms.slice(0, 12).map((term) => <tr key={term.key}><td>{term.term}</td><td>{term.country.toUpperCase()}</td><td>{term.priority}</td><td>{rank(term.ownedRank)}</td><td>{rank(term.competitorRank)}</td><td>{rankAdvantage(term) == null ? "—" : rankAdvantage(term)}</td></tr>) : <tr><td colSpan={6}>No shared rank snapshots are available in the current comparison window.</td></tr>}</tbody></table></div></details>) : <div className="notice"><h2>No competitor evidence yet</h2><p>Add competitors and run collection to compare shared keywords across markets.</p></div>}</section></PageShell>;
}
