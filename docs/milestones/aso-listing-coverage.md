# App Store listing and keyword coverage

## Decision and data contract

The four live apps already have public catalog metadata snapshots, but only in their primary US storefront. Those snapshots do not establish the current listing in DE or other tracked markets. The existing collector's iTunes Lookup response has name, description and screenshot URLs; it does not return the localized subtitle, App Store Connect keyword field, or preview videos. Tracked `aso_keywords` are Kopa's monitoring set, **not** proof that the terms are in Apple metadata.

The first slice adds an owner-only, read-only `/aso/listings` page using a fresh public Apple catalog lookup for the selected app and two-letter storefront. It never substitutes another market or an old snapshot after a failed lookup. Exact phrase matching categorizes tracked terms as **in app name**, **description only**, **not in visible copy**, or **listing unavailable**. The same status appears beside each keyword in ASO Progress for one selected market. A top-10 observation without a visible match is flagged for manual review; no organic-rank or causal claim is made from the catalog copy. Rank sources remain separate.

Read-only proof on 1 November 2026: Apple public lookup returned the exact catalog ID and screenshot URLs for InnerType (`6785764991`), LoveType (`6786477464`), POIS (`6820665225`) and PASSPORT (`6822753543`) in both US and DE. The same request must still be checked at page-open time; this proof does not establish the exact localized native iPhone presentation.

## Remaining milestones

1. **Current public view:** Verify each of the four app IDs in US and DE, inspect screenshot URLs and the matching states, check light/dark and failed-lookup behavior. Acceptance: no market fallback, exact app-ID validation, source/check time visible, and status agrees with returned name/description. No new service or database table.
2. **First-party metadata:** Use the existing App Store Connect credential only after a read-only API proof of the app's current live iOS version, `appInfoLocalizations` (name/subtitle), `appStoreVersionLocalizations` (description/keywords), and screenshot/preview relationships. Join by explicit Apple locale and version, not country alone; document Apple's locale fallback for each storefront. Acceptance: a displayed keyword-field match is traceable to Apple app ID, version ID, locale, field and fetch time. Keep unavailable when the API role or relationship blocks access. This is required before Kopa can label a term **optimized/targeted in metadata** rather than merely visible in public copy.
3. **Metadata-change comparisons:** Reuse existing metadata change events, and compare ranks/ASC acquisition before and after a verified release date, with Apple Ads activity kept separate. Acceptance: no inferred causality, no invented historical keyword-field values, and explicit report lag.

No new costs are required for the first slice. Apple may rate-limit the public catalog; the page makes one lookup when opened and does not run a scheduler. The first-party API step uses the existing Apple integration and requires no campaign or purchase. Production deployment of either slice remains subject to the roadmap's production approval gate.
