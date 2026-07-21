import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { listApps } from "@/repositories/apps-repository";
import { loadInsights } from "@/services/insight-service";

export const dynamic = "force-dynamic";
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ app?: string; priority?: string }> }) {
  const filters = await searchParams; const [apps, insights] = await Promise.all([listApps(), loadInsights({ appId: filters.app, priority: filters.priority, limit: 100 })]);
  return <PageShell title="Insights"><form className="filter-form"><select name="app" defaultValue={filters.app ?? ""}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button type="submit">Apply filters</button></form><div className="section-head"><h2>Active rule-generated insights</h2><span>{insights.length} shown · no write actions migrated yet</span></div><section className="insight-list">{insights.length ? insights.map((insight) => <article className="insight-card" key={insight.id}><div><StatusBadge status={insight.priority} /><p className="insight-app">{insight.appName ?? "Portfolio"}</p></div><h2>{insight.title}</h2><p>{insight.observation}</p><p><strong>Next:</strong> {insight.recommendation}</p><footer>Confidence: {insight.confidence.replace("_", "-")} · Impact: {insight.impact} · Effort: {insight.effort}</footer></article>) : <div className="notice"><h2>No active insights</h2><p>The existing rule engine has not produced an active insight for this filter.</p></div>}</section></PageShell>;
}
