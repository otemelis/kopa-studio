import { GlobalContextBar } from "@/components/global-context-bar";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
import { getOverview } from "@/repositories/overview-repository";

function relativeFreshness(value: string | null) {
  if (!value) return "No completed sync";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `Stale · ${Math.floor(hours / 24)} days ago`;
}

export async function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  const [user, apps, metrics] = await Promise.all([requireUser(), listApps(), getOverview()]);
  return <div className="app-shell"><Sidebar /><main><header className="page-header"><div><p className="eyebrow">Internal intelligence</p><h1>{title}</h1></div><div className="page-actions"><ThemeToggle /><p className="identity">{user.email}</p></div></header><GlobalContextBar apps={apps.map((app) => ({ id: app.id, name: app.name, primaryCountry: app.primaryCountry }))} dataFreshness={relativeFreshness(metrics.lastCollectionAt)} />{children}</main></div>;
}
