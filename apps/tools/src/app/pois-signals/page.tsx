import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";
import { readPoisReport } from "@/lib/pois-live/source";
import { summarizePoisSources } from "@/lib/pois-growth/summary";
import { readPoisWeb } from "@/lib/pois-signals/web";
import { listApps } from "@/repositories/apps-repository";
import { getAsoProgressData } from "@/repositories/aso-progress-repository";
import styles from "../lovetype-signals/signals.module.css";
import poisStyles from "./pois.module.css";

export const dynamic = "force-dynamic";
type Params = { days?: string; country?: string; channel?: string; version?: string };
const fmt = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : new Intl.NumberFormat("en-US").format(value);
const day = (value: string | null | undefined) => value ? value.slice(0, 10) : "Unavailable";
const time = (value: string | null | undefined) => value ? `${new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : "No observation";

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
function Bars({ title, points, color, note }: { title: string; points: { date: string; value: number }[]; color: string; note: string }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return <div className={styles.chart}><div className={styles.sectionTitle}><h3>{title}</h3><span>{note}</span></div>
    {points.length ? <div className={styles.bars}>{points.map((point) => <div className={styles.barColumn} key={point.date} title={`${point.date}: ${point.value}`}>
      <b>{point.value}</b><div className={styles.barTrack}><i style={{ height: point.value ? `${Math.max(8, point.value / max * 100)}%` : "0%", background: color }} /></div><time dateTime={point.date}>{point.date.slice(5)}</time>
    </div>)}</div> : <p className={styles.empty}>No observed daily values in this period. Missing days are not zero.</p>}</div>;
}
function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className={styles.breakdown}><div className={styles.sectionTitle}><h3>{title}</h3><span>Page views</span></div>
    {rows.length ? rows.map((row) => <div className={styles.breakRow} key={row.label}><span title={row.label}>{row.label}</span><i><b style={{ width: `${row.value / max * 100}%` }} /></i><strong>{row.value}</strong></div>)
      : <p className={styles.empty}>No breakdown reported.</p>}</div>;
}

export default async function PoisSignalsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const params = await searchParams;
  const days: 7 | 28 = params.days === "28" ? 28 : 7;
  const country = /^[A-Za-z]{2}$/.test(params.country ?? "") ? params.country!.toUpperCase() : "US";
  const channel = params.channel === "testflight" ? "testflight" : "appstore";
  const app = (await listApps()).find((item) => /^pois\b/i.test(item.name));
  if (!app) return <PageShell title="POIS signals"><section className={styles.empty}>POIS is not configured in Kopa.</section></PageShell>;
  const [sourceResult, productResult, webResult] = await Promise.allSettled([
    getAsoProgressData(app.id), readPoisReport(days, channel, params.version), readPoisWeb(days),
  ]);
  const source = sourceResult.status === "fulfilled" ? sourceResult.value : null;
  const product = productResult.status === "fulfilled" ? productResult.value : null;
  const web = webResult.status === "fulfilled" ? webResult.value : { available: false as const, reason: "POIS website analytics could not be read." };
  const now = Date.now();
  const rankSince = new Date(now - days * 86_400_000).toISOString();
  const since = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  const through = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const store = source ? summarizePoisSources(source.metrics, source.sales, source.paidSearch, country, since, through) : null;
  const marketKeywords = source?.keywords.filter((item) => item.country.toUpperCase() === country) ?? [];
  const ids = new Set(marketKeywords.map((item) => item.id));
  const ranking = source?.snapshots.filter((item) => ids.has(item.keyword_id) && item.captured_at >= rankSince) ?? [];
  const rankingSources = [...new Set(ranking.map((item) => item.source))].sort().map((name) => {
    const rows = ranking.filter((item) => item.source === name);
    return { name, observed: rows.length, ranked: rows.filter((item) => item.collection_status !== "failed" && item.found && item.rank !== null).length,
      latest: rows.reduce<string | null>((value, item) => !value || item.captured_at > value ? item.captured_at : value, null) };
  });
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.parse(`${through}T00:00:00Z`) - (days - index - 1) * 86_400_000).toISOString().slice(0, 10);
    return { date, store: source ? summarizePoisSources(source.metrics, source.sales, source.paidSearch, country, date, date) : null };
  });
  const query = (patch: Partial<Params>) => {
    const next = new URLSearchParams({ days: String(days), country, channel, ...(params.version && product?.version ? { version: product.version } : {}) });
    for (const [key, value] of Object.entries(patch)) if (value) next.set(key, value); else next.delete(key);
    return `/pois-signals?${next}`;
  };
  const appAvailable = product !== null && product.eventCount > 0;
  const journey = product?.journey.slice(0, 4) ?? [];
  const journeyBase = journey[0]?.installations ?? 0;

  return <PageShell title="POIS signals"><div className={styles.page}>
    <div className={styles.hero}><div><p className={styles.kicker}>POIS · growth and product activity</p><h2>From discovery to first useful session</h2>
      <p>See website interest, App Store acquisition, paid delivery and observed app behavior together. Each source remains separate; this is not a cross-platform customer funnel.</p></div>
      <div className={styles.period} aria-label="Reporting window"><Link className={days === 7 ? styles.selected : ""} href={query({ days: "7" })}>7 days</Link><Link className={days === 28 ? styles.selected : ""} href={query({ days: "28" })}>28 days</Link></div></div>
    <div className={styles.sourceStrip}><div><span className={styles.sourceDot} data-available={web.available} /><b>Website</b><span>{web.available ? `Queried ${time(web.queriedAt)}` : "Unavailable"}</span></div>
      <div><span className={styles.sourceDot} data-available={appAvailable} /><b>App events</b><span>{product ? `Last received ${time(product.latestReceivedAt)}` : "Unavailable"}</span></div>
      <div><span className={styles.sourceDot} data-available={Boolean(store?.ascLatest)} /><b>App Store</b><span>{store?.ascLatest ? `Observed through ${store.ascLatest}` : "Unavailable"}</span></div>
      <div><span className={styles.sourceDot} data-available={Boolean(store?.adsLatest)} /><b>Apple Ads</b><span>{store?.adsLatest ? `Reported through ${store.adsLatest}` : "Unavailable"}</span></div></div>
    <div className={styles.sourceStrip}><form method="get" action="/pois-signals"><label>Window <select name="days" defaultValue={days}><option value="7">7 days</option><option value="28">28 days</option></select></label>{" "}
        <label>Market <select name="country" defaultValue={country}>{["AU", "DE", "US", "GB", "CA", "FR"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{" "}
        <label>App events <select name="channel" defaultValue={channel}><option value="appstore">Production</option><option value="testflight">TestFlight</option></select></label>{" "}
        {product?.availableVersions.length ? <label>Version <select name="version" defaultValue={product.version ?? ""}><option value="">All versions</option>{product.availableVersions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}{" "}<button type="submit">Apply</button></form>
      <span>{country} store reports · {channel === "appstore" ? "production" : "TestFlight"} app events across all storefronts</span></div>

    <div className={styles.columns}><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>01 / Website</p><h3>Interest before the App Store</h3></div><span>withpois · Vercel Web Analytics</span></div>
      {web.available ? <><div className={styles.metrics}><Metric label="Visitors" value={fmt(web.visitors)} detail="Vercel deduplicated visitors in this period" />
        <Metric label="Page views" value={fmt(web.pageviews)} detail="Production website page views" />
        <Metric label="Website → installs" value="Unavailable" detail="No verified visitor-to-install link" /></div>
        <Bars title="Daily page views" points={web.daily.map((row) => ({ date: row.label, value: row.pageviews }))} color="var(--web)" note="UTC reporting day" />
        <div className={styles.twoBreakdowns}><Breakdown title="Pages" rows={web.paths.map((row) => ({ label: row.label, value: row.pageviews }))} />
          <Breakdown title="Referrer hosts" rows={web.referrers.map((row) => ({ label: row.label, value: row.pageviews }))} /></div>
      </> : <p className={styles.empty}>{web.reason} No zero or sample website metrics are shown.</p>}</section>

      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>02 / App journey</p><h3>Where observed installations progress</h3></div><span><Link href="/analytics?app=pois">Event detail</Link></span></div>
        {product ? <><div className={styles.metrics}><Metric label="Active installations" value={fmt(product.installationCount)} detail="Distinct IDs, selected channel and version" />
          <Metric label="Onboarding complete" value={fmt(product.activation.onboardingCompleters)} detail="Distinct installations with completion event" />
          <Metric label="Real session starters" value={fmt(product.activation.realSessionStarters)} detail="Distinct installations with session ID" /></div>
          {journeyBase ? <div className={styles.journey}><div className={styles.sectionTitle}><h3>Observed ordered path</h3><span>Same installation, events in sequence</span></div>
            {journey.map((step) => <div className={poisStyles.flowRow} key={step.name}><span>{step.label}</span><div className={poisStyles.flowTrack}><i style={{ width: `${step.installations / journeyBase * 100}%` }} /></div><strong>{step.installations} / {journeyBase}</strong></div>)}</div>
            : <p className={styles.empty}>No complete entry event observed for an ordered path in this window.</p>}
          <p className={poisStyles.flowNote}>An installation that entered before this window may be absent from this path. The bars show observed sequence completion, not a population-wide conversion rate.</p>
          <div className={styles.journey}><div className={styles.sectionTitle}><h3>Other paths and outcomes</h3><span>Distinct installations · not additive</span></div>
            {[["No-headphones exploration", product.activation.noHeadphonesExplorers], ["Demo completed", product.activation.demoCompleters], ["Confirmed sensing", product.activation.confirmedSensing], ["Proof heard", product.activation.proofHeard], ["Meaningful session", product.activation.meaningfulSessions], ["Real paywall viewed", product.activation.realPaywallViewers], ["Client purchase completed", product.purchaseCompletions]].map(([label, value]) => <div className={styles.testRow} key={label}><span>{label}</span><strong>{fmt(Number(value))}</strong></div>)}</div>
          <Bars title="Daily active installations" points={product.daily.map((row) => ({ date: row.date, value: row.installations }))} color="var(--app)" note="UTC event day · all storefronts" />
        </> : <p className={styles.empty}>Read-only POIS event source could not be queried. No substitute event counts are shown.</p>}</section></div>

    <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>03 / App Store acquisition</p><h3>Visibility and downloads</h3></div><span>{country} storefront · <Link href="/app-store-connect">Source detail</Link></span></div>
      <div className={styles.metrics}><Metric label="Impressions" value={fmt(store?.impressions)} detail={`App Store Connect Analytics · latest observed ${day(store?.ascLatest)}`} />
        <Metric label="Product-page views" value={fmt(store?.pageViews)} detail="ASC Product page only; not website page views" />
        <Metric label="First-time downloads" value={fmt(store?.firstTimeDownloads)} detail={`ASC App Downloads · latest ${day(store?.firstTimeDownloadsLatest)}`} /></div>
      <div className={poisStyles.chartPair}><Bars title="App Store impressions" points={daily.filter((row) => row.store?.impressions !== null && row.store?.impressions !== undefined).map((row) => ({ date: row.date, value: row.store!.impressions! }))} color="var(--web)" note="Reported UTC days only" />
        <Bars title="First-time downloads" points={daily.filter((row) => row.store?.firstTimeDownloads !== null && row.store?.firstTimeDownloads !== undefined).map((row) => ({ date: row.date, value: row.store!.firstTimeDownloads! }))} color="var(--app)" note="Reported UTC days only" /></div>
      <p className={poisStyles.sourceMeta}>Sales and Trends units: {fmt(store?.salesUnits)} · latest observed {day(store?.salesLatest)}. These units are not first-time downloads. Apple Analytics can lag or omit low-volume rows; gaps are unavailable, not zero.</p></section>

    <div className={styles.columns}><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>04 / Paid search</p><h3>Apple Ads delivery</h3></div><span><Link href="/apple-ads-lab/reporting">Reporting status</Link></span></div>
      <div className={styles.metrics}><Metric label="Impressions" value={fmt(store?.adImpressions)} detail={`POIS-mapped daily rows · ${country}`} />
        <Metric label="Taps" value={fmt(store?.adTaps)} detail="Apple Ads taps, not product-page views" />
        <Metric label="Attributed installs" value={fmt(store?.adInstalls)} detail="Apple Ads attribution, not ASC downloads" /></div>
      <div className={poisStyles.signalCallout}><strong>Spend: {store?.adSpend === null || store?.adSpend === undefined || !store.adCurrency ? "Unavailable" : `${store.adSpend.toFixed(2)} ${store.adCurrency}`}</strong>
        <p>{store?.adsLatest ? `Last POIS-mapped report day: ${store.adsLatest}. Source currency is retained.` : `No POIS-mapped daily campaign rows for ${country} in this window. Paid delivery is unknown, not zero.`}</p></div>
      <Bars title="Daily Apple Ads taps" points={daily.filter((row) => row.store?.adTaps !== null && row.store?.adTaps !== undefined).map((row) => ({ date: row.date, value: row.store!.adTaps! }))} color="var(--app)" note="Reported UTC days only" />
    </section>
    <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>05 / Search visibility</p><h3>Tracked keyword coverage</h3></div><span><Link href={`/aso/progress?app=${app.id}&country=${country.toLowerCase()}&window=${days}`}>Open keyword detail</Link></span></div>
      {rankingSources.length ? <div className={styles.metrics}>{rankingSources.map((item) => <Metric key={item.name} label={item.name === "apple_web" ? "Apple web" : item.name === "itunes_catalog" ? "iTunes catalog" : item.name} value={fmt(item.ranked)} detail={`${fmt(item.observed)} snapshots · latest ${time(item.latest)}`} />)}</div>
        : <p className={styles.empty}>{source ? "No ranking snapshots in this market and window." : "Ranking source could not be queried."}</p>}
      <p className={poisStyles.flowNote}>Ranked observations count keyword snapshots, not users or native iPhone positions. Apple web and iTunes histories remain separate.</p></section></div>

    <section className={styles.quality}><div className={styles.sectionTitle}><h3>How to read this page</h3><span>No fixtures or synthetic fallbacks</span></div><ul>
      <li>Website dates are Vercel UTC reporting days; app events use UTC event time; Apple reports have their own complete UTC dates. These series are not joined by identity.</li>
      <li>{channel === "testflight" ? "TestFlight is internal instrumentation evidence, not customer behavior." : "Production-channel app events can include developer activity; active installations are observed IDs, not App Store downloads."} Last event receipt {time(product?.latestReceivedAt)} is activity, not a collector heartbeat.</li>
      <li>App Store impressions, first-time downloads, Apple Ads attributed installs, website visits and app opens are different measurements. Referrer hosts do not verify install attribution.</li>
      <li>Client purchase completions are not verified transactions or proceeds. Verified charges, renewals, subscriber counts and CAC are unavailable here.</li>
      <li>Unavailable means no validated row or failed access. An observed zero remains zero. No missing day is filled or smoothed.</li>
    </ul></section>
  </div></PageShell>;
}
