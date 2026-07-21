import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadStorefronts } from "@/services/storefront-service";

export const dynamic = "force-dynamic";
const answer = (value: boolean) => value ? "Yes" : "No";
export default async function LocalizationsPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const { app: appId } = await searchParams; const [apps, storefronts] = await Promise.all([listApps(), loadStorefronts(appId)]);
  return <PageShell title="Localizations"><form className="filter-form"><select name="app" defaultValue={appId ?? ""}><option value="">All tracked apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><button type="submit">Apply filters</button></form><div className="section-head"><h2>Storefront coverage</h2><span>{storefronts.length} configured markets</span></div><div className="table-wrap"><table><thead><tr><th>App</th><th>Storefront</th><th>Primary</th><th>Metadata localized</th><th>Screenshots localized</th><th>Notes</th></tr></thead><tbody>{storefronts.length ? storefronts.map((storefront) => <tr key={storefront.id}><td>{storefront.appName}</td><td>{storefront.country.toUpperCase()}</td><td>{answer(storefront.isPrimary)}</td><td>{answer(storefront.metadataLocalised)}</td><td>{answer(storefront.screenshotsLocalised)}</td><td>{storefront.notes ?? "—"}</td></tr>) : <tr><td colSpan={6}>No storefronts match this filter.</td></tr>}</tbody></table></div><p className="data-note">This records localization coverage already tracked by the legacy ASO workflow. Editing coverage remains in the legacy console.</p></PageShell>;
}
