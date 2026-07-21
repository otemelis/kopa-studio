import { PageShell } from "@/components/page-shell";
import { ResearchPlanner } from "@/components/research-planner";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
export default async function ResearchPlannerPage(){await requireUser();const apps=await listApps();return <PageShell title="Research Planner"><section className="notice"><h2>Draft only</h2><p>This planner does not create, activate, or modify Apple Ads campaigns.</p></section><ResearchPlanner apps={apps.map(app=>({name:app.name,currency:null}))}/></PageShell>;}
