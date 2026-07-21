import { MetricCard } from "@/components/metric-card";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { loadOverview } from "@/services/overview-service";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function relativeDate(value: string | null) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No successful collection yet"; }
export default async function OverviewPage() {
  await requireUser();
  const { metrics, recentRuns } = await loadOverview();
  return <PageShell title="Overview"><section className="metric-grid"><MetricCard label="Tracked apps" value={metrics.appCount} detail="Existing ASO records" /><MetricCard label="Active keywords" value={metrics.activeKeywords} detail="Across all tracked apps" /><MetricCard label="Open insights" value={metrics.activeInsights} detail="Rule-generated recommendations" /><MetricCard label="Last collection" value={metrics.lastCollectionAt ? "Recorded" : "Waiting"} detail={relativeDate(metrics.lastCollectionAt)} /></section><div className="section-head"><h2>Recent collection runs</h2><span>Read-only migration view</span></div><div className="table-wrap"><table><thead><tr><th>Provider</th><th>Status</th><th>Started</th><th>Processed</th><th>Results</th></tr></thead><tbody>{recentRuns.length ? recentRuns.map((run) => <tr key={run.id}><td>{run.provider}</td><td><StatusBadge status={run.status} /></td><td>{relativeDate(run.startedAt)}</td><td>{run.processed}</td><td>{run.succeeded} succeeded · {run.failed} failed</td></tr>) : <tr><td colSpan={5}>No collection runs have been recorded.</td></tr>}</tbody></table></div></PageShell>;
}
