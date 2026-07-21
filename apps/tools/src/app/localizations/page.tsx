import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadStorefronts } from "@/services/storefront-service";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const answer = (value: boolean) => value ? "Yes" : "No";
const state = (value: string) => value === "localized" ? "Localized" : value === "english" ? "English" : "Unknown";
export default async function LocalizationsPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  await requireUser(); const { app: appId } = await searchParams; const [apps, storefronts] = await Promise.all([listApps(), loadStorefronts(appId)]);
  return <PageShell title="Markets"><form className="filter-form"><select name="app" defaultValue={appId ?? ""}><option value="">All tracked apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><button type="submit">Apply filters</button></form><div className="section-head"><h2>Market coverage</h2><span>{storefronts.length} markets with tracked signals</span></div><div className="table-wrap"><table><thead><tr><th>App</th><th>Market</th><th>Readiness</th><th>Metadata</th><th>Headlines</th><th>Screenshot UI</th><th>App language</th><th>Keywords</th><th>ASC data</th><th>Apple Ads</th></tr></thead><tbody>{storefronts.length ? storefronts.map((storefront) => <tr key={storefront.id}><td>{storefront.appName}</td><td>{storefront.country.toUpperCase()}{storefront.isPrimary ? " · Primary" : ""}</td><td>{storefront.readiness}</td><td>{answer(storefront.metadataLocalised)}</td><td>{answer(storefront.screenshotsLocalised)}</td><td>{state(storefront.screenshotUiState)}</td><td>{state(storefront.appLanguageState)}</td><td>{storefront.keywordsTracked}</td><td>{answer(storefront.hasAscData)}</td><td>{answer(storefront.appleAdsActive)}</td></tr>) : <tr><td colSpan={10}>No markets match this filter.</td></tr>}</tbody></table></div><p className="data-note">Screenshot UI and app-language states stay Unknown unless existing records support a stronger claim. Metadata alone is never treated as full localization.</p></PageShell>;
}
