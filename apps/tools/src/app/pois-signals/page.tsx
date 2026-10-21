import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";
import { readPoisReport } from "@/lib/pois-live/source";
import { getAsoProgressData } from "@/repositories/aso-progress-repository";
import { listApps } from "@/repositories/apps-repository";

export const dynamic = "force-dynamic";

const fmt = (value: number) => new Intl.NumberFormat("en-US").format(value);
const day = (value: string | null) => value ? `${value.slice(0, 10)} UTC` : "No observation";
const currentTime = () => Date.now();

export default async function PoisSignalsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireUser();
  const days: 7 | 28 = (await searchParams).days === "28" ? 28 : 7;
  const app = (await listApps()).find((item) => /^pois\b/i.test(item.name));
  if (!app) return <PageShell title="POIS signals"><section className="notice">POIS is not configured in the app catalog.</section></PageShell>;
  const [asoResult, productResult] = await Promise.allSettled([getAsoProgressData(app.id), readPoisReport(days, "appstore")]);
  const aso = asoResult.status === "fulfilled" ? asoResult.value : null;
  const product = productResult.status === "fulfilled" ? productResult.value : null;
  const cutoff = new Date(currentTime() - days * 86_400_000).toISOString().slice(0, 10);
  const keywords = aso?.keywords.filter((item) => item.country === app.primaryCountry) ?? [];
  const ids = new Set(keywords.map((item) => item.id));
  const snapshots = aso?.snapshots.filter((item) => ids.has(item.keyword_id) && item.captured_on >= cutoff) ?? [];
  const bySource = [...new Set(snapshots.map((item) => item.source))].sort().map((source) => {
    const rows = snapshots.filter((item) => item.source === source);
    const latest = rows.reduce<string | null>((value, item) => !value || item.captured_at > value ? item.captured_at : value, null);
    return { source, observations: rows.length, ranked: rows.filter((item) => item.collection_status !== "failed" && item.found && item.rank !== null).length, latest };
  });
  const rankingDays = [...new Set(snapshots.map((item) => item.captured_on))].sort().reverse().map((date) => ({
    date,
    sources: bySource.map(({ source }) => ({
      source,
      ranked: snapshots.filter((item) => item.captured_on === date && item.source === source && item.collection_status !== "failed" && item.found && item.rank !== null).length,
      observed: snapshots.filter((item) => item.captured_on === date && item.source === source).length,
    })),
  }));
  const metrics = aso?.metrics.filter((item) => item.date >= cutoff) ?? [];
  const metricTotal = (event: string) => {
    const rows = metrics.filter((item) => item.event.toLowerCase().replace(/[^a-z]/g, "") === event);
    return rows.length ? fmt(rows.reduce((sum, item) => sum + (item.count ?? 0), 0)) : "Unavailable";
  };
  const sales = aso?.sales.filter((item) => item.date >= cutoff) ?? [];
  const paid = aso?.paidSearch.filter((item) => item.metric_date >= cutoff) ?? [];
  const paidCurrencies = [...new Set(paid.map((item) => item.currency).filter(Boolean))];
  const latestAsc = metrics.reduce<string | null>((value, item) => !value || item.date > value ? item.date : value, null);
  const latestPaid = paid.reduce<string | null>((value, item) => !value || item.metric_date > value ? item.metric_date : value, null);

  return <PageShell title="POIS signals">
    <section className="notice"><h2>Source-separated launch view</h2><p>Last {days} days · {app.primaryCountry.toUpperCase()} storefront for rankings · production app events only. These sources measure different things and are not joined into a customer funnel.</p><p><Link href="/pois-signals?days=7">7 days</Link> · <Link href="/pois-signals?days=28">28 days</Link></p></section>
    <div className="section-head"><h2>ASO visibility</h2><Link href={`/aso/progress?app=${app.id}&country=${app.primaryCountry}&window=${days}`}>Keyword detail</Link></div>
    <section className="metric-grid">{bySource.length ? bySource.map((source) => <article className="metric-card" key={source.source}><p>{source.source === "itunes_catalog" ? "iTunes catalog order" : source.source === "apple_web" ? "Apple web results" : source.source}</p><strong>{fmt(source.ranked)} ranked observations</strong><small>{fmt(source.observations)} snapshots · latest {day(source.latest)} · sources are not native iPhone ranks</small></article>) : <article className="metric-card"><p>Rankings</p><strong>Unavailable</strong><small>{aso ? "No observations in this window" : "Ranking source query failed"}</small></article>}</section>
    {rankingDays.length ? <div className="table-wrap"><table><thead><tr><th>UTC day</th>{bySource.map((item) => <th key={item.source}>{item.source === "itunes_catalog" ? "iTunes catalog" : item.source === "apple_web" ? "Apple web" : item.source}</th>)}</tr></thead><tbody>{rankingDays.map((item) => <tr key={item.date}><td>{item.date}</td>{item.sources.map((source) => <td key={source.source}>{source.ranked} ranked / {source.observed} observed</td>)}</tr>)}</tbody></table></div> : null}
    <div className="section-head"><h2>Apple Ads delivery</h2><Link href="/apple-ads-lab">Connection status</Link></div>
    <section className="metric-grid"><article className="metric-card"><p>Campaign impressions</p><strong>{paid.length ? fmt(paid.reduce((sum, item) => sum + (item.impressions ?? 0), 0)) : "Unavailable"}</strong><small>{paid.length ? `Latest ${day(latestPaid)}` : "No POIS-mapped daily campaign rows"}</small></article><article className="metric-card"><p>Spend</p><strong>{paid.length && paidCurrencies.length === 1 ? `${paid.reduce((sum, item) => sum + (item.spend ?? 0), 0).toFixed(2)} ${paidCurrencies[0]}` : "Unavailable"}</strong><small>{paid.length ? "Apple Ads reported spend" : "Campaign import/authentication needs repair"}</small></article></section>
    <div className="section-head"><h2>App Store acquisition</h2><Link href="/app-store-connect">Reporting status</Link></div>
    <section className="metric-grid"><article className="metric-card"><p>Impressions</p><strong>{metricTotal("impression")}</strong><small>App Store Connect · latest {day(latestAsc)}</small></article><article className="metric-card"><p>Product-page views</p><strong>{metricTotal("pageview")}</strong><small>App Store Connect · not Apple Ads taps</small></article><article className="metric-card"><p>Sales report units</p><strong>{sales.length ? fmt(sales.reduce((sum, item) => sum + (item.downloads ?? 0), 0)) : "Unavailable"}</strong><small>{sales.length ? "Official Sales and Trends units; not first-time downloads" : "No POIS acquisition rows in this window"}</small></article></section>
    <div className="section-head"><h2>Product activity</h2><Link href="/analytics?app=pois">Journey detail</Link></div>
    <section className="metric-grid"><article className="metric-card"><p>Observed active installations</p><strong>{product ? fmt(product.installationCount) : "Unavailable"}</strong><small>{product ? `${product.eventCount} appstore-channel events · latest ${day(product.latestReceivedAt)}` : "Private read-only event query failed"}</small></article><article className="metric-card"><p>Sessions started</p><strong>{product ? fmt(product.events.find((item) => item.name === "session_started")?.installations ?? 0) : "Unavailable"}</strong><small>Distinct installation IDs, not customers</small></article><article className="metric-card"><p>Client purchase completions</p><strong>{product ? fmt(product.purchaseCompletions) : "Unavailable"}</strong><small>Client signal only; not verified paid transactions or revenue</small></article></section>
    {product?.daily.length ? <div className="table-wrap"><table><thead><tr><th>UTC day</th><th>Observed active installations</th></tr></thead><tbody>{[...product.daily].reverse().map((item) => <tr key={item.date}><td>{item.date}</td><td>{item.installations}</td></tr>)}</tbody></table></div> : null}
    <section className="notice"><h2>Current interpretation</h2><p>{!paid.length || !metrics.length ? "Evidence remains incomplete: paid delivery and App Store acquisition cannot yet be assessed together with product usage. Missing reports are unavailable, not zero." : "Inspect source-specific dates and definitions before interpreting changes. Paid attribution, downloads and app events are separate measurements."}</p></section>
  </PageShell>;
}
