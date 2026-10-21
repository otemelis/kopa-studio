# ASO-3 · App Store Connect Analytics validation

**Checked:** 17 October 2026, 19:09 UTC
**Access:** existing App Store Connect reader key; GET-only; local private run directory
**Apps:** InnerType live report path; approved ONGOING requests for POIS, PASSPORT, and LoveType

## Result

The existing extractor and independent calculations validate the InnerType report path. The newly approved requests for POIS, PASSPORT, and LoveType have report catalogs but no daily instances yet, so their Analytics metrics remain **unavailable**, not zero. Apple says the first report request normally takes 1–2 days to generate; this check occurred on the request date, so it does not indicate a configuration failure. Continue polling only through the existing manual refresh after that generation window.

No app or dashboard code was changed. No report request or account configuration was changed, and no source data was published by this check.

## Live source check

Using `scripts/app-store/read-apple.mjs instances` at 19:09 UTC:

| App/report | Daily instances | Processing-date range | State |
| --- | ---: | --- | --- |
| InnerType · Discovery and Engagement | 36 | 12 Sep–17 Oct | Available |
| InnerType · App Downloads | 36 | 12 Sep–17 Oct | Available |
| InnerType · App Store Purchases | 8 | 21–24 Sep; 1–2 and 6–7 Oct | Sparse instances; no newer purchase report |
| POIS · each of the three reports | 0 | — | Awaiting generation |
| PASSPORT · each of the three reports | 0 | — | Awaiting generation |
| LoveType · each of the three reports | 0 | — | Awaiting generation |

The three report types checked were App Store Discovery and Engagement Standard, App Downloads Standard, and App Store Purchases Standard. A missing purchase instance is not evidence of a zero purchase day. InnerType purchases currently have no processing instance later than 7 October.

## Source-to-CSV verification

For a recent source sample, `read-apple.mjs download` retrieved InnerType discovery/download instances with processing dates 10–17 October. Apple supplied report rows for event dates 10–16 October. All 16 segment files passed Apple-reported size and MD5 checks, independent SHA-256 checks, decompression equivalence, and the exact InnerType Apple ID check (`6785764991`). The source aggregation for 10–16 October was:

| Metric | Value | Definition |
| --- | ---: | --- |
| Icon/list impressions | 512 | Discovery report `Counts` where `Event=Impression` |
| Product-page views | 30 | `Counts` where `Event=Page view` and `Page Type=Product page` |
| First-time downloads | 16 | Downloads report `Counts` where `Download Type=First-time download` |

On the overlapping dates in the accepted CSV, all six daily checks match exactly: 10 October was 72 impressions, 3 product-page views, and 3 first-time downloads; 11 October was 63, 1, and 1. These are aggregate report counts, not unique users or an ordered funnel.

The preserved 16 September–13 October four-app run also replays through the existing extractor into a temporary directory: 2,184 daily rows, 78 series, 1,204 values independently checked against source SQL, and 12 daily/weekly Sales control groups reconciled. All 78 series match their 28-day baseline; 420 cells remain explicitly `unavailable_analytics_pending_validation`. Dataset SHA-256: `1208228d5a2de7e0e4b7c9667bd589430a4806ff639accd1e9cea5c047b3753f`. Four ratio series reconcile from components; 38 additive series sum; 35 unavailable series remain unavailable; one zero-denominator ratio remains undefined. No fabricated values were substituted.

The earlier 28-day InnerType source reconciliation found Analytics purchase totals aligned to Apple Sales by product ID and territory, while Analytics first-time downloads did not equal Sales first-time app units. These report definitions and date-basis differences remain separate; no forced equality or transaction-level join is asserted.

In the validated 16 September–13 October snapshot, Analytics reports 57 first-time downloads and Sales reports 58 first-time app units. The Analytics date basis is UTC; downloaded Sales report dates use America/Los_Angeles. Purchase reports show 4 net purchase units and USD 20.73 estimated proceeds for this period; purchase units reconcile to Sales by product ID and territory. These remain Apple aggregates, not unique payers or transaction-ID verification.

## Validation and limits

- The latest four-app daily CSV passed the independent SQLite calculation and weekly Sales controls. It is a local snapshot, not a live metric feed.
- The recent 10–16 October InnerType sample was checked from fresh official report segments against the accepted CSV for 10–11 October. Days 12–16 are outside that accepted CSV period and are source-validated only; they were not added to the dashboard.
- POIS, PASSPORT, and LoveType have no generated daily report rows yet. Their 420 cells stay blank/unavailable. Do not infer production activity from report-request existence.
- Store reports provide aggregate discovery/download/purchase counts. They do not provide linked user-level journeys or organic-only search terms. Search source can include Search Ads; Apple Ads, downloads, first opens, in-app events, and proceeds must retain separate definitions.

Reproduce the latest saved four-app validation with the private run and existing scripts `analyse-report.py`, `daily-dataset.py`, and `verify-daily.py`; use the period recorded in that run (`2026-09-16` through `2026-10-13`). The published local snapshot manifest points to SHA-256 `1208228d5a2de7e0e4b7c9667bd589430a4806ff639accd1e9cea5c047b3753f`, and the referenced CSV's bytes match it. The latest live instance/segment evidence is in the local owner-only run folder `scripts/app-store/runs/aso3-check-20261017T190908Z/`; `segment-manifest.json` SHA-256 is `67470659ab40fed26e4ed58ffb72b7f16e824e85dfde4f5f0d6c76011ae11030`, and `analytics-availability.json` SHA-256 is `4bf0160a3454efd6a7c4fd6ef16e9b72550eec25e87fb5ab907f3cb4b5070313`. The approved app request IDs remain in `scripts/app-store/approved-analytics-requests.json`.

Apple's [Analytics Reports guide](https://developer.apple.com/documentation/appstoreconnectapi/downloading-analytics-reports) describes daily ONGOING generation and says a first request normally generates in 1–2 days. Apple's [report definitions](https://developer.apple.com/documentation/analytics-reports) remain authoritative for metric interpretation.

## Next step

After the initial generation window, run the existing `npm run reports:refresh` and inspect the nine report instance lists. If instances appear, extend the existing download/normalization path for those app IDs, preserve segment checksums and revision selection, then reconcile each app's daily report values before publishing. If they remain empty, retain unavailable states and check the App Store Connect request status; do not create another request or request a historical snapshot without separate approval.
