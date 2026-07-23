import { PageShell } from "@/components/page-shell";
import { AppStoreConnectSyncActions } from "@/components/app-store-connect-sync-actions";
import { QueueAppleAdsCampaignSync } from "@/components/queue-apple-ads-campaign-sync";
import { QueueCollectionButton } from "@/components/queue-collection-button";
import { RunAppleAdsStructureSync } from "@/components/run-apple-ads-structure-sync";
import { StatusBadge } from "@/components/status-badge";
import { SyncAppleAdsReports } from "@/components/sync-apple-ads-reports";
import { requireUser } from "@/lib/auth";
import { listAppleAdsConnections } from "@/repositories/apple-ads-repository";
import { getAppleAdsDataQuality } from "@/repositories/apple-ads-sync-repository";
import { listRecentCollectionJobs, listRecentRuns } from "@/repositories/overview-repository";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type SyncStep = {
  number: string;
  title: string;
  source: string;
  when: string;
  result: string;
  action: ReactNode;
};

const berlinDateTime = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "Europe/Berlin",
  timeZoneName: "short",
  year: "numeric",
});
const date = (value: string | null) => value ? berlinDateTime.format(new Date(value)) : "-";
const duration = (start: string, end: string | null) => {
  if (!end) return "-";
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
};

export default async function CollectionPage() {
  const user = await requireUser();
  const [runs, queuedJobs, appleAds, connections] = await Promise.all([listRecentRuns(), listRecentCollectionJobs(), getAppleAdsDataQuality(user.id), listAppleAdsConnections(user.id)]);
  const primaryConnection = connections[0] ?? null;
  const activeCollectionJobs = queuedJobs.filter((job) => job.status === "queued" || job.status === "running");
  const jobs = [
    ...queuedJobs.map((job) => ({
      id: job.id,
      started: job.createdAt,
      source: "Public App Store",
      job: job.status === "queued" ? "Queued keyword ranking scrape" : job.status === "running" ? "Running keyword ranking scrape" : "Keyword ranking scrape request",
      scope: "Queue",
      status: job.status,
      records: job.progress,
      duration: job.startedAt ? duration(job.startedAt, job.completedAt) : "-",
      error: job.errorMessage ?? "-",
    })),
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
  const syncSteps: SyncStep[] = [
    {
      number: "1",
      title: "Keyword rankings",
      source: "Public App Store",
      when: "Use when keyword ranks, metadata, competitors, or reviews are stale.",
      result: "Queues the background collector. The worker refreshes tracked keyword positions and public store data.",
      action: <QueueCollectionButton />,
    },
    {
      number: "2",
      title: "Discovery and sales reports",
      source: "App Store Connect",
      when: "Use after an App Store Connect alert, parser fix, or missing storefront metrics.",
      result: "Imports Apple's Discovery & Engagement report, then sales if a sales report is available.",
      action: <AppStoreConnectSyncActions />,
    },
    {
      number: "3",
      title: "Campaign structure",
      source: "Apple Ads",
      when: primaryConnection ? "Use after connecting a new Apple Ads organization or changing campaigns in Apple." : "Connect an Apple Ads organization before importing structure.",
      result: "Imports campaigns, ad groups, keywords, and negative keywords.",
      action: primaryConnection ? <RunAppleAdsStructureSync /> : <span className="sync-disabled">No Apple Ads connection</span>,
    },
    {
      number: "4",
      title: "Campaign performance",
      source: "Apple Ads",
      when: primaryConnection ? "Use after campaign structure is current, or when spend/search-term data looks stale." : "Connect an Apple Ads organization before importing performance.",
      result: "Queues or imports campaign metrics, search terms, and recommendations.",
      action: primaryConnection ? <><QueueAppleAdsCampaignSync connectionId={primaryConnection.id} /><SyncAppleAdsReports /></> : <span className="sync-disabled">No Apple Ads connection</span>,
    },
  ];

  return <PageShell title="Jobs">
    <section className="notice">
      <h2>Sync runbook</h2>
      <p>Run source updates from top to bottom when several things look stale. Keyword scraping is the first button; App Store Connect report retries are separate from Apple Ads imports. Times are shown in Central European time, currently Europe/Berlin.</p>
    </section>

    {activeCollectionJobs.length ? <section className="queue-alert">
      <div><h2>Keyword scrape already in the queue</h2><p>A new keyword scrape cannot be queued until this active job finishes or fails. Use the first runbook button to nudge a queued job.</p></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Status</th><th>Queued</th><th>Started</th><th>Progress</th><th>Details</th></tr></thead>
        <tbody>{activeCollectionJobs.map((job) => <tr key={job.id}><td><StatusBadge status={job.status} /></td><td>{date(job.createdAt)}</td><td>{date(job.startedAt)}</td><td>{job.progress}%</td><td>{job.errorMessage ?? (job.status === "queued" ? "Waiting for the collector worker" : "Collector worker is running")}</td></tr>)}</tbody>
      </table></div>
    </section> : null}

    <section className="sync-runbook">
      {syncSteps.map((step) => <article className="sync-step" key={step.number}>
        <div className="sync-step-head"><span>{step.number}</span><div><p>{step.source}</p><h2>{step.title}</h2></div></div>
        <p>{step.when}</p>
        <small>{step.result}</small>
        <div className="sync-step-actions">{step.action}</div>
      </article>)}
    </section>

    <section className="metric-grid">
      <article className="metric-card"><p>Public jobs</p><strong>{runs.length}</strong><small>{runs[0] ? `Latest ${date(runs[0].startedAt)}` : "No public jobs"}</small></article>
      <article className="metric-card"><p>Apple Ads jobs</p><strong>{appleAds.runs.length}</strong><small>{appleAds.runs[0] ? `Latest ${date(appleAds.runs[0].createdAt)}` : "No Apple Ads jobs"}</small></article>
      <article className="metric-card"><p>Failures</p><strong>{jobs.filter((job) => job.status === "failed" || job.status === "partial").length}</strong><small>Failed or partial jobs</small></article>
      <article className="metric-card"><p>Records</p><strong>{jobs.reduce((total, job) => total + job.records, 0)}</strong><small>Rows processed/imported in visible history</small></article>
    </section>

    <div className="section-head"><h2>Recent jobs</h2><span>Queue requests and sync history · Europe/Berlin</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Started</th><th>Source</th><th>Job</th><th>Scope</th><th>Status</th><th>Records</th><th>Duration</th><th>Error</th></tr></thead>
      <tbody>{jobs.length ? jobs.map((job) => <tr key={`${job.source}:${job.id}`}>
        <td>{date(job.started)}</td><td>{job.source}</td><td>{job.job}</td><td>{job.scope}</td><td><StatusBadge status={job.status} /></td><td>{job.records}</td><td>{job.duration}</td><td>{job.error}</td>
      </tr>) : <tr><td colSpan={8}>No jobs recorded.</td></tr>}</tbody>
    </table></div>
  </PageShell>;
}
