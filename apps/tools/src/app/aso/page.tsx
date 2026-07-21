import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";
import { listContestedTerms } from "@/repositories/contested-terms-repository";
import { listKeywordRows } from "@/repositories/keyword-repository";
import { listStorefronts } from "@/repositories/storefront-repository";

export const dynamic = "force-dynamic";

type SearchParams = { app?: string; country?: string; period?: string };

const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const formatSigned = (value: number | null) => value === null ? "-" : `${value > 0 ? "+" : ""}${value}`;
const contextQuery = (filters: SearchParams) => {
  const params = new URLSearchParams();
  if (filters.app) params.set("app", filters.app);
  if (filters.country) params.set("country", filters.country);
  if (filters.period) params.set("period", filters.period);
  const value = params.toString();
  return value ? `?${value}` : "";
};

export default async function AsoOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const filters = await searchParams;
  const [keywords, contestedTerms, markets] = await Promise.all([
    listKeywordRows({ appId: filters.app, country: filters.country, limit: 200 }),
    listContestedTerms(filters.app),
    listStorefronts(filters.app),
  ]);
  const scopedContested = contestedTerms.filter((row) => !filters.country || row.country === filters.country);
  const scopedMarkets = markets.filter((row) => !filters.country || row.country === filters.country);
  const activeKeywords = keywords.filter((keyword) => keyword.status === "active");
  const ranked = activeKeywords.filter((keyword) => keyword.rank !== null);
  const top10 = ranked.filter((keyword) => keyword.rank !== null && keyword.rank <= 10);
  const top25 = ranked.filter((keyword) => keyword.rank !== null && keyword.rank <= 25);
  const top100 = ranked.filter((keyword) => keyword.rank !== null && keyword.rank <= 100);
  const highPriorityUnranked = activeKeywords.filter((keyword) => keyword.priority === "high" && keyword.rank === null);
  const metadataOpportunities = activeKeywords.filter((keyword) => keyword.metadataPresence === "missing" && (keyword.priority === "high" || (keyword.rank !== null && keyword.rank > 10 && keyword.rank <= 50)));
  const movementRows = ranked.filter((keyword) => keyword.change7d !== null);
  const largestGains = [...movementRows].filter((keyword) => (keyword.change7d ?? 0) > 0).sort((a, b) => (b.change7d ?? 0) - (a.change7d ?? 0)).slice(0, 5);
  const largestLosses = [...movementRows].filter((keyword) => (keyword.change7d ?? 0) < 0).sort((a, b) => (a.change7d ?? 0) - (b.change7d ?? 0)).slice(0, 5);
  const movementTotal = movementRows.reduce((total, keyword) => total + (keyword.change7d ?? 0), 0);
  const visibilityTrend = !movementRows.length ? "Waiting for movement" : movementTotal > 0 ? "Improving" : movementTotal < 0 ? "Declining" : "Flat";
  const competitorSummary = new Map<string, { competitorName: string; shared: number; advantage: number; strongest: string | null; lastDelta: number }>();
  for (const row of scopedContested) {
    const owned = row.ownedRank ?? 101;
    const rival = row.competitorRank ?? 101;
    const delta = owned - rival;
    const current = competitorSummary.get(row.competitorName) ?? { competitorName: row.competitorName, shared: 0, advantage: 0, strongest: null, lastDelta: -Infinity };
    current.shared += 1;
    current.advantage += delta;
    if (delta > current.lastDelta) {
      current.strongest = row.term;
      current.lastDelta = delta;
    }
    competitorSummary.set(row.competitorName, current);
  }
  const strongestCompetitor = [...competitorSummary.values()].sort((a, b) => (b.advantage / Math.max(1, b.shared)) - (a.advantage / Math.max(1, a.shared)))[0] ?? null;
  const readinessCounts = scopedMarkets.reduce<Record<string, number>>((counts, market) => {
    counts[market.readiness] = (counts[market.readiness] ?? 0) + 1;
    return counts;
  }, {});
  const query = contextQuery(filters);

  return <PageShell title="ASO Intelligence">
    <section className="metric-grid">
      <article className="metric-card"><p>Visibility trend</p><strong>{visibilityTrend}</strong><small>{movementRows.length ? `${formatNumber(movementRows.length)} keywords with 7-day movement` : "Waiting for rank history"}</small></article>
      <article className="metric-card"><p>Tracked keywords</p><strong>{formatNumber(activeKeywords.length)}</strong><small>{formatNumber(highPriorityUnranked.length)} high-priority unranked</small></article>
      <article className="metric-card"><p>Top 10</p><strong>{formatNumber(top10.length)}</strong><small>{formatNumber(top25.length)} in top 25 · {formatNumber(top100.length)} in top 100</small></article>
      <article className="metric-card"><p>Metadata gaps</p><strong>{formatNumber(metadataOpportunities.length)}</strong><small>Priority or near-page-one missing terms</small></article>
    </section>

    <div className="section-head"><h2>Recent movement</h2><span>Largest 7-day rank changes</span></div>
    <div className="structure-grid">
      <section className="notice">
        <h2>Largest gains</h2>
        {largestGains.length ? <ul className="compact-list">{largestGains.map((keyword) => <li key={keyword.linkId}><span>{keyword.term}</span><strong>{formatSigned(keyword.change7d)}</strong></li>)}</ul> : <p>No recent rank gains in the current scope.</p>}
      </section>
      <section className="notice">
        <h2>Largest losses</h2>
        {largestLosses.length ? <ul className="compact-list">{largestLosses.map((keyword) => <li key={keyword.linkId}><span>{keyword.term}</span><strong>{formatSigned(keyword.change7d)}</strong></li>)}</ul> : <p>No recent rank losses in the current scope.</p>}
      </section>
    </div>

    <div className="section-head"><h2>Competitive pressure</h2><span>{strongestCompetitor ? "Strongest rival signal" : "No competitor pressure detected"}</span></div>
    <section className="notice">
      <h2>{strongestCompetitor ? strongestCompetitor.competitorName : "No competitor comparison yet"}</h2>
      <p>{strongestCompetitor ? `${strongestCompetitor.shared} shared keyword${strongestCompetitor.shared === 1 ? "" : "s"} in scope. Strongest cluster signal: ${strongestCompetitor.strongest ?? "unknown"}.` : "Add competitors or run rank collection to populate shared keyword pressure."}</p>
    </section>

    <div className="section-head"><h2>Metadata opportunities</h2><span>Priority terms missing from title/subtitle</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Keyword</th><th>Market</th><th>Priority</th><th>Rank</th><th>Change</th><th>Ads status</th></tr></thead>
      <tbody>{metadataOpportunities.length ? metadataOpportunities.slice(0, 8).map((keyword) => <tr key={keyword.linkId}>
        <td>{keyword.term}</td><td>{keyword.country.toUpperCase()}</td><td>{keyword.priority}</td><td>{keyword.rank ?? "-"}</td><td>{formatSigned(keyword.change7d)}</td><td>{keyword.adsStatus}</td>
      </tr>) : <tr><td colSpan={6}>No metadata opportunities in the current scope.</td></tr>}</tbody>
    </table></div>

    <div className="section-head"><h2>Market readiness</h2><span>{scopedMarkets.length ? `${scopedMarkets.length} market${scopedMarkets.length === 1 ? "" : "s"}` : "No markets in scope"}</span></div>
    <section className="quality-list">
      {Object.entries(readinessCounts).length ? Object.entries(readinessCounts).map(([label, count]) => <article className="quality-card" key={label}><div><h2>{label}</h2><p>{count} market{count === 1 ? "" : "s"} currently match this readiness state.</p></div><span className="badge neutral">{count}</span></article>) : <article className="quality-card"><div><h2>No market readiness data</h2><p>Markets will appear once storefront, keyword, App Store Connect, or Apple Ads coverage exists.</p></div><span className="badge neutral">Waiting</span></article>}
    </section>

    <div className="section-head"><h2>Next views</h2><span>Drill into source tables</span></div>
    <nav className="workspace-tabs" aria-label="ASO overview drilldowns">
      <Link href={`/keywords${query}`}>Keywords</Link>
      <Link href={`/competitors${query}`}>Competitors</Link>
      <Link href={`/localizations${query}`}>Markets</Link>
    </nav>
  </PageShell>;
}
