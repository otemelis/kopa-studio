import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";

export async function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="app-shell"><Sidebar /><main><header className="page-header"><div><p className="eyebrow">Internal intelligence</p><h1>{title}</h1></div><p className="identity">{user.email}</p></header>{children}</main></div>;
}
