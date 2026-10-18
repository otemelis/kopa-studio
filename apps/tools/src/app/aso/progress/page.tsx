import Link from "next/link";
import { AsoAcquisitionTrendChart, AsoSourceTrendChart } from "@/components/aso-source-trend-chart";
import { AsoKeywordRankExplorer } from "@/components/aso-keyword-rank-explorer";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";
import { canonicalRankSource, rankMovement, sourceCaveat, sourceLabel } from "@/lib/aso/progress";
import { getAsoProgressData } from "@/repositories/aso-progress-repository";
import { listApps } from "@/repositories/apps-repository";

export const dynamic = "force-dynamic";

type SearchParams = { app?: string; country?: string; window?: string };
const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const eventKey = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

function getAssessment(values: (number | null)[]) {
  const comparable = values.filter((value): value is number => value !== null);
  if (comparable.length < 3) return "Insufficient evidence";
  const gains = comparable.filter((value) => value > 0).length;
  const losses = comparable.filter((value) => value < 0).length;
  if (gains > losses) return "Improving";
  if (losses > gains) return "Declining";
  return gains === losses && gains > 0 ? "Mixed" : "No net movement";
}

function preserveQuery(filters: SearchParams, overrides: Partial<SearchParams> = {}) {
  const values = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (values.app) params.set("app", values.app);
  if (values.country) params.set("country", values.country);
  if (values.window) params.set("window", values.window);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function AsoProgressPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const filters = await searchParams;
  const apps = await listApps();
  const selectedApp = apps.find((app) => app.id === filters.app)
    ?? apps.find((app) => /innertype/i.test(app.name))
    ?? apps[0];
  if (!selectedApp) return <PageShell title="ASO Progress"><p className="notice">No apps are configured for ASO tracking.</p></PageShell>;
  const country = filters.country === "all" ? undefined : (filters.country?.toLowerCase() || selectedApp.primaryCountry);
  const days: 1 | 7 | 28 = filters.window === "1" ? 1 : filters.window === "28" ? 28 : 7;
  const data = await getAsoProgressData(selectedApp.id);
  const activeKeywords = data.keywords.filter((keyword) => !country || keyword.country === country);
  const activeKeywordIds = new Set(activeKeywords.map((keyword) => keyword.id));
  const scopedSnapshots = data.snapshots.filter((row) => activeKeywordIds.has(row.keyword_id));
  const scopedChanges = data.changes.filter((row) => !country || row.country === country);
  const scopedMetrics = data.metrics.filter((row) => !country || row.country === country);
  const scopedSales = data.sales.filter((row) => !country || row.country === country);
  const scopedPaidSearch = data.paidSearch.filter((row) => !country || row.country?.toLowerCase() === country);
  const sourceNames = [...new Set(scopedSnapshots.map((row) => canonicalRankSource(row.source)))].sort();
  const sourceRanks = new Map<string, Map<string, typeof data.snapshots>>();
  for (const source of sourceNames) {
    const byKeyword = new Map<string, typeof data.snapshots>();
    for (const row of scopedSnapshots.filter((item) => canonicalRankSource(item.source) === source)) {
      const rows = byKeyword.get(row.keyword_id) ?? [];
      rows.push(row);
      byKeyword.set(row.keyword_id, rows);
    }
    sourceRanks.set(source, byKeyword);
  }
  const sourceMovements = new Map<string, Map<string, ReturnType<typeof rankMovement>>>();
  const sourcePoints = new Map<string, { date: string; averageRank: number | null; observed: number }[]>();
  for (const source of sourceNames) {
    const byKeyword = sourceRanks.get(source)!;
    const movementByKeyword = new Map<string, ReturnType<typeof rankMovement>>();
    for (const keyword of activeKeywords) movementByKeyword.set(keyword.id, rankMovement(byKeyword.get(keyword.id) ?? [], days));
    sourceMovements.set(source, movementByKeyword);
    const dates = [...new Set(scopedSnapshots.filter((row) => canonicalRankSource(row.source) === source).map((row) => row.captured_on))].sort();
    sourcePoints.set(source, dates.map((date) => {
      const rows = scopedSnapshots.filter((row) => canonicalRankSource(row.source) === source && row.captured_on === date && row.collection_status !== "failed" && row.found && row.rank !== null);
      return { date, averageRank: rows.length ? rows.reduce((sum, row) => sum + (row.rank ?? 0), 0) / rows.length : null, observed: rows.length };
    }));
  }
  const assessments = sourceNames.map((source) => ({
    source,
    assessment: getAssessment([...(sourceMovements.get(source)?.values() ?? [])].map((movement) => movement.state === "comparable" ? movement.positions : null)),
    compared: [...(sourceMovements.get(source)?.values() ?? [])].filter((movement) => movement.state === "comparable").length,
  }));
  const latestSnapshotAt = scopedSnapshots.reduce<string | null>((latest, row) => !latest || row.captured_at > latest ? row.captured_at : latest, null);
  const latestMetricAt = scopedMetrics.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const latestRankLabel = latestSnapshotAt ? new Date(latestSnapshotAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC" : "No ranking observations yet";
  const marketOptions = [...new Set(data.keywords.map((row) => row.country))].sort();
  const windows: (1 | 7 | 28)[] = [1, 7, 28];
  const latestMetricDate = scopedMetrics.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const metricCutoff = latestMetricDate ? new Date(Date.parse(`${latestMetricDate}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10) : "9999-12-31";
  const acquisition = scopedMetrics.filter((row) => row.date >= metricCutoff);
  const sumEvents = (aliases: string[], source?: string) => acquisition.filter((row) => aliases.includes(eventKey(row.event)) && (!source || row.source_type?.toLowerCase().includes(source))).reduce((sum, row) => sum + (row.count ?? 0), 0);
  const impressions = sumEvents(["impression", "impressions"]);
  const pageViews = sumEvents(["pageview", "productpageview"]);
  const hasSearchDownloads = acquisition.some((row) => ["appdownload", "download", "firsttimedownload"].includes(eventKey(row.event)) && row.source_type?.toLowerCase().includes("search"));
  const searchDownloads = sumEvents(["appdownload", "download", "firsttimedownload"], "search");
  const salesUnits = scopedSales.filter((row) => row.date >= metricCutoff).reduce((sum, row) => sum + (row.downloads ?? 0), 0);
  const salesInWindow = scopedSales.filter((row) => row.date >= metricCutoff);
  const paidRows = scopedPaidSearch;
  const paidSpend = paidRows.reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
  const paidCurrency = [...new Set(paidRows.map((row) => row.currency).filter(Boolean))];
  const acquisitionByDate = new Map<string, { impressions: number | null; pageViews: number | null; searchDownloads: number | null }>();
  for (const row of acquisition) {
    const isSearch = row.source_type?.toLowerCase().includes("search") ?? false;
    const current = acquisitionByDate.get(row.date) ?? { impressions: null, pageViews: null, searchDownloads: null };
    const event = eventKey(row.event);
    if (["impression", "impressions"].includes(event) && isSearch) current.impressions = (current.impressions ?? 0) + (row.count ?? 0);
    if (["pageview", "productpageview"].includes(event) && isSearch) current.pageViews = (current.pageViews ?? 0) + (row.count ?? 0);
    if (["appdownload", "download", "firsttimedownload"].includes(event) && isSearch) current.searchDownloads = (current.searchDownloads ?? 0) + (row.count ?? 0);
    acquisitionByDate.set(row.date, current);
  }
  const acquisitionTrend = [...acquisitionByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values }));
  const acquisitionSources = [...new Set(acquisition.map((row) => row.source_type ?? "Unknown"))].sort().map((source) => ({
    source,
    impressions: acquisition.filter((row) => (row.source_type ?? "Unknown") === source && ["impression", "impressions"].includes(eventKey(row.event))).reduce((sum, row) => sum + (row.count ?? 0), 0),
    pageViews: acquisition.filter((row) => (row.source_type ?? "Unknown") === source && ["pageview", "productpageview"].includes(eventKey(row.event))).reduce((sum, row) => sum + (row.count ?? 0), 0),
  }));
  const latestRankDate = latestSnapshotAt?.slice(0, 10);
  const reportWindow = latestRankDate
    ? new Date(Date.parse(`${latestRankDate}T00:00:00Z`) - 27 * 86_400_000).toISOString().slice(0, 10)
    : "9999-12-31";
  const rankedCount = scopedSnapshots.filter((row) => row.captured_on >= reportWindow && row.found && row.rank !== null && row.collection_status !== "failed").length;
  const passedCount = scopedSnapshots.filter((row) => row.captured_on >= reportWindow && row.collection_status === "failed").length;

  return <PageShell title="ASO Progress">
    <section className="metric-grid">
      <article className="metric-card"><p>Visibility assessment</p><strong>Source-specific</strong><small>{assessments.map((item) => `${sourceLabel(item.source)}: ${item.assessment} (${item.compared})`).join(" · ") || "Waiting for comparable history"}</small></article>
      <article className="metric-card"><p>Active keywords</p><strong>{number(activeKeywords.length)}</strong><small>{country ? country.toUpperCase() : "All configured storefronts"}</small></article>
      <article className="metric-card"><p>Observed ranks · last 28 days</p><strong>{number(rankedCount)}</strong><small>{number(passedCount)} failed observations kept unavailable</small></article>
      <article className="metric-card"><p>Latest ranking collection</p><strong>{latestSnapshotAt ? "Recorded" : "Waiting"}</strong><small>{latestRankLabel}</small></article>
    </section>

    <div className="section-head"><h2>Filters & comparison</h2><span>Rank sources remain separate</span></div>
    <div className="workspace-tabs" aria-label="ASO progress filters">
      {apps.map((app) => <Link key={app.id} className={app.id === selectedApp.id ? "active-child" : undefined} href={`/aso/progress${preserveQuery(filters, { app: app.id })}`}>{app.name}</Link>)}
      <Link className={!country ? "active-child" : undefined} href={`/aso/progress${preserveQuery(filters, { app: selectedApp.id, country: "all" })}`}>All markets</Link>
      {marketOptions.map((market) => <Link key={market} className={country === market ? "active-child" : undefined} href={`/aso/progress${preserveQuery(filters, { app: selectedApp.id, country: country === market ? "" : market })}`}>{market.toUpperCase()}</Link>)}
      {windows.map((window) => <Link key={window} className={days === window ? "active-child" : undefined} href={`/aso/progress${preserveQuery(filters, { app: selectedApp.id, window: String(window) })}`}>{window}d</Link>)}
    </div>

    <div className="section-head"><h2>Ranking history</h2><span>Mean observed position by source; lower position number is better</span></div>
    <div className="structure-grid">
      {sourceNames.map((source) => <AsoSourceTrendChart key={source} source={sourceLabel(source)} caveat={sourceCaveat(source)} points={sourcePoints.get(source) ?? []} />)}
    </div>
    {!sourceNames.length ? <p className="notice">No ranking observations are available for this app and market yet.</p> : null}

    <div className="section-head"><h2>Keyword rankings</h2><span>Current rank, period change, best rank and selectable history</span></div>
    <AsoKeywordRankExplorer
      days={days}
      keywords={activeKeywords.map(({ id, term, country }) => ({ id, term, country }))}
      snapshots={scopedSnapshots.map(({ keyword_id, captured_at, captured_on, rank, found, result_depth, collection_status, source }) => ({ keyword_id, captured_at, captured_on, rank, found, result_depth, collection_status, source }))}
    />

    <div className="section-head"><h2>Acquisition evidence</h2><span>{latestMetricAt ? `Latest source date ${latestMetricAt}` : "No ASC acquisition rows available"}</span></div>
    <AsoAcquisitionTrendChart points={acquisitionTrend} />
    <section className="metric-grid">
      <article className="metric-card"><p>App Store impressions</p><strong>{acquisition.length ? number(impressions) : "Unavailable"}</strong><small>ASC storefront analytics · last {days} complete available data dates</small></article>
      <article className="metric-card"><p>Product-page views</p><strong>{acquisition.length ? number(pageViews) : "Unavailable"}</strong><small>ASC product-page view events · last {days} available dates</small></article>
      <article className="metric-card"><p>First-time downloads</p><strong>Unavailable</strong><small>Not provided by the current daily Discovery dataset; sales units are separate</small></article>
      <article className="metric-card"><p>App Store Search downloads</p><strong>{hasSearchDownloads ? number(searchDownloads) : "Unavailable"}</strong><small>Only where ASC reports a download event with App Store Search source</small></article>
      <article className="metric-card"><p>Sales report units</p><strong>{salesInWindow.length ? number(salesUnits) : "Unavailable"}</strong><small>Official Sales and Trends units; not first-time downloads · last {days} available dates</small></article>
    </section>
    <div className="table-wrap"><table><thead><tr><th>ASC source</th><th>Impressions</th><th>Product-page views</th></tr></thead><tbody>{acquisitionSources.length ? acquisitionSources.map((row) => <tr key={row.source}><td>{row.source}</td><td>{number(row.impressions)}</td><td>{number(row.pageViews)}</td></tr>) : <tr><td colSpan={3}>Unavailable for the selected market and reporting window.</td></tr>}</tbody></table></div>
    <section className="notice"><h2>Paid search context</h2><p>{paidRows.length ? `${number(paidRows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0))} Apple Ads impressions · ${number(paidRows.reduce((sum, row) => sum + Number(row.taps ?? 0), 0))} taps · ${number(paidRows.reduce((sum, row) => sum + Number(row.installs ?? 0), 0))} reported installs · ${paidCurrency.length === 1 ? paidCurrency[0] : "mixed currency"} ${paidSpend.toFixed(2)} spend. Paid-search activity is shown separately and is not joined to organic ranking positions.` : "No Apple Ads daily metrics are available for this app and market scope. Paid-search activity is not inferred from organic rankings."}</p></section>

    <div className="section-head"><h2>Metadata changes</h2><span>Recorded events in the most recent 36 days</span></div>
    <section className="quality-list">{scopedChanges.length ? scopedChanges.map((change, index) => <article className="quality-card" key={`${change.happened_at}:${index}`}><div><h2>{change.field ?? change.change_type ?? "Metadata change"}</h2><p>{change.country?.toUpperCase() ?? "All markets"} · {change.old_value ?? "(empty)"} → {change.new_value ?? "(empty)"}</p></div><span>{new Date(change.happened_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</span></article>) : <article className="quality-card"><div><h2>No metadata change events recorded</h2><p>Detected changes appear here when the collector records them; missing history is not interpreted as no changes.</p></div></article>}</section>
    <div className="section-head"><h2>Collection status</h2><span>{data.latestRun?.finished_at ? `Latest collector run ${new Date(data.latestRun.finished_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC` : "No completed collector run"}</span></div>
    <section className="notice"><p>{data.latestRun ? `${data.latestRun.status.toUpperCase()} · ${data.latestRun.summary?.scope ?? "full"} scope · ${data.latestRun.succeeded}/${data.latestRun.processed} items succeeded · ${number(data.latestRun.failed)} failed · ${number(data.latestRun.warnings)} warnings.` : "Waiting for the first completed sync."} {latestMetricAt ? ` ASC data currently reaches ${latestMetricAt}; reporting may lag.` : " ASC reporting is unavailable in the current query window."}</p></section>
  </PageShell>;
}
