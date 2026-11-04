import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";
import { readPoisReport } from "@/lib/pois-live/source";
import { summarizePoisSources } from "@/lib/pois-growth/summary";
import { listApps } from "@/repositories/apps-repository";
import { getAsoProgressData } from "@/repositories/aso-progress-repository";

export const dynamic = "force-dynamic";
type Params = { days?: string; country?: string; channel?: string; version?: string };
const number = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : new Intl.NumberFormat("en-US").format(value);
const date = (value: string | null) => value ? value.slice(0, 10) : "No report";
const timestamp = (value: string | null) => value ? value.replace("T", " ").slice(0, 16) + " UTC" : "No receipt";
const currentTime = () => Date.now();
const age = (value: string | null, now: number) => value ? `${Math.max(0, Math.floor((now - Date.parse(value.length === 10 ? `${value}T23:59:59Z` : value)) / 86_400_000))}d old` : "unavailable";

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="metric-card"><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

export default async function PoisSignalsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const params = await searchParams;
  const days: 7 | 28 = params.days === "28" ? 28 : 7;
  const country = /^[A-Za-z]{2}$/.test(params.country ?? "") ? params.country!.toUpperCase() : "US";
  const channel = params.channel === "testflight" ? "testflight" : "appstore";
  const app = (await listApps()).find((item) => /^pois\b/i.test(item.name));
  if (!app) return <PageShell title="POIS signals"><section className="notice">POIS is not configured in Kopa.</section></PageShell>;
  const [sourceResult, productResult] = await Promise.allSettled([
    getAsoProgressData(app.id), readPoisReport(days, channel, params.version),
  ]);
  const source = sourceResult.status === "fulfilled" ? sourceResult.value : null;
  const product = productResult.status === "fulfilled" ? productResult.value : null;
  const now = currentTime();
  const rankSince = new Date(now - days * 86_400_000).toISOString();
  const since = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  const through = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const store = source ? summarizePoisSources(source.metrics, source.sales, source.paidSearch, country, since, through) : null;
  const marketKeywords = source?.keywords.filter((item) => item.country.toUpperCase() === country) ?? [];
  const keywordIds = new Set(marketKeywords.map((item) => item.id));
  const ranking = source?.snapshots.filter((item) => keywordIds.has(item.keyword_id) && item.captured_at >= rankSince) ?? [];
  const rankingSources = [...new Set(ranking.map((item) => item.source))].sort().map((name) => {
    const rows = ranking.filter((item) => item.source === name);
    const latest = rows.reduce<string | null>((value, item) => !value || item.captured_at > value ? item.captured_at : value, null);
    return { name, count: rows.length, ranked: rows.filter((item) => item.collection_status !== "failed" && item.found && item.rank !== null).length, latest };
  });
  const latestRank = rankingSources.reduce<string | null>((value, item) => !value || (item.latest && item.latest > value) ? item.latest : value, null);
  const activeByDay = new Map(product?.daily.map((row) => [row.date, row.installations]) ?? []);
  const dailyRows = Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.parse(`${through}T00:00:00Z`) - index * 86_400_000).toISOString().slice(0, 10);
    return { day, values: source ? summarizePoisSources(source.metrics, source.sales, source.paidSearch, country, day, day) : null, active: activeByDay.get(day) };
  });
  const query = (patch: Partial<Params>) => {
    const next = new URLSearchParams({ days: String(days), country, channel, ...(params.version && product?.version ? { version: product.version } : {}) });
    for (const [key, value] of Object.entries(patch)) if (value) next.set(key, value); else next.delete(key);
    return `/pois-signals?${next}`;
  };
  return <PageShell title="POIS signals">
    <section className="notice"><h2>Growth and product signals</h2><p>Official acquisition, paid delivery, search visibility and observed app activity in one view. Each source keeps its own date basis and denominator; these counts are not one attributed funnel.</p>
      <form method="get" action="/pois-signals"><label>Window <select name="days" defaultValue={days}><option value="7">7 days</option><option value="28">28 days</option></select></label>{" "}
        <label>Market <select name="country" defaultValue={country}>{["AU", "DE", "US", "GB", "CA", "FR"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{" "}
        <label>App events <select name="channel" defaultValue={channel}><option value="appstore">Production</option><option value="testflight">TestFlight</option></select></label>{" "}
        {product?.availableVersions.length ? <label>Version <select name="version" defaultValue={product.version ?? ""}><option value="">All versions</option>{product.availableVersions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}{" "}
        <button type="submit">Apply</button></form>
      <p>App events: {channel === "appstore" ? "production" : "TestFlight"}{product?.version ? ` · v${product.version}` : " · all versions"} · all storefronts · rolling {days}×24h UTC event window. Apple rows: {country} · {since}–{through} complete UTC report dates. <Link href={query({ days: days === 7 ? "28" : "7" })}>Switch to {days === 7 ? "28" : "7"} days</Link></p></section>
    <div className="section-head"><h2>Source freshness</h2><Link href="/collection">Collection jobs</Link></div>
    <section className="metric-grid">
      <Metric label="App events · last receipt" value={product ? timestamp(product.latestReceivedAt) : "Unavailable"} note={product ? `${age(product.latestReceivedAt, now)} · ${channel === "appstore" ? "production" : "TestFlight"} · all storefronts; activity, not collector heartbeat` : "Private event query failed"} />
      <Metric label="App Store Analytics · latest observed day" value={store?.ascLatest ?? "Unavailable"} note={`${age(store?.ascLatest ?? null, now)} · ${country}; Apple reports can lag and omit low-volume rows`} />
      <Metric label="Sales and Trends · report day" value={store?.salesLatest ?? "Unavailable"} note={`${age(store?.salesLatest ?? null, now)} · ${country}; date with an observed Sales row`} />
      <Metric label="Apple Ads · report day" value={store?.adsLatest ?? "Unavailable"} note={store?.adsLatest ? `${age(store.adsLatest, now)} · ${country}` : "No POIS-mapped daily rows for this market; campaign delivery is unknown"} />
      <Metric label="Rankings · observed" value={latestRank ? date(latestRank) : "Unavailable"} note={latestRank ? `${age(latestRank, now)} · ${country} · source-specific observations` : "No ranking snapshot for this market and window"} />
    </section>
    <div className="section-head"><h2>App Store acquisition</h2><Link href="/app-store-connect">Source detail</Link></div>
    <section className="metric-grid">
      <Metric label="Impressions" value={number(store?.impressions)} note={`App Store Connect Analytics · latest ${date(store?.ascLatest ?? null)}`} />
      <Metric label="Product-page views" value={number(store?.pageViews)} note="ASC Product page only; missing reports are unavailable" />
      <Metric label="First-time downloads" value={number(store?.firstTimeDownloads)} note={`ASC App Downloads; observed report rows only, UTC · latest ${date(store?.firstTimeDownloadsLatest ?? null)}`} />
      <Metric label="Sales-report units" value={number(store?.salesUnits)} note={`Sales and Trends units, not first-time downloads · latest ${date(store?.salesLatest ?? null)}`} />
    </section>
    <div className="section-head"><h2>Search visibility</h2><Link href={`/aso/progress?app=${app.id}&country=${country.toLowerCase()}&window=${days}`}>Keyword detail</Link></div>
    <section className="metric-grid">{rankingSources.length ? rankingSources.map((item) => <Metric key={item.name} label={item.name === "itunes_catalog" ? "iTunes catalog order" : item.name === "apple_web" ? "Apple web results" : item.name} value={`${number(item.ranked)} ranked observations`} note={`${number(item.count)} snapshots · latest ${date(item.latest)} · not native iPhone ranks`} />) : <Metric label="Ranking coverage" value="Unavailable" note={source ? "No observations for this market and window" : "Ranking source query failed"} />}</section>
    <div className="section-head"><h2>Apple Ads delivery</h2><Link href="/apple-ads-lab/reporting">Reporting</Link></div>
    <section className="metric-grid">
      <Metric label="Paid impressions" value={number(store?.adImpressions)} note={`POIS-mapped daily rows for ${country} · latest ${date(store?.adsLatest ?? null)}`} />
      <Metric label="Taps" value={number(store?.adTaps)} note="Apple Ads taps, not App Store page views" />
      <Metric label="Attributed installs" value={number(store?.adInstalls)} note="Apple Ads attribution; not App Store downloads" />
      <Metric label="Spend" value={store?.adSpend === null || store?.adSpend === undefined || !store.adCurrency ? "Unavailable" : `${store.adSpend.toFixed(2)} ${store.adCurrency}`} note="Source currency retained; no conversion to revenue" />
    </section>
    <div className="section-head"><h2>Daily source trend</h2><span>{country} store reports and ads · {channel === "appstore" ? "production" : "TestFlight"} app events across all storefronts</span></div>
    <div className="table-wrap"><table><thead><tr><th>UTC day</th><th>ASC impressions</th><th>Product-page views</th><th>First-time downloads</th><th>Apple Ads taps</th><th>Active installations</th></tr></thead><tbody>{dailyRows.map((row) => <tr key={row.day}><td>{row.day}</td><td>{number(row.values?.impressions)}</td><td>{number(row.values?.pageViews)}</td><td>{number(row.values?.firstTimeDownloads)}</td><td>{number(row.values?.adTaps)}</td><td>{number(row.active)}</td></tr>)}</tbody></table></div>
    <div className="section-head"><h2>Product activation</h2><Link href="/analytics?app=pois">Event detail</Link></div>
    <section className="metric-grid">
      <Metric label="Observed active installations" value={number(product?.installationCount)} note="Distinct installation IDs in selected channel and version" />
      <Metric label="First observed opens" value={number(product?.activation.firstOpens)} note="app_opened with first_launch=true; not downloads" />
      <Metric label="Onboarding started" value={number(product?.activation.onboardingStarters)} note="Distinct installations with onboarding_started" />
      <Metric label="Onboarding completed" value={number(product?.activation.onboardingCompleters)} note="Explicit onboarding_completed event; demo completion is separate" />
      <Metric label="No-headphones exploration" value={number(product?.activation.noHeadphonesExplorers)} note="exploration_entered with entry_reason=missing; not sensing activation" />
      <Metric label="Demo completed" value={number(product?.activation.demoCompleters)} note="Distinct installations; preview only, not a real session or proof" />
      <Metric label="Confirmed sensing" value={number(product?.activation.confirmedSensing)} note="Distinct installations with sensing state" />
      <Metric label="Proof heard" value={number(product?.activation.proofHeard)} note="Actual cue played; not proof started" />
      <Metric label="Real session starters" value={number(product?.activation.realSessionStarters)} note="session_started with session ID" />
      <Metric label="Meaningful sessions" value={number(product?.activation.meaningfulSessions)} note="Distinct installations; matched end with ≥10 tracked minutes" />
      <Metric label="Real paywall viewers" value={number(product?.activation.realPaywallViewers)} note="paywall_viewed with preview=false" />
      <Metric label="Client purchase completions" value={number(product?.purchaseCompletions)} note="Client signal only; not verified paid transactions" />
    </section>
    <section className="notice"><h2>Measurement limits</h2><p>Trials, verified first charges, renewals, active paid subscribers, cancellations, refunds, proceeds and CAC are unavailable from these connected POIS reporting sources. Client purchase completions cannot establish revenue. Apple Ads attributed installs, App Store downloads and app first opens are different measures; no cross-source user join is implied.</p><p>{product ? `${number(product.eventCount)} deduplicated events · ${number(product.activation.unmatchedSessionEnds)} unmatched session endings · ${product.version ? `version ${product.version}` : "all observed versions"}.` : "Product event source unavailable; no substitute events shown."} {source ? `ASC latest ${date(store?.ascLatest ?? null)}; Sales latest ${date(store?.salesLatest ?? null)}; Ads latest ${date(store?.adsLatest ?? null)}.` : "App Store/Ads source unavailable; no substitute metrics shown."}</p></section>
  </PageShell>;
}
