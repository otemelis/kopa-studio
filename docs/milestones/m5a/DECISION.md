# M5a · Rank-source decision · 15 October 2026

**Daily Kopa history exists and is operational. Keep it, but label it iTunes catalog position.** A real AppFollow export now provides a separate, usable vendor-reported series. Neither source has been independently validated against synchronized native iPhone searches. Do not build an automated native organic-rank collector from the old worker.

## Actual deployed history

Read-only Supabase checks at 18:06 UTC (20:06 Berlin) found 22,368 rank snapshots and 5,535 search-result rows across 88 dates, 20 July–15 October. Today's `apple_public` cron completed at 17:37:33 UTC with 54 processed/succeeded and zero recorded failures. The ASO apps table contains only InnerType (Apple ID 6785764991), not POIS. All stored rank rows are labeled `public_store`/`ok`; that label does not independently prove valid source responses.

There are 131 tracked keywords; the inspected worker processes at most 50 per run. Germany has 10 owned-app keywords, with 30 observations in 9–15 October: daily counts **0, 6, 4, 10, 0, 0, 10**. Thus daily execution does not mean daily observations for each keyword. Older history contains 267 duplicate keyword/app/kind/date groups; none occurred from 17 September onward. No records were deleted or modified.

## AppFollow comparison — real supplied export

The user supplied `keywords_iphone_1792087452.csv`: InnerType: Persönlichkeitstest, Germany, iPhone, 9–15 October, 14 keywords/98 daily cells. Apple’s DE lookup for 6785764991 returns the same localized title and bundle `com.innertype.app`; export `App_id`/`ItemId` are vendor identifiers, not Apple IDs. Language, capture timezone, native depth and sponsored handling are unspecified in the export. Four export keywords have no matching Kopa tracked term in this DE slice.

Independent JavaScript and Python calculations reconcile every cell:

| Pair state | Cells |
|---|---:|
| Two numeric values agree | 2 |
| Two numeric values differ | 13 |
| AppFollow numeric rank; Kopa recorded not found | 10 |
| No Kopa observation | 68 |
| Kopa row exists; AppFollow has no numeric rank | 5 |
| Total | 98 |

Example: **charaktertest, 10 October: AppFollow 2, Kopa 74**; on 12 October: 6 versus 69. This demonstrates the series should not be interchanged; it does not prove which is synchronized native ground truth. Missing rows are not zero, and AppFollow dash/blank values stay nonnumeric. Paid search-download fields say upgrade required and remain unavailable.

Open **http://127.0.0.1:4340/keyword-evidence.html** for the read-only historical source comparison. Select any of the 14 terms to inspect its seven-day series, source gaps, depth and capture times. The page is a bounded evidence review, not a live rank tracker. The original file is unchanged; no paid API, database import, production collector or dashboard backend changed.

Reproduce: `node scripts/aso-feasibility/compare-appfollow.mjs /absolute/source.csv reporting/portfolio/keyword-evidence.json`. It validates the actual scope/header/rank tokens, unique keys and current-position control, retains the original file hash, and compares against the checked-in 30-row read-only extract. Regenerate that extract with the source-specific SELECT recorded in `VERIFY_HISTORY.sql` for another window; do not silently blend dates or methods.

## Why not reuse the old collector as native rank

The actual provider requests iTunes Search with country/`entity=software`/limit 100; no device or query language. It filters IDs before assigning position, caches for six hours and returns empty results for unexpected schema. The worker keeps only 25 result entries and uses same-day upserts. Three diagnostic tests reproduce schema-to-empty, shifted slots and cached bodies with explicit synthetic inputs and **zero external requests**. They diagnose unchanged legacy behavior, not fixes or real ranking observations.

[Apple Search API documentation](https://performance-partners.apple.com/search-api) documents catalog software search and limited response-language controls; it does not establish native iPhone organic-order equivalence. [Apple Media Services terms](https://www.apple.com/legal/internet-services/itunes/) restrict scraping and monitoring. No permitted native automated collection path was established. Consequently the planned 20-term POIS/DE three-run native pilot and contrast markets were **not executed**. Native/catalog agreement is unknown; the existing real AppFollow comparison is a different validation, not a substitute claim.

[AppFollow documents CSV/XLS export](https://support.appfollow.io/hc/en-us/articles/360021176638-Export-Keywords); validate actual file scope rather than assuming interface filters. [AppTweak history](https://developers.apptweak.com/reference/keyword-metrics-by-app-history) distinguishes raw `value`/`fetch_performed` from interpolated `effective_value`; no credits or new integration were used.

**Next:** keep the working comparison available, preserve legacy history as a proxy, and validate a POIS export/listing when available before any POIS tracker. Independently progress M6 by reconciling one official Apple Ads campaign/day export; existing stored campaign data alone is not a fresh provider control. PASSPORT replay protection remains a separate approval gate.
