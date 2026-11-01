# ASO locale keyword expansion — 1 November 2026

The accompanying CSV records 72 new tracking candidates. They were selected from the current public Apple App Store listings for LoveType (`6786477464`), PASSPORT (`6822753543`), and POIS (`6820665225`) using exact app-ID lookups in each country. These are plausible search phrases, **not measured demand, verified organic rankings, or proof that the private App Store Connect keyword field contains them**. The CSV's `search_locale` describes the query language, not a claim that the listing itself is localized.

| App | Market | Public listing observation | Tracking change |
| --- | --- | --- | ---: |
| LoveType | DE, FR | English title and description in both storefronts; German/French query tracking tests local demand while revealing a metadata localization opportunity | 10 each |
| LoveType | ES, BR, JP | Spanish, Brazilian Portuguese, and Japanese public copy; existing 8/8/7 tracked terms expanded to 12/12/11 | 4 each |
| PASSPORT | FR, ES | Localized title and description about visited countries, stamps and travel memories | 10 each |
| POIS | FR, ES | Localized title and description about posture reminders and compatible AirPods | 10 each |

The source is Apple's public iTunes Lookup response on 1 November 2026, scoped by exact app ID and country. It does not expose the private keyword field or reliably reproduce native App Store organic position. Terms such as *posture avec airpods* and *postura con airpods* are product-specific exploratory queries; a phrase is not asserted to be popular merely because it is relevant. No AppFollow credits were used.

The 72 candidates were activated in the existing `aso_keywords` and `aso_app_keywords` tables. A read-back confirmed 10 active terms each for the six new app/market combinations and 12, 12 and 11 active LoveType terms in ES, BR and JP. At activation, none of the 60 new-market terms had rank history; an empty position remains **not yet observed**, not unranked.

Collector capacity requires a separate production deployment. Before this change the five daily cron slots could process at most 240 distinct country/term queries. The live database now has 373 active app-keyword links but 360 distinct queries, because some are shared by apps. The prepared three additional daily slots would provide 8 × 48 = 384 query attempts per day. This is capacity, not a guarantee of successful observations: provider failures, incomplete web results and Vercel scheduling can still leave gaps. The collector's existing least-recently-collected selection and source-specific status should keep gaps visible. Do not describe the new locales as refreshed until collector rows are read back after deployment.

To verify after deployment: check all eight Vercel ranking cron entries, inspect `aso_sync_runs` for each slot, and reconcile distinct `(keyword_id, captured_on, source)` results and owned-app rank snapshots for every new country. Separate `itunes_catalog` from `apple_web_search`; neither is a verified native iPhone rank. Repeat after the next complete UTC day before claiming daily coverage.
