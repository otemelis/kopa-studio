import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getAppleAdsAttributionStatus } from "@/repositories/apple-ads-attribution-repository";
import { getAppleAdsDataQuality } from "@/repositories/apple-ads-sync-repository";
import { listRecentRuns } from "@/repositories/overview-repository";
import { loadAppStoreConnectStatus } from "@/services/appstore-connect-service";
import { loadStorefrontMetricSummaries } from "@/services/storefront-metrics-service";
import { resolveDiscoveryPeriod } from "@/lib/discovery-period";
import { resolvePublicSourceStatus } from "@/lib/public-source-status";

export const dynamic = "force-dynamic";

type SourceCard = {
  name: string;
  status: "configured" | "waiting" | "error";
  configuration: string;
  freshness: string;
  lastFailure: string;
  href: string;
  detail: string;
};

const date = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
const statusFromCheck = (hasAttention: boolean, hasWaiting: boolean) => hasAttention ? "error" : hasWaiting ? "waiting" : "configured";
const number = new Intl.NumberFormat("en-US");
const percent = (value: number | null) => value === null ? "-" : `${(value * 100).toFixed(1)}%`;
const compactDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00Z`));
const signedPercent = (value: number | null) => value === null ? "-" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const evidenceWindow = (start: string | null, end: string | null) => start && end ? `${compactDate(start)}–${compactDate(end)}` : "-";

export default async function AppStoreConnectPage({ searchParams }: { searchParams: Promise<{ app?: string; country?: string; period?: string }> }) {
  const user = await requireUser();
  const filters = await searchParams;
  const { days } = resolveDiscoveryPeriod(filters.period);
  const [connection, metrics, appleAds, attribution, recentRuns] = await Promise.all([
    loadAppStoreConnectStatus(),
    loadStorefrontMetricSummaries(days, filters.app, filters.country),
    getAppleAdsDataQuality(user.id),
    getAppleAdsAttributionStatus(user.id),
    listRecentRuns(),
  ]);
  const attributionReady = attribution.endpointConfigured && attribution.secretConfigured && attribution.mappedAppCount > 0;
  const publicStatus = resolvePublicSourceStatus(recentRuns);
  const publicFailureDetail = publicStatus.lastFailureRun
    ? `${date(publicStatus.lastFailureRun.startedAt)} · ${publicStatus.lastFailureRun.error ?? `${publicStatus.lastFailureRun.failed} item(s) failed`}${publicStatus.lastFailureRecovered ? " · Recovered by a later successful run" : ""}`
    : "-";
  const scopedAscRequests = filters.app ? connection.reportRequests.filter((request) => request.appId === filters.app) : connection.reportRequests;
  const failedAscRequest = scopedAscRequests.find((request) => request.lastError || request.lastResultState === "error" || /failed|error/i.test(request.status));
  const partialAscRequest = scopedAscRequests.find((request) => request.lastResultState === "partial");
  const zeroAscRequest = scopedAscRequests.find((request) => request.lastResultState === "zero");
  const latestAscRequest = scopedAscRequests[0] ?? null;
  const appleAdsAttention = appleAds.checks.some((check) => check.status === "attention");
  const appleAdsWaiting = appleAds.checks.some((check) => check.status === "waiting");
  const failedAppleAdsRun = appleAds.runs.find((run) => run.status === "failed" || run.status === "partial");
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
  const latestDiscoveryDate = metrics.daily.at(-1)?.date ?? null;
  const maxDaily = Math.max(1, ...metrics.daily.map((row) => Math.max(row.impressions, row.pageViews, row.downloads)));
  const topSources = metrics.sourceTypes.slice(0, 6);

  const sources: SourceCard[] = [
    {
      name: "Public App Store",
      status: publicStatus.status,
      configuration: "Collector configured",
      freshness: publicStatus.lastSuccessfulRun?.finishedAt
        ? date(publicStatus.lastSuccessfulRun.finishedAt)
        : publicStatus.lastSuccessfulRun
          ? date(publicStatus.lastSuccessfulRun.startedAt)
          : "Waiting for first successful run",
      lastFailure: publicFailureDetail,
      href: "/collection",
      detail: "Public metadata, ranking snapshots, competitors, and reviews.",
    },
    {
      name: "App Store Connect",
      status: connection.status === "error" || failedAscRequest ? "error" : partialAscRequest ? "waiting" : connection.status === "configured" && !zeroAscRequest ? "configured" : "waiting",
      configuration: connection.status === "configured" ? "Connection configured" : "Connection incomplete",
      freshness: latestDiscoveryDate ? `Discovery through ${compactDate(latestDiscoveryDate)}` : connection.lastSyncAt ? date(connection.lastSyncAt) : "Waiting for sync",
      lastFailure: failedAscRequest?.lastError ?? connection.lastTestMessage ?? "-",
      href: "/app-store-connect",
      detail: "Discovery, engagement, storefront activity, and sales-adjacent metrics.",
    },
    {
      name: "Apple Ads",
      status: statusFromCheck(appleAdsAttention, appleAdsWaiting),
      configuration: appleAds.counts.connections ? `${appleAds.counts.connections} organization${appleAds.counts.connections === 1 ? "" : "s"} connected` : "No organization connected",
      freshness: appleAds.latest.metricSyncedAt ? date(appleAds.latest.metricSyncedAt) : appleAds.latest.campaignSyncedAt ? date(appleAds.latest.campaignSyncedAt) : "Waiting for import",
      lastFailure: failedAppleAdsRun?.errorMessage ?? "-",
      href: "/apple-ads-lab/data-quality",
      detail: "Campaign structure, keywords, reporting, recommendations, and attribution mapping.",
    },
    {
      name: "Attribution",
      status: attribution.eventCount ? "configured" : attributionReady ? "waiting" : "error",
      configuration: attributionReady ? "Endpoint, secret, and mapping ready" : "Endpoint, secret, or app mapping incomplete",
      freshness: attribution.latestReceivedAt ? date(attribution.latestReceivedAt) : "Waiting for first event",
      lastFailure: attributionReady ? "-" : "App-side event forwarding is not fully ready",
      href: "/apple-ads-lab/attribution",
      detail: "Server-to-server install attribution intake for mapped apps.",
    },
    {
      name: "App Event Analytics",
      status: "waiting",
      configuration: "Not connected",
      freshness: "Not receiving events",
      lastFailure: "No app analytics source is wired into Tools yet",
      href: "/apple-ads-lab/attribution",
      detail: "Product events beyond Apple Ads attribution are not imported yet.",
    },
    {
      name: "AI Provider",
      status: aiConfigured ? "configured" : "waiting",
      configuration: aiConfigured ? "Provider key present" : "No provider key detected",
      freshness: "Used only for approved analysis flows",
      lastFailure: "-",
      href: "/insights",
      detail: "Optional analysis support. No autonomous Apple Ads write actions are enabled.",
    },
  ];

  return <PageShell title="Sources">
    <section className="source-grid">
      {sources.map((source) => <article className="source-card" key={source.name}>
        <h2>{source.name}</h2>
        <StatusBadge status={source.status} />
        <p>{source.detail}</p>
        <small>{source.configuration}</small>
        <Link className="source-link" href={source.href}>View details</Link>
      </article>)}
    </section>

    <div className="section-head"><h2>Source status</h2><span>Configuration, freshness, and last failure</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Source</th><th>Status</th><th>Configuration</th><th>Freshness</th><th>Last failure</th></tr></thead>
      <tbody>{sources.map((source) => <tr key={source.name}><td>{source.name}</td><td><StatusBadge status={source.status} /></td><td>{source.configuration}</td><td>{source.freshness}</td><td>{source.lastFailure}</td></tr>)}</tbody>
    </table></div>

    <section className="notice">
      <h2>Server-side credentials retained</h2>
      <p>{connection.lastTestMessage ?? "Connection details will appear after the existing integration is tested."} Credentials and private keys remain server-side only.</p>
    </section>

    <div className="section-head"><h2>Discovery evidence quality</h2><span>Parser provenance and latest import outcome</span></div>
    <section className="metric-grid">
      <article className="metric-card"><p>Import result</p><strong>{latestAscRequest?.lastResultState ?? "Not recorded"}</strong><small>{latestAscRequest?.lastResultDetail ?? "Run the Discovery import once to record an explicit result."}</small></article>
      <article className="metric-card"><p>Parser version</p><strong>{latestAscRequest?.parserVersion ?? "Unknown"}</strong><small>{latestAscRequest?.reportHeaders.length ? `${latestAscRequest.reportHeaders.length} source columns verified` : "Source columns not recorded yet"}</small></article>
      <article className="metric-card"><p>Rows</p><strong>{latestAscRequest?.importedRowCount ?? "-"}</strong><small>{latestAscRequest ? `${latestAscRequest.sourceRowCount ?? 0} source · ${latestAscRequest.rejectedRowCount ?? 0} rejected` : "No import result"}</small></article>
      <article className="metric-card"><p>Evidence window</p><strong>{latestAscRequest ? evidenceWindow(latestAscRequest.evidenceStart, latestAscRequest.evidenceEnd) : "-"}</strong><small>{latestAscRequest?.segmentCount ?? 0} Apple segment(s)</small></article>
    </section>
    {latestAscRequest?.lastResultState === "partial" ? <section className="notice"><h2>Partial Discovery evidence</h2><p>Valid rows were imported, but invalid source rows were excluded. Treat trends and recommendations as incomplete until the next clean import.</p></section> : null}
    {latestAscRequest?.lastResultState === "zero" ? <section className="notice"><h2>Valid report, no evidence rows</h2><p>Apple returned a readable report with no data rows. Zero evidence is not the same as zero impressions or failed conversion.</p></section> : null}
    {latestAscRequest?.lastResultState === "error" ? <section className="notice"><h2>Discovery report could not be parsed</h2><p>{latestAscRequest.lastError ?? latestAscRequest.lastResultDetail ?? "The report format or download failed. Existing facts remain historical and should not be treated as a fresh successful import."}</p></section> : null}

    <div className="section-head"><h2>Discovery &amp; Engagement overview</h2><span>{metrics.days} days · organic visibility and conversion layer</span></div>
    <section className="metric-grid">
      <article className="metric-card"><p>Impressions</p><strong>{number.format(metrics.totals.impressions)}</strong><small>{metrics.hasDiscoveryRows ? "App Store discovery exposure" : "Waiting for Discovery report rows"}</small></article>
      <article className="metric-card"><p>Product page views</p><strong>{number.format(metrics.totals.pageViews)}</strong><small>{percent(metrics.totals.impressionToPageRate)} from impression to page view</small></article>
      <article className="metric-card"><p>Downloads</p><strong>{number.format(metrics.totals.downloads)}</strong><small>{metrics.hasDailyRows ? `${percent(metrics.totals.downloadRate)} page-view conversion` : "Waiting for sales/download import"}</small></article>
      <article className="metric-card"><p>Latest report day</p><strong>{latestDiscoveryDate ? compactDate(latestDiscoveryDate) : "-"}</strong><small>{latestDiscoveryDate ? "Latest imported App Store Connect day" : "Use Retry Discovery report import"}</small></article>
    </section>
    <section className="notice">
      <h2>Scoped Discovery assessment: {metrics.sufficiency.decisionReady ? "Decision-ready" : "Waiting"}</h2>
      <p>{metrics.sufficiency.decisionReady ? "The exact market evidence is ready for deterministic directional checks." : metrics.sufficiency.waitingExplanation}</p>
    </section>
    <section className="metric-grid">
      <article className="metric-card"><p>Freshness</p><strong>{metrics.sufficiency.freshness.label}</strong><small>{metrics.sufficiency.freshness.explanation}</small></article>
      <article className="metric-card"><p>Completeness</p><strong>{metrics.sufficiency.completeness.label}</strong><small>{metrics.sufficiency.completeness.importedRows}/{metrics.sufficiency.completeness.sourceRows} rows · {metrics.sufficiency.completeness.rejectedRows} rejected</small></article>
      <article className="metric-card"><p>Period coverage</p><strong>{metrics.sufficiency.windowAlignment.label}</strong><small>Requested {metrics.sufficiency.requestedWindow.start}–{metrics.sufficiency.requestedWindow.end}</small></article>
      <article className="metric-card"><p>Evidence volume</p><strong>{metrics.sufficiency.volume.label}</strong><small>{metrics.sufficiency.observedDays} observed days · {number.format(metrics.sufficiency.volume.impressions)} impressions · {number.format(metrics.sufficiency.volume.pageViews)} page views</small></article>
    </section>
    <section className="notice">
      <h2>Exact evidence windows</h2>
      <p>Imported report: {evidenceWindow(metrics.sufficiency.importedWindow.start, metrics.sufficiency.importedWindow.end)}. Scoped {filters.country?.toUpperCase() ?? "selected-market"} rows: {evidenceWindow(metrics.sufficiency.observedWindow.start, metrics.sufficiency.observedWindow.end)}.</p>
    </section>

    <section className="notice">
      <h2>Apple Ads delivery state</h2>
      <p>{appleAds.latest.metricSyncedAt ? `Apple Ads metrics were last imported ${date(appleAds.latest.metricSyncedAt)}.` : "The first Apple Ads campaign can be queued or approved before it serves. Until Apple reports impressions, Kopa should treat ad performance as waiting for delivery, not as a failed campaign."}</p>
    </section>

    <div className="section-head"><h2>Discovery decision brief</h2><span>Current half vs previous half · no ad delivery required</span></div>
    <section className="metric-grid">
      <article className="metric-card"><p>Impressions trend</p><strong>{signedPercent(metrics.trend.changes.impressions)}</strong><small>{number.format(metrics.trend.current.impressions)} current vs {number.format(metrics.trend.previous.impressions)} previous</small></article>
      <article className="metric-card"><p>Page-view trend</p><strong>{signedPercent(metrics.trend.changes.pageViews)}</strong><small>{number.format(metrics.trend.current.pageViews)} current vs {number.format(metrics.trend.previous.pageViews)} previous</small></article>
      <article className="metric-card"><p>Download trend</p><strong>{signedPercent(metrics.trend.changes.downloads)}</strong><small>{number.format(metrics.trend.current.downloads)} current vs {number.format(metrics.trend.previous.downloads)} previous</small></article>
      <article className="metric-card"><p>Brief status</p><strong>{metrics.opportunities.length}</strong><small>{metrics.opportunities.length === 1 ? "active signal" : "active signals"}</small></article>
    </section>
    <section className="decision-grid">
      {metrics.opportunities.map((item) => <article key={item.title} className={`decision-${item.severity}`}><span>{item.severity}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}
    </section>

    <div className="analytics-two-col">
      <section className="analytics-panel activity-panel">
        <header><div><h2>Daily storefront trend</h2><p>Discovery impressions, product page views, and downloads</p></div><span>{latestDiscoveryDate ? `Latest ${compactDate(latestDiscoveryDate)}` : "No rows yet"}</span></header>
        {metrics.daily.length ? <><div className="activity-chart multi-chart">{metrics.daily.map((row) => <div key={row.date} title={`${row.date}: ${row.impressions} impressions · ${row.pageViews} page views · ${row.downloads} downloads`}><i className="bar-impressions" style={{ height: `${Math.max(row.impressions ? 4 : 0, row.impressions / maxDaily * 100)}%` }} /><i className="bar-page-views" style={{ height: `${Math.max(row.pageViews ? 4 : 0, row.pageViews / maxDaily * 100)}%` }} /><i className="bar-downloads" style={{ height: `${Math.max(row.downloads ? 4 : 0, row.downloads / maxDaily * 100)}%` }} /></div>)}</div><footer><span>{metrics.daily[0] ? compactDate(metrics.daily[0].date) : ""}</span><span>Impressions · Page views · Downloads</span></footer></> : <p className="empty-copy">Discovery &amp; Engagement reports can take 1-2 days after Apple starts generating them.</p>}
      </section>
      <section className="analytics-panel segment-panel">
        <header><div><h2>Discovery sources</h2><p>Source Type from App Store Connect rows</p></div><span>{topSources.length ? `${topSources.length} source${topSources.length === 1 ? "" : "s"}` : "Waiting"}</span></header>
        {topSources.length ? <div className="segment-list">{topSources.map((source) => <div key={source.sourceType}><span>{source.sourceType}</span><i><b style={{ width: `${Math.max(3, source.pageViews / Math.max(1, topSources[0].pageViews) * 100)}%` }} /></i><strong>{number.format(source.pageViews)} views</strong></div>)}</div> : <p className="empty-copy">Source mix appears after Discovery &amp; Engagement rows import.</p>}
      </section>
    </div>

    <div className="section-head"><h2>Discovery &amp; Engagement requests</h2><span>Existing App Store Connect records</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>App</th><th>Request</th><th>Result</th><th>Parser</th><th>Evidence</th><th>Rows</th><th>Last checked</th><th>Detail</th></tr></thead>
      <tbody>{connection.reportRequests.length ? connection.reportRequests.map((request, index) => <tr key={`${request.appName}:${index}`}><td>{request.appName}</td><td><StatusBadge status={request.status} /></td><td><StatusBadge status={request.lastResultState ?? "not recorded"} /></td><td>{request.parserVersion ?? "-"}</td><td>{evidenceWindow(request.evidenceStart, request.evidenceEnd)}</td><td>{request.importedRowCount ?? "-"} / {request.sourceRowCount ?? "-"}</td><td>{date(request.lastCheckedAt)}</td><td>{request.lastError ?? request.lastResultDetail ?? "-"}</td></tr>) : <tr><td colSpan={8}>No report requests recorded.</td></tr>}</tbody>
    </table></div>

    <div className="section-head"><h2>Storefront activity</h2><span>Last {metrics.days} days · discovery reports</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>App</th><th>Country</th><th>Impressions</th><th>Product page views</th><th>Downloads</th><th>View rate</th><th>Download rate</th></tr></thead>
      <tbody>{metrics.countries.length ? metrics.countries.map((metric) => <tr key={`${metric.appId}:${metric.country}`}><td>{metric.appName}</td><td>{metric.country.toUpperCase()}</td><td>{number.format(metric.impressions)}</td><td>{number.format(metric.pageViews)}</td><td>{number.format(metric.downloads)}</td><td>{percent(metric.impressionToPageRate)}</td><td>{percent(metric.downloadRate)}</td></tr>) : <tr><td colSpan={7}>No Discovery &amp; Engagement metric rows in this {metrics.days}-day window.</td></tr>}</tbody>
    </table></div>
  </PageShell>;
}
