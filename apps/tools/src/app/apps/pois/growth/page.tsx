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
const currentTime = () => Date.now();

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="metric-card"><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

export default async function PoisGrowthPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const params = await searchParams;
  const days: 7 | 28 = params.days === "28" ? 28 : 7;
  const country = /^[A-Za-z]{2}$/.test(params.country ?? "") ? params.country!.toUpperCase() : "AU";
  const channel = params.channel === "testflight" ? "testflight" : "appstore";
  const app = (await listApps()).find((item) => /^pois\b/i.test(item.name));
  if (!app) return <PageShell title="POIS Growth"><section className="notice">POIS is not configured in Kopa.</section></PageShell>;
  const [sourceResult, productResult] = await Promise.allSettled([
    getAsoProgressData(app.id), readPoisReport(days, channel, params.version),
  ]);
  const source = sourceResult.status === "fulfilled" ? sourceResult.value : null;
  const product = productResult.status === "fulfilled" ? productResult.value : null;
  const now = currentTime();
  const since = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  const through = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const store = source ? summarizePoisSources(source.metrics, source.sales, source.paidSearch, country, since, through) : null;
  const query = (patch: Partial<Params>) => {
    const next = new URLSearchParams({ days: String(days), country, channel, ...(product?.version ? { version: product.version } : {}) });
    for (const [key, value] of Object.entries(patch)) if (value) next.set(key, value); else next.delete(key);
    return `/apps/pois/growth?${next}`;
  };
  return <PageShell title="POIS Growth">
    <section className="notice"><h2>Launch signals</h2><p>Official acquisition, paid delivery and observed app activity. Each source keeps its own date basis and denominator; these counts are not one attributed funnel.</p>
      <form method="get" action="/apps/pois/growth"><label>Window <select name="days" defaultValue={days}><option value="7">7 days</option><option value="28">28 days</option></select></label>{" "}
        <label>Market <select name="country" defaultValue={country}>{["AU", "DE", "US", "GB", "CA", "FR"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{" "}
        <label>App events <select name="channel" defaultValue={channel}><option value="appstore">Production</option><option value="testflight">TestFlight</option></select></label>{" "}
        {product?.availableVersions.length ? <label>Version <select name="version" defaultValue={product.version ?? ""}>{product.availableVersions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}{" "}
        <button type="submit">Apply</button></form>
      <p>App events: {channel === "appstore" ? "production" : "TestFlight"}{product?.version ? ` · v${product.version}` : ""} · all storefronts · rolling {days}×24h UTC event window, {date(product?.latestReceivedAt ?? null)} latest receipt. Apple rows: {country} · {since}–{through} complete UTC report dates. <Link href={query({ days: days === 7 ? "28" : "7" })}>Switch to {days === 7 ? "28" : "7"} days</Link></p></section>
    <div className="section-head"><h2>App Store acquisition</h2><Link href="/app-store-connect">Source detail</Link></div>
    <section className="metric-grid">
      <Metric label="Impressions" value={number(store?.impressions)} note={`App Store Connect Analytics · latest ${date(store?.ascLatest ?? null)}`} />
      <Metric label="Product-page views" value={number(store?.pageViews)} note="ASC Product page only; missing reports are unavailable" />
      <Metric label="First-time downloads" value={number(store?.firstTimeDownloads)} note={`ASC App Downloads; observed report rows only, UTC · latest ${date(store?.firstTimeDownloadsLatest ?? null)}`} />
      <Metric label="Sales-report units" value={number(store?.salesUnits)} note={`Sales and Trends units, not first-time downloads · latest ${date(store?.salesLatest ?? null)}`} />
    </section>
    <div className="section-head"><h2>Apple Ads delivery</h2><Link href="/apple-ads-lab/reporting">Reporting</Link></div>
    <section className="metric-grid">
      <Metric label="Paid impressions" value={number(store?.adImpressions)} note={`POIS-mapped daily rows for ${country} · latest ${date(store?.adsLatest ?? null)}`} />
      <Metric label="Taps" value={number(store?.adTaps)} note="Apple Ads taps, not App Store page views" />
      <Metric label="Attributed installs" value={number(store?.adInstalls)} note="Apple Ads attribution; not App Store downloads" />
      <Metric label="Spend" value={store?.adSpend === null || store?.adSpend === undefined || !store.adCurrency ? "Unavailable" : `${store.adSpend.toFixed(2)} ${store.adCurrency}`} note="Source currency retained; no conversion to revenue" />
    </section>
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
    <section className="notice"><h2>Subscription truth and data health</h2><p>Trials, verified first charges, renewals, active paid subscribers, cancellations, refunds, proceeds and CAC are unavailable from connected reporting sources. At the 28 October audit, POIS RevenueCat webhook rows were sandbox-only and the production subscription-state table had no rows; this page does not recheck those tables live. Client purchase completions cannot establish revenue.</p><p>{product ? `${number(product.eventCount)} deduplicated events · ${number(product.activation.unmatchedSessionEnds)} unmatched session endings · selected version ${product.version ?? "unavailable"}.` : "Product event source unavailable; no substitute events shown."} {source ? `ASC latest ${date(store?.ascLatest ?? null)}; Sales latest ${date(store?.salesLatest ?? null)}; Ads latest ${date(store?.adsLatest ?? null)}.` : "App Store/Ads source unavailable; no substitute metrics shown."}</p></section>
  </PageShell>;
}
