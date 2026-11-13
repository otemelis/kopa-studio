import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { KeywordCompetitionView } from "@/components/keyword-competition-view";
import { requireUser } from "@/lib/auth";
import { observedPositions } from "@/lib/aso/keyword-competition";
import { canonicalRankSource, sourceLabel } from "@/lib/aso/progress";
import { listApps } from "@/repositories/apps-repository";
import { getKeywordCompetition } from "@/repositories/keyword-competition-repository";

export const dynamic = "force-dynamic";
type Params = { app?: string; keyword?: string; source?: string; days?: string };
const passportTerms = ["country counter", "countries visited", "visited countries", "travel passport", "passport stamps", "travel journal", "travel tracker", "digital passport", "US states visited", "flight log", "national parks tracker"];

export default async function KeywordCompetitionPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const filters = await searchParams;
  const apps = await listApps();
  const app = filters.app ? apps.find((item) => item.id === filters.app) : apps.find((item) => /passport/i.test(item.name));
  if (!app) return <PageShell title="Keyword competition"><p className="notice">Select a tracked app to inspect keyword competition.</p></PageShell>;
  const days = filters.days === "7" ? 7 : 28;
  const data = await getKeywordCompetition(app.id, filters.keyword, days);
  const sources = [...new Set(data.snapshots.map((row) => canonicalRankSource(row.source)))].sort();
  const source = filters.source && sources.includes(filters.source) ? filters.source : sources.includes("apple_web_search") ? "apple_web_search" : sources[0] ?? "";
  const observedApps = new Map<string, string>();
  for (const snapshot of data.snapshots.filter((item) => canonicalRankSource(item.source) === source)) {
    for (const result of snapshot.results ?? []) {
      if (result.store_app_id && result.explicit_ad !== true) observedApps.set(String(result.store_app_id), result.name?.split("\n")[0]?.trim() || `Apple app ${result.store_app_id}`);
    }
  }
  const tracked = [{ id: app.storeAppId, name: app.name, owned: true, tracked: true }, ...data.competitors.filter((item) => item.store_app_id && item.store_app_id !== app.storeAppId).map((item) => ({ id: item.store_app_id, name: item.name, owned: false, tracked: true }))];
  const trackedIds = new Set(tracked.map((item) => item.id));
  const series = [...tracked, ...[...observedApps].filter(([id]) => !trackedIds.has(id)).map(([id, name]) => ({ id, name, owned: false, tracked: false }))]
    .map((item) => ({ ...item, points: source ? observedPositions(data.snapshots, source, item.id) : [] }));
  const available = passportTerms.map((term) => ({ term, keywords: data.keywords.filter((item) => item.term.toLowerCase() === term.toLowerCase()) }));
  return <PageShell title="Keyword competition">
    <p className="identity">Compare your app with tracked competitors using stored search-result app IDs. No historical rows are created or changed.</p>
    <form className="aso-filter-bar" action="/competitors/keyword" method="get" aria-label="Keyword competition filters">
      <label>App<select name="app" defaultValue={app.id}>{apps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Keyword · market<select name="keyword" defaultValue={data.selected?.id ?? ""}>{data.keywords.map((item) => <option key={item.id} value={item.id}>{item.term} · {item.country.toUpperCase()}</option>)}</select></label>
      <label>Source<select name="source" defaultValue={source}>{sources.length ? sources.map((item) => <option key={item} value={item}>{sourceLabel(item)}</option>) : <option value="">No observations yet</option>}</select></label>
      <label>Period<select name="days" defaultValue={String(days)}><option value="7">7 days</option><option value="28">28 days</option></select></label>
      <button type="submit">Apply filters</button>
    </form>
    {data.selected && source ? <KeywordCompetitionView key={`${data.selected.id}:${source}:${days}`} series={series} source={sourceLabel(source)} keyword={`${data.selected.term} · ${data.selected.country.toUpperCase()}`} /> : <p className="notice">{data.selected ? "No stored search-result observations for this keyword and period." : "This keyword is not active for the selected app."}</p>}
    {/passport/i.test(app.name) ? <section className="panel keyword-coverage"><div className="panel-head"><div><h2>Requested PASSPORT terms</h2><p>Tracking varies by storefront. Untracked terms have no collection history.</p></div></div><div className="keyword-coverage-list">{available.map((item) => <div key={item.term}><strong>{item.term}</strong><span>{item.keywords.length ? item.keywords.map((keyword) => <Link key={keyword.id} href={`/competitors/keyword?app=${app.id}&keyword=${keyword.id}&days=${days}`}>{keyword.country.toUpperCase()}</Link>) : "Not tracked"}</span></div>)}</div></section> : null}
    <p className="rank-explorer-note"><Link href={`/competitors?app=${app.id}`}>← Competitor overview</Link></p>
  </PageShell>;
}
