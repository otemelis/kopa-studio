import { AppleAdsAppMappingForm } from "@/components/apple-ads-app-mapping-form";
import { AppleAdsConnectionTest } from "@/components/apple-ads-connection-test";
import { AppleAdsSyncHealth } from "@/components/apple-ads-sync-health";
import { PageShell } from "@/components/page-shell";
import { QueueAppleAdsCampaignSync } from "@/components/queue-apple-ads-campaign-sync";
import { RunAppleAdsStructureSync } from "@/components/run-apple-ads-structure-sync";
import { SyncAppleAdsReports } from "@/components/sync-apple-ads-reports";
import { freshness } from "@/lib/apple-ads/freshness";
import { rates } from "@/lib/apple-ads/reporting";
import { appleAdsStatusClass, formatAppleAdsDeliveryStatus, formatAppleAdsEntityStatus } from "@/lib/apple-ads/status";
import { requireUser } from "@/lib/auth";
import { getAppleAdsAttributionStatus } from "@/repositories/apple-ads-attribution-repository";
import { listAppleAdsRecommendations } from "@/repositories/apple-ads-recommendation-repository";
import { getAppleAdsReporting } from "@/repositories/apple-ads-reporting-repository";
import { listAppleAdsAppMappings, listAppleAdsConnections } from "@/repositories/apple-ads-repository";
import { getAppleAdsDataQuality, listAppleAdsSyncRuns } from "@/repositories/apple-ads-sync-repository";
import { getAppleAdsStructure } from "@/repositories/apple-ads-structure-repository";
import { listApps } from "@/repositories/apps-repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

const formatMoney = (value: number, currency: string | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number | null) => value === null ? "-" : new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
const formatDate = (value: string | null) => value ? value.slice(0, 10) : "-";
const isActiveCampaign = (status: string | null | undefined) => formatAppleAdsEntityStatus(status).label === "Enabled";
const attributionLabel = (state: "not_installed" | "receiving" | "ready_for_test") => state === "receiving" ? "Receiving" : state === "ready_for_test" ? "Ready for test" : "Not installed";

export default async function AppleAdsLabPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const user = await requireUser();
  const requestedApp = (await searchParams).app;
  const now = new Date().toISOString();
  const [connections, mappings, apps, structure, reporting, recommendations, attribution, quality] = await Promise.all([
    listAppleAdsConnections(user.id),
    listAppleAdsAppMappings(user.id),
    listApps(),
    getAppleAdsStructure(user.id),
    getAppleAdsReporting(user.id),
    listAppleAdsRecommendations(user.id),
    getAppleAdsAttributionStatus(user.id),
    getAppleAdsDataQuality(user.id),
  ]);
  const runs = await listAppleAdsSyncRuns(connections.map((connection) => connection.id));
  if (requestedApp) {
    const app = apps.find((item) => item.id === requestedApp || item.storeAppId === requestedApp || (requestedApp === "pois" && /^pois\b/i.test(item.name)));
    if (!app) return <PageShell title="Apple Ads"><section className="notice"><h2>Unknown app</h2><p>No Apple Ads figures were shown because this app could not be resolved.</p></section></PageShell>;
    const campaigns = structure.campaigns.filter((item) => item.appId === app.id);
    const campaignIds = new Set(campaigns.map((item) => item.id));
    const rows = reporting.rows.filter((item) => item.campaignId && campaignIds.has(item.campaignId));
    const latest = rows.reduce<string | null>((value, item) => !value || (item.sourceSyncedAt && item.sourceSyncedAt > value) ? item.sourceSyncedAt : value, null);
    const currencies = [...new Set(rows.map((item) => item.currency).filter(Boolean))];
    return <PageShell title={`${app.name} · Apple Ads`}><section className="notice"><h2>App-scoped paid search</h2><p>Only campaigns explicitly mapped to {app.name} are counted. The portfolio’s historical campaigns and unmapped rows are excluded.</p></section><section className="metric-grid"><article className="metric-card"><p>Imported campaigns</p><strong>{campaigns.length || "Unavailable"}</strong><small>{campaigns.length ? "Current imported structure" : "No app mapping or campaign import"}</small></article><article className="metric-card"><p>Reported impressions</p><strong>{rows.length ? formatNumber(rows.reduce((sum, item) => sum + item.impressions, 0)) : "Unavailable"}</strong><small>{rows.length ? `${rows.length} imported daily rows` : "No app-scoped report rows"}</small></article><article className="metric-card"><p>Reported spend</p><strong>{rows.length && currencies.length === 1 ? formatMoney(rows.reduce((sum, item) => sum + item.spend, 0), currencies[0]) : "Unavailable"}</strong><small>{latest ? `Latest sync ${formatDate(latest)}` : "No successful app-scoped report sync"}</small></article></section><section className="notice"><h2>Connection health</h2><p>{runs[0] ? `Latest sync: ${runs[0].status}${runs[0].errorMessage ? ` · ${runs[0].errorMessage}` : ""}` : "No sync run recorded"}. These are Apple Ads reported measures, not verified paying customers.</p>{/^pois\b/i.test(app.name) ? <p><Link href="/pois-signals">Open POIS source overview</Link></p> : null}</section></PageShell>;
  }
  const currency = reporting.rows.find((row) => row.currency)?.currency ?? structure.campaigns.find((campaign) => campaign.currency)?.currency ?? null;
  const today = now.slice(0, 10);
  const todayRows = reporting.rows.filter((row) => row.metricDate === today);
  const todaySummary = todayRows.reduce((sum, row) => ({ spend: sum.spend + row.spend, installs: sum.installs + row.installs, taps: sum.taps + row.taps, impressions: sum.impressions + row.impressions }), { spend: 0, installs: 0, taps: 0, impressions: 0 });
  const activeCampaigns = structure.campaigns.filter((campaign) => isActiveCampaign(campaign.status));
  const attentionChecks = quality.checks.filter((check) => check.status === "attention");
  const waitingChecks = quality.checks.filter((check) => check.status === "waiting");
  const latestRun = runs[0] ?? null;
  const topRecommendation = recommendations[0] ?? null;
  const summaryRates = rates(reporting.summary);

  return <PageShell title="Apple Ads">
    <section className="metric-grid">
      <article className="metric-card"><p>Spend today</p><strong>{formatMoney(todaySummary.spend, currency)}</strong><small>{todayRows.length ? `${formatNumber(todaySummary.taps)} taps today` : "Waiting for today's report"}</small></article>
      <article className="metric-card"><p>Installs</p><strong>{formatNumber(reporting.summary.installs)}</strong><small>{formatMoney(reporting.summary.spend, currency)} imported spend</small></article>
      <article className="metric-card"><p>Active campaigns</p><strong>{activeCampaigns.length}</strong><small>{structure.campaigns.length ? `${structure.campaigns.length} imported campaigns` : "No campaigns imported"}</small></article>
      <article className="metric-card"><p>Pending actions</p><strong>{recommendations.length}</strong><small>{topRecommendation ? topRecommendation.title : "No Apple Ads recommendations"}</small></article>
    </section>

    <div className="section-head"><h2>What needs attention</h2><span>{attentionChecks.length ? `${attentionChecks.length} blocker${attentionChecks.length === 1 ? "" : "s"}` : "No critical blockers"}</span></div>
    <div className="quality-list">
      {attentionChecks.length || waitingChecks.length ? [...attentionChecks, ...waitingChecks].slice(0, 5).map((check) => <article className="quality-card" key={check.label}>
        <div><h2>{check.label}</h2><p>{check.detail}</p></div>
        <span className={`badge ${check.status === "attention" ? "bad" : "neutral"}`}>{check.status === "attention" ? "Needs attention" : "Waiting"}</span>
      </article>) : <article className="quality-card"><div><h2>No Apple Ads blockers detected</h2><p>Connection, mapping, imports, and sync history do not currently expose an urgent issue.</p></div><span className="badge good">Ready</span></article>}
    </div>

    <div className="section-head"><h2>What changed</h2><span>Latest imported activity</span></div>
    <section className="notice">
      <h2>{latestRun ? `${latestRun.resourceType} sync ${latestRun.status}` : "No sync history yet"}</h2>
      <p>{latestRun ? `${latestRun.rowsInserted} records on ${formatDate(latestRun.createdAt)}${latestRun.errorMessage ? `: ${latestRun.errorMessage}` : "."}` : "Run campaign, structure, or reporting sync after connecting an organization."}</p>
    </section>

    <div className="section-head"><h2>What was learned</h2><span>{reporting.rows.length ? `${reporting.rows.length} performance rows · ` : "Pre-delivery evidence only · "}<Link href="/apple-ads-lab/reporting">Open reporting</Link></span></div>
    <section className="metric-grid">
      <article className="metric-card"><p>Impressions</p><strong>{formatNumber(reporting.summary.impressions)}</strong><small>Imported campaign-level rows</small></article>
      <article className="metric-card"><p>Taps</p><strong>{formatNumber(reporting.summary.taps)}</strong><small>{formatPercent(summaryRates.tapThroughRate)} tap-through rate</small></article>
      <article className="metric-card"><p>Average CPT</p><strong>{summaryRates.averageCpt === null ? "-" : formatMoney(summaryRates.averageCpt, currency)}</strong><small>Based on imported taps</small></article>
      <article className="metric-card"><p>Average CPA</p><strong>{summaryRates.averageCpa === null ? "-" : formatMoney(summaryRates.averageCpa, currency)}</strong><small>Based on imported installs</small></article>
    </section>

    <div className="section-head"><h2>Budget safety</h2><span>Automation level 0</span></div>
    <section className="notice">
      <h2>Read-only controls</h2>
      <p>No campaign, ad group, keyword, negative, bid, or budget changes can be made from Kopa Tools. Current imported spend is {formatMoney(reporting.summary.spend, currency)}, and all recommendation evidence remains advisory.</p>
    </section>

    <div className="section-head"><h2>Campaign summary</h2><span>{quality.latest.campaignSyncedAt ? `Updated ${formatDate(quality.latest.campaignSyncedAt)}` : "Waiting for campaign sync"}</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Campaign</th><th>Market</th><th>State</th><th>Delivery</th><th>Budget</th><th>Keywords</th><th>Updated</th></tr></thead>
      <tbody>{structure.campaigns.length ? structure.campaigns.map((campaign) => { const state = formatAppleAdsEntityStatus(campaign.status); const delivery = formatAppleAdsDeliveryStatus(campaign.servingStatus); return <tr key={campaign.id}>
        <td>{campaign.name}</td><td>{campaign.countriesOrRegions.length ? campaign.countriesOrRegions.join(", ") : "-"}</td><td><span className={appleAdsStatusClass(state)}>{state.label}</span></td><td><span className={appleAdsStatusClass(delivery)}>{delivery.label}</span></td><td>{campaign.dailyBudgetAmount === null ? "-" : formatMoney(campaign.dailyBudgetAmount, campaign.currency)}</td><td>{campaign.keywordCount}</td><td>{formatDate(campaign.sourceSyncedAt)}</td>
      </tr>; }) : <tr><td colSpan={7}>No campaigns imported yet.</td></tr>}</tbody>
    </table></div>

    <div className="section-head"><h2>Attribution readiness</h2><span>{attribution.latestReceivedAt ? `Latest event ${formatDate(attribution.latestReceivedAt)}` : "No events yet"}</span></div>
    <section className="metric-grid">
      <article className="metric-card"><p>Endpoint</p><strong>{attribution.endpointConfigured ? "Configured" : "Incomplete"}</strong><small>{attribution.endpointUrl}</small></article>
      <article className="metric-card"><p>Bearer secret</p><strong>{attribution.secretConfigured ? "Configured" : "Missing"}</strong><small>Required before app events can be trusted</small></article>
      <article className="metric-card"><p>App integration</p><strong>{attributionLabel(attribution.appIntegrationState)}</strong><small>{attribution.mappedAppCount} mapped app{attribution.mappedAppCount === 1 ? "" : "s"}</small></article>
      <article className="metric-card"><p>Events</p><strong>{formatNumber(attribution.eventCount)}</strong><small>{attribution.latestReceivedAt ? `Latest ${formatDate(attribution.latestReceivedAt)}` : "Waiting for first event"}</small></article>
    </section>

    <div className="section-head"><h2>Setup controls</h2><span>Connection and read-only imports</span></div>
    <AppleAdsConnectionTest />

    {connections.length ? <>
      <section className="notice">
        <h2>Data freshness</h2>
        <p>{connections.map((connection) => `${connection.appleAdsOrgName}: ${freshness(connection.lastApiSuccessAt, now)}`).join(" · ")}</p>
      </section>

      <div className="section-head"><h2>App mapping</h2><span>Connect Apple Adam IDs to Kopa apps</span></div>
      <section className="notice">
        <h2>Why this matters</h2>
        <p>Mappings let campaign imports, attribution events, and later recommendations resolve Apple Ads data back to the right Kopa app. They do not change anything inside Apple Ads.</p>
      </section>
      <AppleAdsAppMappingForm connections={connections.map((connection) => ({ id: connection.id, name: connection.appleAdsOrgName }))} apps={apps.map((app) => ({ id: app.id, name: app.name, storeAppId: app.storeAppId }))} />

      <div className="table-wrap">
        <table>
          <thead><tr><th>Kopa app</th><th>Adam ID</th><th>Apple app name</th><th>Status</th></tr></thead>
          <tbody>{mappings.length ? mappings.map((mapping) => <tr key={mapping.id}>
            <td>{mapping.appName ?? "Mapped app"}</td>
            <td>{mapping.adamId}</td>
            <td>{mapping.appleAppName ?? "-"}</td>
            <td><span className="badge good">{mapping.mappingStatus}</span></td>
          </tr>) : <tr><td colSpan={4}>No app mappings saved yet.</td></tr>}</tbody>
        </table>
      </div>

      <section className="notice">
        <h2>Read-only synchronization</h2>
        <QueueAppleAdsCampaignSync connectionId={connections[0].id} />
        <RunAppleAdsStructureSync />
        <SyncAppleAdsReports />
      </section>

      <div className="section-head"><h2>Sync health</h2></div>
      <AppleAdsSyncHealth runs={runs} />
    </> : null}
  </PageShell>;
}
