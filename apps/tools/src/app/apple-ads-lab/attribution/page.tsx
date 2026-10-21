import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getAppleAdsAttributionStatus } from "@/repositories/apple-ads-attribution-repository";

export const dynamic = "force-dynamic";

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
const appIntegrationLabel = (state: "not_installed" | "receiving" | "ready_for_test") => state === "receiving" ? "Receiving" : state === "ready_for_test" ? "Ready for test" : "Not installed";
const appIntegrationBadge = (state: "not_installed" | "receiving" | "ready_for_test") => state === "receiving" ? "configured" : state === "ready_for_test" ? "waiting" : "error";

export default async function AppleAdsAttributionPage() {
  const user = await requireUser();
  const attribution = await getAppleAdsAttributionStatus(user.id);

  return <PageShell title="Attribution">
    <section className="notice">
      <h2>Server-to-server intake</h2>
      <p>Attribution events are accepted only from a trusted backend using the configured bearer secret. The mobile app should never receive or store this secret.</p>
    </section>

    <section className="metric-grid">
      <article className="metric-card"><p>Endpoint</p><strong>Configured</strong><small>{attribution.endpointUrl}</small></article>
      <article className="metric-card"><p>Bearer secret</p><strong>{attribution.secretConfigured ? "Configured" : "Missing"}</strong><small>Required for server-to-server intake</small></article>
      <article className="metric-card"><p>App integration</p><strong>{appIntegrationLabel(attribution.appIntegrationState)}</strong><small>{attribution.mappedAppCount} mapped app{attribution.mappedAppCount === 1 ? "" : "s"}</small></article>
      <article className="metric-card"><p>Events</p><strong>{attribution.eventCount}</strong><small>Stored attribution records</small></article>
    </section>

    <div className="section-head"><h2>Setup checks</h2><span>Privacy-safe intake only</span></div>
    <div className="quality-list">
      <article className="quality-card"><div><h2>Endpoint URL</h2><p>{attribution.endpointUrl}</p></div><StatusBadge status="configured" /></article>
      <article className="quality-card"><div><h2>Bearer secret</h2><p>{attribution.secretConfigured ? "APPLE_ADS_ATTRIBUTION_SECRET is configured in production." : "Add APPLE_ADS_ATTRIBUTION_SECRET before sending events."}</p></div><StatusBadge status={attribution.secretConfigured ? "configured" : "error"} /></article>
      <article className="quality-card"><div><h2>App mapping</h2><p>{attribution.mappedAppCount ? `${attribution.mappedAppCount} app${attribution.mappedAppCount === 1 ? "" : "s"} can receive attribution events.` : "Map at least one Apple Ads app before attribution events can be tied back to Kopa apps."}</p></div><StatusBadge status={attribution.mappedAppCount ? "configured" : "error"} /></article>
      <article className="quality-card"><div><h2>App integration</h2><p>{attribution.appIntegrationState === "receiving" ? "The server is receiving attribution events." : attribution.appIntegrationState === "ready_for_test" ? "Endpoint, secret, and app mapping are ready. The app backend still needs to forward its first event." : "Install the app-side AdServices/backend forwarding integration after endpoint, secret, and mapping are ready."}</p></div><StatusBadge status={appIntegrationBadge(attribution.appIntegrationState)} /></article>
      <article className="quality-card"><div><h2>Event arrival</h2><p>{attribution.eventCount ? `${attribution.eventCount} attribution event${attribution.eventCount === 1 ? "" : "s"} received.` : "No attribution events have arrived yet. This is expected until the app backend forwards its first event."}</p></div><StatusBadge status={attribution.eventCount ? "configured" : "waiting"} /></article>
      <article className="quality-card"><div><h2>Latest event</h2><p>{formatDate(attribution.latestReceivedAt)}</p></div><StatusBadge status={attribution.latestReceivedAt ? "configured" : "waiting"} /></article>
    </div>

    <div className="section-head"><h2>Mapped apps</h2><span>Events are keyed by anonymous installation key</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>App</th><th>Bundle</th><th>Events</th><th>Latest received</th></tr></thead>
      <tbody>{attribution.apps.length ? attribution.apps.map((app) => <tr key={app.id}>
        <td>{app.name}</td><td>{app.bundleId ?? "-"}</td><td>{app.eventCount}</td><td>{formatDate(app.latestReceivedAt)}</td>
      </tr>) : <tr><td colSpan={4}>No mapped Apple Ads apps yet.</td></tr>}</tbody>
    </table></div>

    <div className="section-head"><h2>Recent events</h2><span>Latest 25</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Received</th><th>App</th><th>State</th><th>Campaign</th><th>Ad group</th><th>Keyword</th></tr></thead>
      <tbody>{attribution.recentEvents.length ? attribution.recentEvents.map((event) => <tr key={event.id}>
        <td>{formatDate(event.receivedAt)}</td><td>{event.appName}</td><td>{event.attributionState ?? "-"}</td><td>{event.campaignId ?? "-"}</td><td>{event.adGroupId ?? "-"}</td><td>{event.keywordId ?? "-"}</td>
      </tr>) : <tr><td colSpan={6}>No attribution events have arrived yet.</td></tr>}</tbody>
    </table></div>
  </PageShell>;
}
