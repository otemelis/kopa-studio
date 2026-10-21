import { PageShell } from "@/components/page-shell";
import { ExperimentManager, type ChangeLogDraft } from "@/components/experiment-manager";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
import { loadExperiments } from "@/services/experiment-service";

export const dynamic = "force-dynamic";
const changeTypes = new Set(["metadata", "screenshots", "app_icon", "price", "campaign_activated", "campaign_paused", "bid_changed", "localization_added", "app_version_released", "paywall", "onboarding"]);
const targetMetrics = new Set(["conversion", "downloads", "page_views", "impressions"]);
const short = (value: string | undefined, limit: number) => value?.trim().slice(0, limit) || undefined;

export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ app?: string; market?: string; status?: string; title?: string; description?: string; changeType?: string; targetMetric?: string; nextAction?: string }> }) {
  await requireUser();
  const { app, market, status, title, description, changeType, targetMetric, nextAction } = await searchParams;
  const [apps, changes] = await Promise.all([listApps(), loadExperiments({ appId: app })]);
  const appExists = Boolean(app && apps.some((item) => item.id === app));
  const draft: ChangeLogDraft | undefined = appExists && title ? {
    appId: app,
    title: short(title, 160),
    hypothesis: short(description, 1000),
    changeType: changeType && changeTypes.has(changeType) ? changeType : "metadata",
    country: market?.match(/^[a-z]{2}$|^all$/) ? market : "all",
    targetMetric: targetMetric && targetMetrics.has(targetMetric) ? targetMetric : "conversion",
    nextAction: short(nextAction, 1000),
  } : undefined;
  const filteredChanges = changes.filter((change) => {
    const marketMatches = !market || change.country === market;
    const statusMatches = !status || change.status === status;
    return marketMatches && statusMatches;
  });
  const markets = [...new Set(changes.map((change) => change.country))].sort();
  const statuses = [...new Set(changes.map((change) => change.status))].sort();

  return <PageShell title="Change Log">
    <section className="notice">
      <h2>Product and growth changes</h2>
      <p>Track metadata, screenshots, pricing, campaign, localization, release, onboarding, and paywall changes without requiring every entry to be a statistical experiment.</p>
    </section>
    <form className="filter-form">
      <select name="app" defaultValue={app ?? ""}><option value="">All apps</option>{apps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select name="market" defaultValue={market ?? ""}><option value="">All markets</option>{markets.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select>
      <select name="status" defaultValue={status ?? ""}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
      <button>Apply filters</button>
    </form>
    <ExperimentManager apps={apps.map((item) => ({ id: item.id, name: item.name }))} experiments={filteredChanges} draft={draft} />
  </PageShell>;
}
