import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadKeywords } from "@/services/keyword-service";
import { requireUser } from "@/lib/auth";
import { KeywordManager } from "@/components/keyword-manager";

export const dynamic = "force-dynamic";
export default async function KeywordsPage({ searchParams }: { searchParams: Promise<{ app?: string; country?: string }> }) {
  await requireUser(); const filters = await searchParams; const [apps, rows] = await Promise.all([listApps(), loadKeywords({ appId: filters.app, country: filters.country, limit: 200 })]);
  const countries = [...new Set(rows.map((row) => row.country))].sort();
  return <PageShell title="Keywords"><form className="filter-form"><select name="app" defaultValue={filters.app ?? ""}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><select name="country" defaultValue={filters.country ?? ""}><option value="">All storefronts</option>{countries.map((country) => <option key={country} value={country}>{country.toUpperCase()}</option>)}</select><button type="submit">Apply filters</button></form><KeywordManager apps={apps.map((app) => ({ id: app.id, name: app.name }))} rows={rows} /><p className="data-note">Source: public App Store collection. The current view fetches at most 200 records.</p></PageShell>;
}
