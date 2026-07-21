import { PageShell } from "@/components/page-shell";
import { ExperimentManager } from "@/components/experiment-manager";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
import { loadExperiments } from "@/services/experiment-service";

export const dynamic = "force-dynamic";
export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) { await requireUser(); const { app } = await searchParams; const [apps, experiments] = await Promise.all([listApps(), loadExperiments({ appId: app })]); return <PageShell title="Experiments"><form className="filter-form"><select name="app" defaultValue={app ?? ""}><option value="">All apps</option>{apps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button>Apply filters</button></form><ExperimentManager apps={apps.map((item) => ({ id: item.id, name: item.name }))} experiments={experiments} /></PageShell>; }
