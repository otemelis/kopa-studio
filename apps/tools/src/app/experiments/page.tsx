import { PageShell } from "@/components/page-shell";
import { ExperimentManager } from "@/components/experiment-manager";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
import { loadExperiments } from "@/services/experiment-service";

export const dynamic = "force-dynamic";
export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ app?: string; market?: string; status?: string }> }) {
  await requireUser();
  const { app, market, status } = await searchParams;
  const [apps, changes] = await Promise.all([listApps(), loadExperiments({ appId: app })]);
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
    <ExperimentManager apps={apps.map((item) => ({ id: item.id, name: item.name }))} experiments={filteredChanges} />
  </PageShell>;
}
