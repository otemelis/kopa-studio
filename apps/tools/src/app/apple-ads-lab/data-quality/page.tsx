import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getAppleAdsDataQuality, type AppleAdsQualityCheck } from "@/repositories/apple-ads-sync-repository";

export const dynamic = "force-dynamic";

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: value.length > 10 ? "short" : undefined }).format(new Date(value)) : "-";
const qualityStatus = (status: AppleAdsQualityCheck["status"]) => status === "ready" ? "configured" : status === "attention" ? "error" : "waiting";

export default async function AppleAdsDataQualityPage() {
  const user = await requireUser();
  const quality = await getAppleAdsDataQuality(user.id);
  const blockers = quality.checks.filter((check) => check.status === "attention");
  const warnings = quality.checks.filter((check) => check.status === "waiting");

  return <PageShell title="Health">
    <section className="notice">
      <h2>Operational blockers</h2>
      <p>Only blockers and meaningful waiting states appear here. Successful sync history belongs in Jobs.</p>
    </section>

    <section className="metric-grid">
      <article className="metric-card"><p>Connections</p><strong>{quality.counts.connections}</strong><small>Apple Ads organizations</small></article>
      <article className="metric-card"><p>Campaigns</p><strong>{quality.counts.campaigns}</strong><small>{quality.counts.adGroups} ad groups</small></article>
      <article className="metric-card"><p>Keywords</p><strong>{quality.counts.keywords}</strong><small>{quality.counts.negativeKeywords} negatives</small></article>
      <article className="metric-card"><p>Freshness flags</p><strong>{quality.counts.staleKeywords + quality.counts.localizationReviewMarkets}</strong><small>{quality.counts.staleKeywords} stale keywords · {quality.counts.localizationReviewMarkets} localization reviews</small></article>
    </section>

    <div className="section-head"><h2>Needs attention</h2><span>{blockers.length ? "Blockers" : "No blockers"}</span></div>
    {blockers.length ? <div className="quality-list">
      {blockers.map((check) => <article className="quality-card" key={check.label}>
        <div><h2>{check.label}</h2><p>{check.detail}</p></div>
        <StatusBadge status={qualityStatus(check.status)} />
      </article>)}
    </div> : <section className="notice"><h2>No active blockers</h2><p>Apple Ads setup checks do not currently report a blocking error.</p></section>}

    <div className="section-head"><h2>Waiting states</h2><span>{warnings.length ? "Expected gaps" : "None"}</span></div>
    {warnings.length ? <div className="quality-list">{warnings.map((check) => <article className="quality-card" key={check.label}><div><h2>{check.label}</h2><p>{check.detail}</p></div><StatusBadge status={qualityStatus(check.status)} /></article>)}</div> : <section className="notice"><h2>No waiting states</h2><p>All evaluated checks are either ready or listed above as blockers.</p></section>}

    <div className="section-head"><h2>Latest timestamps</h2></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Signal</th><th>Latest value</th></tr></thead>
      <tbody>
        <tr><td>API access succeeded</td><td>{formatDate(quality.latest.apiSuccessAt)}</td></tr>
        <tr><td>Campaign sync</td><td>{formatDate(quality.latest.campaignSyncedAt)}</td></tr>
        <tr><td>Structure sync</td><td>{formatDate(quality.latest.structureSyncedAt)}</td></tr>
        <tr><td>Latest metric date</td><td>{quality.latest.metricDate ?? "-"}</td></tr>
        <tr><td>Metric sync</td><td>{formatDate(quality.latest.metricSyncedAt)}</td></tr>
        <tr><td>Keyword snapshot</td><td>{formatDate(quality.latest.keywordSnapshotAt)}</td></tr>
      </tbody>
    </table></div>

  </PageShell>;
}
