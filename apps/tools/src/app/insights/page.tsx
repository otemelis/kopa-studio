import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadInsights } from "@/services/insight-service";
import { requireUser } from "@/lib/auth";
import { InsightManager } from "@/components/insight-manager";

export const dynamic = "force-dynamic";
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ app?: string; priority?: string }> }) {
  await requireUser(); const filters = await searchParams; const [apps, insights] = await Promise.all([listApps(), loadInsights({ appId: filters.app, priority: filters.priority, limit: 100 })]);
  return <PageShell title="Insights"><form className="filter-form"><select name="app" defaultValue={filters.app ?? ""}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button type="submit">Apply filters</button></form><InsightManager insights={insights} /></PageShell>;
}
