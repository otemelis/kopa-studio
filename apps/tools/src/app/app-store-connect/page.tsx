import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getAppleAdsAttributionStatus } from "@/repositories/apple-ads-attribution-repository";
import { getAppleAdsDataQuality } from "@/repositories/apple-ads-sync-repository";
import { listRecentRuns } from "@/repositories/overview-repository";
import { loadAppStoreConnectStatus } from "@/services/appstore-connect-service";
import { loadStorefrontMetricSummaries } from "@/services/storefront-metrics-service";

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

export default async function AppStoreConnectPage() {
  const user = await requireUser();
  const [connection, metrics, appleAds, attribution, recentRuns] = await Promise.all([
    loadAppStoreConnectStatus(),
    loadStorefrontMetricSummaries(),
    getAppleAdsDataQuality(user.id),
    getAppleAdsAttributionStatus(user.id),
    listRecentRuns(),
  ]);
  const attributionReady = attribution.endpointConfigured && attribution.secretConfigured && attribution.mappedAppCount > 0;
  const latestPublicRun = recentRuns[0] ?? null;
  const failedPublicRun = recentRuns.find((run) => run.status === "failed" || run.status === "partial");
  const failedAscRequest = connection.reportRequests.find((request) => request.lastError || /failed|error/i.test(request.status));
  const appleAdsAttention = appleAds.checks.some((check) => check.status === "attention");
  const appleAdsWaiting = appleAds.checks.some((check) => check.status === "waiting");
  const failedAppleAdsRun = appleAds.runs.find((run) => run.status === "failed" || run.status === "partial");
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());

  const sources: SourceCard[] = [
    {
      name: "Public App Store",
      status: failedPublicRun ? "error" : latestPublicRun ? "configured" : "waiting",
      configuration: "Collector configured",
      freshness: latestPublicRun?.finishedAt ? date(latestPublicRun.finishedAt) : latestPublicRun ? date(latestPublicRun.startedAt) : "Waiting for first run",
      lastFailure: failedPublicRun?.error ?? (failedPublicRun ? `${failedPublicRun.failed} item(s) failed` : "-"),
      href: "/collection",
      detail: "Public metadata, ranking snapshots, competitors, and reviews.",
    },
    {
      name: "App Store Connect",
      status: connection.status === "error" || failedAscRequest ? "error" : connection.status === "configured" ? "configured" : "waiting",
      configuration: connection.status === "configured" ? "Connection configured" : "Connection incomplete",
      freshness: connection.lastSyncAt ? date(connection.lastSyncAt) : "Waiting for sync",
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

    <div className="section-head"><h2>Discovery &amp; Engagement requests</h2><span>Existing App Store Connect records</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>App</th><th>Status</th><th>Last checked</th><th>Last error</th></tr></thead>
      <tbody>{connection.reportRequests.length ? connection.reportRequests.map((request, index) => <tr key={`${request.appName}:${index}`}><td>{request.appName}</td><td><StatusBadge status={request.status} /></td><td>{date(request.lastCheckedAt)}</td><td>{request.lastError ?? "-"}</td></tr>) : <tr><td colSpan={4}>No report requests recorded.</td></tr>}</tbody>
    </table></div>

    <div className="section-head"><h2>Storefront activity</h2><span>Last 28 days · discovery reports</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>App</th><th>Country</th><th>Impressions</th><th>Product page views</th><th>Downloads</th><th>Conversion</th></tr></thead>
      <tbody>{metrics.length ? metrics.map((metric) => <tr key={`${metric.appId}:${metric.country}`}><td>{metric.appName}</td><td>{metric.country.toUpperCase()}</td><td>{metric.impressions.toLocaleString()}</td><td>{metric.pageViews.toLocaleString()}</td><td>{metric.downloads.toLocaleString()}</td><td>{metric.pageViews ? `${((metric.downloads / metric.pageViews) * 100).toFixed(1)}%` : "-"}</td></tr>) : <tr><td colSpan={6}>No Discovery &amp; Engagement metric rows in this 28-day window.</td></tr>}</tbody>
    </table></div>
  </PageShell>;
}
