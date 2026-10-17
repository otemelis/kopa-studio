# ASO-2 · Organic rank method gate

**Decision:** NO-GO for independent organic-rank collection
**Checked:** 17 October 2026
**Scope:** InnerType in Germany as the published test app; POIS remains unlisted for this test. Read-only research and existing evidence only.

## Decision

Kopa has no source that currently satisfies both the product requirement (geographically scoped, repeatable organic App Store position) and the evidence/permission gate. Organic rank remains **unavailable**. Do not convert iTunes Search array order or a human's native search position into an ongoing rank series under the current evidence.

This does not block the rest of the ASO engine. Apple Ads popularity and keyword suggestions are live, distinct measurements. App Store Connect's approved reports can supply aggregate discovery and acquisition data when Apple's report instances are generated. Neither is an organic keyword rank.

## Evidence reviewed

| Candidate | What is verified | Why it does not pass |
| --- | --- | --- |
| Legacy Kopa/iTunes Search | The collector queries the country-scoped public Search API; saved rows have been labeled catalog positions. Apple's docs describe a website search field, country, limited language options and ordered results. | Apple does not define result-array index as native organic rank or provide device, personalization, sponsored-position, or equivalent-search controls. The existing AppFollow comparison has only 15 numeric pairs: 2 match and 13 differ. There is no synchronized native ground truth. Commercial retention/use as a rank-monitoring metric is not established by the Search API page. |
| Repeated manual App Store searches | The previous roadmap proposed three observations on two terms with device, storefront, locale, OS, time and sponsored state recorded. | Apple's [current Media Services terms](https://www.apple.com/legal/internet-services/itunes/) say software, devices, automated processes, or similar/equivalent manual processes may not be used to scrape, copy, or perform measurement, analysis, or monitoring of any portion of the Services or Content. Repeated rank measurement falls within that wording on its face. No manual pilot was run. Obtain written Apple confirmation before reconsidering. |
| App Store Connect Analytics | Apple documents engagement/discovery, commerce and usage reports, including aggregate App Store search sources. | Reports do not provide exact organic query-to-app result positions. The App Store Search source includes Search Ads, so it is not a pure-organic keyword series. |
| Apple Ads Platform API v1 | ASO-1 proved live country/genre/week popularity rows and app-scoped keyword suggestions under the read-only account. | These are Apple popularity/suggestion measures; neither endpoint returns an app's organic position for a query. Keep their units and contracts separate. |
| Licensed ranking provider | A vendor could potentially license a useful source. The supplied AppFollow DE/iPhone file is a real but limited benchmark. | No current written terms, capped proposal, collection method, raw coverage, retention rights, or cost have been validated for independent in-house storage/use. The benchmark does not establish ground truth. |

The [Apple iTunes Search API documentation](https://performance-partners.apple.com/search-api) explicitly describes using search requests to populate a search field on a website and documents a country parameter, `lang` values `en_us` and `ja_jp`, and a result limit. It does not promise that the API array is the order shown by the native App Store. Apple's [website terms](https://www.apple.com/legal/internet-services/terms/site.html) separately restrict automated or similar manual acquisition/monitoring of Site content; the [Media Services terms](https://www.apple.com/legal/internet-services/itunes/) are the more directly relevant language for App Store Services and measurement. The conclusion here is deliberately conservative and is not legal advice.

Apple's [App Store Connect Analytics API](https://developer.apple.com/documentation/AppStoreConnectAPI/downloading-analytics-reports) documents aggregate discovery, commerce and usage report delivery, while Apple's [Apple Ads popularity endpoint](https://developer.apple.com/documentation/apple-ads-platform-api/query-app-search-term-popularity-data) documents relative term-popularity by country, genre and period. Neither documentation describes organic app position for a search term.

## Validation result

- Existing Kopa history remains preserved and must be labeled **iTunes Search catalog position**, never native organic rank.
- The supplied AppFollow comparison remains optional, source-attributed benchmark evidence. Its 98 cells reconcile as 2 equal numeric values, 13 differing numeric values, 10 vendor values with no Kopa result, 68 missing Kopa observations, and 5 nonnumeric vendor values. Only the 15 numeric pairs assess agreement, and no independent truth source is present.
- No new automated or manual App Store result collection was performed. No vendor purchase/API call, database change, dashboard, or production change was made.
- Permission for commercial use of retained iTunes Search ordering is **unresolved**, not granted by the documented website search use case.

## Reopen criteria and next milestone

Reopen ASO-2 only if Apple gives written permission or an authorized API for this measurement, or a licensed provider confirms in writing that its raw positions may be ingested, retained, and used for Kopa's independent product. Before implementation, validate a capped sample for exact market/device/locale scope, raw observations, organic versus sponsored results, out-of-depth versus failed/no-data, historical coverage, retention/redistribution rights, and total cost.

Proceed to ASO-3 with the existing App Store Connect extractor as approved daily reports become available. Keep organic rank unavailable until its own gate passes. Continue separately with Apple's popularity/suggestion data, first-party acquisition, and legacy catalog positions.
