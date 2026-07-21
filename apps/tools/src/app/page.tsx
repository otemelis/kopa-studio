import { MetricCard } from "@/components/metric-card";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { loadOverview } from "@/services/overview-service";
import { loadAppStoreConnectStatus } from "@/services/appstore-connect-service";
import { requireUser } from "@/lib/auth";
import { listAppleAdsRecommendations } from "@/repositories/apple-ads-recommendation-repository";

export const dynamic = "force-dynamic";

function relativeDate(value: string | null) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No successful collection yet"; }
export default async function OverviewPage() {
  const user = await requireUser();
  const [{ metrics, recentRuns }, appStoreConnect, appleAdsRecommendations] = await Promise.all([loadOverview(), loadAppStoreConnectStatus(), listAppleAdsRecommendations(user.id)]);
  const openRecommendations = metrics.activeInsights + appleAdsRecommendations.length;
  const runBlockers = recentRuns.filter((run) => run.status === "failed" || run.status === "partial").map((run) => ({ id: run.id, source: run.provider, status: run.status, checkedAt: run.startedAt, result: run.error ?? `${run.succeeded} succeeded · ${run.failed} failed` }));
  const appStoreConnectBlockers = appStoreConnect.reportRequests.filter((request) => request.status === "error" || request.lastError).map((request, index) => ({ id: `asc:${index}`, source: `App Store Connect · ${request.appName}`, status: "failed", checkedAt: request.lastCheckedAt, result: request.lastError ?? "Report request is in an error state." }));
  const blockers = [...appStoreConnectBlockers, ...runBlockers].slice(0, 5);
  return <PageShell title="Dashboard"><section className="metric-grid"><MetricCard label="Tracked apps" value={metrics.appCount} detail="Existing ASO records" /><MetricCard label="Active keywords" value={metrics.activeKeywords} detail="Across all tracked apps" /><MetricCard label="Open recommendations" value={openRecommendations} detail="ASO, Apple Ads, and data-quality actions" /><MetricCard label="Data freshness" value={metrics.lastCollectionAt ? "Recorded" : "Waiting"} detail={relativeDate(metrics.lastCollectionAt)} /></section><div className="section-head"><h2>Needs attention</h2><span>{blockers.length ? "Current blockers" : "No current blockers from recent jobs"}</span></div>{blockers.length ? <div className="table-wrap"><table><thead><tr><th>Source</th><th>Status</th><th>Checked</th><th>Result</th></tr></thead><tbody>{blockers.map((blocker) => <tr key={blocker.id}><td>{blocker.source}</td><td><StatusBadge status={blocker.status} /></td><td>{relativeDate(blocker.checkedAt)}</td><td>{blocker.result}</td></tr>)}</tbody></table></div> : <div className="notice"><h2>No high-priority blockers detected</h2><p>Recent synchronization history does not include failed or partial runs.</p></div>}<div className="section-head"><h2>Recommended actions</h2><span>Current feed</span></div><div className="notice"><h2>{openRecommendations ? `${openRecommendations} open recommendations` : "No open recommendations"}</h2><p>Recommendations now live in Actions, with Apple Ads and ASO work consolidated into one operational feed.</p></div><details className="ops-panel"><summary>Recent data operations</summary><div className="table-wrap"><table><thead><tr><th>Provider</th><th>Status</th><th>Started</th><th>Processed</th><th>Results</th></tr></thead><tbody>{recentRuns.length ? recentRuns.map((run) => <tr key={run.id}><td>{run.provider}</td><td><StatusBadge status={run.status} /></td><td>{relativeDate(run.startedAt)}</td><td>{run.processed}</td><td>{run.succeeded} succeeded · {run.failed} failed</td></tr>) : <tr><td colSpan={5}>No collection runs have been recorded.</td></tr>}</tbody></table></div></details></PageShell>;
}
