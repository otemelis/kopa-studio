import { PageShell } from "@/components/page-shell";
import { QueueAppleAdsCampaignSync } from "@/components/queue-apple-ads-campaign-sync";
import { QueueCollectionButton } from "@/components/queue-collection-button";
import { RunAppleAdsStructureSync } from "@/components/run-apple-ads-structure-sync";
import { StatusBadge } from "@/components/status-badge";
import { SyncAppleAdsReports } from "@/components/sync-apple-ads-reports";
import { requireUser } from "@/lib/auth";
import { listAppleAdsConnections } from "@/repositories/apple-ads-repository";
import { getAppleAdsDataQuality } from "@/repositories/apple-ads-sync-repository";
import { listRecentRuns } from "@/repositories/overview-repository";

export const dynamic = "force-dynamic";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
const duration = (start: string, end: string | null) => {
  if (!end) return "-";
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
};

export default async function CollectionPage() {
  const user = await requireUser();
  const [runs, appleAds, connections] = await Promise.all([listRecentRuns(), getAppleAdsDataQuality(user.id), listAppleAdsConnections(user.id)]);
  const primaryConnection = connections[0] ?? null;
  const jobs = [
    ...runs.map((run) => ({
      id: run.id,
      started: run.startedAt,
      source: run.provider,
      job: run.trigger === "cron" ? "Scheduled public sync" : "Manual public sync",
      scope: "Public App Store",
      status: run.status,
      records: run.processed,
      duration: duration(run.startedAt, run.finishedAt),
      error: run.error ?? (run.failed ? `${run.failed} item(s) failed` : "-"),
    })),
    ...appleAds.runs.map((run) => ({
      id: run.id,
      started: run.createdAt,
      source: "Apple Ads",
      job: run.resourceType,
      scope: "Connected organization",
      status: run.status,
      records: run.rowsInserted,
      duration: "-",
      error: run.errorMessage ?? "-",
    })),
  ].sort((a, b) => Date.parse(b.started) - Date.parse(a.started));

  return <PageShell title="Jobs">
    <section className="notice">
      <h2>Synchronization queue</h2>
      <p>Run or queue source updates from one place. Long-running public collection still happens in the existing worker instead of inside the dashboard request.</p>
      <div className="job-actions">
        <QueueCollectionButton />
        {primaryConnection ? <QueueAppleAdsCampaignSync connectionId={primaryConnection.id} /> : null}
        {primaryConnection ? <RunAppleAdsStructureSync /> : null}
        {primaryConnection ? <SyncAppleAdsReports /> : null}
      </div>
    </section>

    <section className="metric-grid">
      <article className="metric-card"><p>Public jobs</p><strong>{runs.length}</strong><small>{runs[0] ? `Latest ${date(runs[0].startedAt)}` : "No public jobs"}</small></article>
      <article className="metric-card"><p>Apple Ads jobs</p><strong>{appleAds.runs.length}</strong><small>{appleAds.runs[0] ? `Latest ${date(appleAds.runs[0].createdAt)}` : "No Apple Ads jobs"}</small></article>
      <article className="metric-card"><p>Failures</p><strong>{jobs.filter((job) => job.status === "failed" || job.status === "partial").length}</strong><small>Failed or partial jobs</small></article>
      <article className="metric-card"><p>Records</p><strong>{jobs.reduce((total, job) => total + job.records, 0)}</strong><small>Rows processed/imported in visible history</small></article>
    </section>

    <div className="section-head"><h2>Recent jobs</h2><span>Public ASO and Apple Ads sync history</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Started</th><th>Source</th><th>Job</th><th>Scope</th><th>Status</th><th>Records</th><th>Duration</th><th>Error</th></tr></thead>
      <tbody>{jobs.length ? jobs.map((job) => <tr key={`${job.source}:${job.id}`}>
        <td>{date(job.started)}</td><td>{job.source}</td><td>{job.job}</td><td>{job.scope}</td><td><StatusBadge status={job.status} /></td><td>{job.records}</td><td>{job.duration}</td><td>{job.error}</td>
      </tr>) : <tr><td colSpan={8}>No jobs recorded.</td></tr>}</tbody>
    </table></div>
  </PageShell>;
}
