import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { requireUser } from "@/lib/auth";
import { AppCreateForm } from "@/components/app-create-form";

export const dynamic = "force-dynamic";

export default async function AppsPage() { await requireUser(); const apps = await listApps(); return <PageShell title="Apps"><div className="section-head"><h2>Tracked App Store records</h2><AppCreateForm /></div><div className="table-wrap"><table><thead><tr><th>App</th><th>Platform</th><th>Primary store</th><th>Rating</th><th>Updated</th></tr></thead><tbody>{apps.length ? apps.map((app) => <tr key={app.id}><td><Link href={`/apps/${app.id}`}>{app.name}</Link></td><td>{app.platform}</td><td>{app.primaryCountry.toUpperCase()}</td><td>{app.rating ?? "—"}{app.ratingCount ? ` (${app.ratingCount.toLocaleString()})` : ""}</td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(app.updatedAt))}</td></tr>) : <tr><td colSpan={5}>No tracked apps have been added yet.</td></tr>}</tbody></table></div></PageShell>; }
