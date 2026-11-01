import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { listingCoverage, listingCoverageLabel } from "@/lib/aso/listing-coverage";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
import { getPublicListing, getTrackedListingKeywords } from "@/repositories/public-listing-repository";

export const dynamic = "force-dynamic";

type SearchParams = { app?: string; country?: string };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const filters = await searchParams;
  const apps = await listApps();
  const app = filters.app ? apps.find((item) => item.id === filters.app || item.storeAppId === filters.app) : apps.find((item) => /innertype/i.test(item.name)) ?? apps[0];
  if (!app) return <PageShell title="App Store listings"><p className="notice">{filters.app ? "Selected app not found." : "No tracked apps available."}</p></PageShell>;
  const country = /^[a-z]{2}$/i.test(filters.country ?? "") ? filters.country!.toLowerCase() : app.primaryCountry;
  const [listing, keywords] = await Promise.all([getPublicListing(app.storeAppId, country), getTrackedListingKeywords(app.id, country)]);
  const coverage = keywords.map((keyword) => ({ ...keyword, status: listingCoverage(keyword.term, listing) }));
  const inName = coverage.filter((keyword) => keyword.status === "name");
  const descriptionOnly = coverage.filter((keyword) => keyword.status === "description");
  const notVisible = coverage.filter((keyword) => keyword.status === "not_visible");

  return <PageShell title="App Store listings">
    <p className="data-note">Public iTunes catalog view for one storefront. This is a current lookup, not a native App Store screenshot or App Store Connect localization. Listing keywords, subtitle, preview videos and exact displayed locale are unavailable from this source.</p>
    <form className="aso-filter-bar" action="/aso/listings" method="get" aria-label="Listing filters">
      <label>App<select name="app" defaultValue={app.id}>{apps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Storefront<input name="country" defaultValue={country.toUpperCase()} maxLength={2} pattern="[A-Za-z]{2}" required /></label>
      <button type="submit">Check listing</button>
    </form>
    {listing ? <>
      <div className="section-head"><h2>{listing.name}</h2><span>{country.toUpperCase()} · checked {new Date(listing.checkedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</span></div>
      <section className="metric-grid">
        <article className="metric-card"><p>Exact phrase in name</p><strong>{inName.length}</strong><small>Of {coverage.length} tracked keywords in {country.toUpperCase()}</small></article>
        <article className="metric-card"><p>Description only</p><strong>{descriptionOnly.length}</strong><small>Visible mention; not evidence of search targeting</small></article>
        <article className="metric-card"><p>Not in visible copy</p><strong>{notVisible.length}</strong><small>Private keyword field remains unknown</small></article>
        <article className="metric-card"><p>Catalog version</p><strong>{listing.version ?? "Unavailable"}</strong><small>{listing.storeUrl ? <a href={listing.storeUrl} target="_blank" rel="noopener noreferrer">Open Apple listing ↗</a> : "Store link unavailable"}</small></article>
      </section>
      <div className="section-head"><h2>Listing copy</h2><span>Source: Apple public catalog lookup · {country.toUpperCase()}</span></div>
      <section className="notice"><h2>App name</h2><p>{listing.name}</p><h2 className="listing-subhead">Subtitle</h2><p>Unavailable from this source</p><h2 className="listing-subhead">Description</h2><p className="listing-description">{listing.description ?? "Unavailable from this source"}</p><h2 className="listing-subhead">App Store keyword field</h2><p>Unavailable from this source. A tracked keyword is not proof that it appears in Apple metadata.</p></section>
      <div className="section-head"><h2>Screenshots and previews</h2><span>{listing.screenshots.length} public screenshot URL(s)</span></div>
      {listing.screenshots.length ? <div className="listing-screenshots">{listing.screenshots.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open screenshot ${index + 1}`}>
        {/* Direct Apple image URLs avoid a new image-optimization cost for this small internal page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${listing.name} screenshot ${index + 1} in ${country.toUpperCase()} catalog response`} loading="lazy" />
      </a>)}</div> : <p className="notice">No screenshots were returned for this storefront. App preview videos are unavailable from this source.</p>}
      <p className="data-note">Screenshots are catalog URLs; the public lookup does not establish the exact native iPhone presentation or preview-video order.</p>
    </> : <p className="notice">The public catalog listing is unavailable for this app and storefront right now. Keyword coverage is unavailable; no other market or saved snapshot was substituted.</p>}
    <div className="section-head"><h2>Tracked keyword coverage</h2><span>Exact phrase matches only · no stemming or inferred targeting</span></div>
    <div className="table-wrap"><table><thead><tr><th>Keyword</th><th>Market</th><th>Visible-copy evidence</th></tr></thead><tbody>{coverage.length ? coverage.map((keyword) => <tr key={keyword.id}><td>{keyword.term}</td><td>{keyword.country.toUpperCase()}</td><td>{listingCoverageLabel(keyword.status)}</td></tr>) : <tr><td colSpan={3}>No tracked keywords in this storefront.</td></tr>}</tbody></table></div>
    <p className="data-note">A name match confirms visible wording only. “Not in visible copy” is a review opportunity, not proof that the app is unoptimized: Apple&apos;s private keyword field and localized subtitle have not been checked. <Link href={`/aso/progress?app=${app.id}&country=${country}`}>Compare observed ranking history ↗</Link></p>
  </PageShell>;
}
