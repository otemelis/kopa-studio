import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { listRecentRuns } from "@/repositories/overview-repository";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CollectionPage() { await requireUser(); const runs = await listRecentRuns(); return <PageShell title="Data collection"><section className="notice"><h2>Legacy worker retained</h2><p>The existing Vercel collection function remains the source of truth. This new application reads its run history only; starting or retrying jobs will be migrated after the queue contract is documented and verified.</p></section><div className="section-head"><h2>Recent runs</h2><span>Existing aso_sync_runs data</span></div><div className="table-wrap"><table><thead><tr><th>Provider</th><th>Status</th><th>Trigger</th><th>Started</th><th>Errors</th></tr></thead><tbody>{runs.length ? runs.map((run) => <tr key={run.id}><td>{run.provider}</td><td><StatusBadge status={run.status} /></td><td>{run.trigger}</td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.startedAt))}</td><td>{run.error ?? (run.failed ? `${run.failed} item(s) failed` : "—")}</td></tr>) : <tr><td colSpan={5}>No runs recorded.</td></tr>}</tbody></table></div></PageShell>; }
