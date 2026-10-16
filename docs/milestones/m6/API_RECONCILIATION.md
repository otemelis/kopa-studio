# Apple Ads daily slice — validated 16 October 2026

The owner-saved API response now validates successfully. The existing local page at http://127.0.0.1:4340/apple-ads.html shows the 28-day snapshot and each reported day in the approved Signal layout. It is a historical snapshot, not an automatic or live feed. No production database, ad configuration or campaign was changed in this step. The local page changes were not deployed.

## Observed data

Scope: **17 September–14 October 2026 inclusive, UTC, EUR**. Source queried **15 October 2026 at 19:25:52.895 UTC**. Source: existing owner-only Apple Ads legacy v5 report exporter. File SHA-256: `aaae3ad54ddb0ca26208d90e0fcb9ceb213af0501bcaccd08e377971bf0ed77b`.

| Measurement | Total of observed rows | Definition and validation |
|---|---:|---|
| Spend | EUR 7.5740 | Exact sum of API `spend` strings; displayed as EUR 7.57 only after aggregation. |
| Impressions | 347 | Sum of reported daily campaign impressions. |
| Taps | 18 | Sum of reported daily campaign taps. |
| Tap-through installs | 10 | Apple's `tapInstalls`; attribution events, not verified customers. |
| View-through installs | 1 | Apple's `viewInstalls`, retained separately. |
| Total attributed installs | 11 | `tapInstalls + viewInstalls`; do not add total to either component. |
| Attributed new downloads | 11 | API `newDownloads`, not App Store Connect first-time downloads. |
| Attributed redownloads | 0 | Explicit zeros in observed source rows. |
| Cost per total attributed install | EUR 0.69 displayed | Exact spend / 11, rounded to cents. Not cost per purchaser. |

All rows belong to InnerType (`appStoreId 6785764991`), campaign `2144366771`. There are **28 actual daily rows**. Two other mapped campaigns return no rows across this window. Their **56 campaign/day coverage records** in the derived CSV contain blank numeric/currency cells and `unavailable; no API row; not zero`. These coverage records are not synthetic activity or API-returned rows. Headlines are explicitly **totals of observed rows**, not independently verified account-wide totals. Current account inventory is not refreshed; additional/unmapped/deleted campaigns cannot be ruled out. No metrics are inferred for LoveType, POIS or PASSPORT.

## Independent controls

| Official console window | Impressions | Taps | Total attributed installs | API exact spend | Console spend | Result |
|---|---:|---:|---:|---:|---:|---|
| 11 October | 13 | 0 | 0 | EUR 0 | EUR 0.00 | Counts and money match exactly. |
| 11–14 October | 52 | 1 | 0 | EUR 0.4918 | EUR 0.49 | Counts match exactly; money matches at exported cent precision. |

Both console exports explicitly use UTC/EUR and the same three campaign IDs. Their campaign sums equal their footer totals; footers are excluded from campaign data. All available attribution/new-download/redownload components also match. The two empty API campaigns have explicit zeros in these console exports; those source-reported zeros remain available in the original CSV windows, but are not used to invent daily API zeros.

**The full 28-day total has no independent 28-day console export.** Its structure, exact arithmetic, daily coverage and displayed values are independently checked; the provided external controls cover the two windows above. Passing those controls does not certify every day's Apple attribution or account-wide completeness. The old stored excerpt contains a partial 12 October row with four impressions versus the new completed report's eleven; this is retained as incomplete older evidence, not forced to match or overwritten. Its original account timezone was not recorded. No current production database reconciliation is claimed in this step.

## Reproduction

From the Kopa development checkout:

```sh
node scripts/apple-ads-verification/publish-api.mjs /path/to/apple-ads-owner-export.json /path/to/apple-ads-day-source.csv /path/to/apple-ads-range-source.csv
python3 scripts/apple-ads-verification/reconcile-api.py /path/to/apple-ads-owner-export.json /path/to/apple-ads-day-source.csv /path/to/apple-ads-range-source.csv
node --test scripts/apple-ads-verification/*.test.mjs
```

The first command validates the saved file and both controls before publishing locally; it performs no network/database operations. It writes the derived daily CSV, validation evidence and existing page's snapshot JSON. The second uses independently implemented Python `csv`/`Decimal` checks: it verifies both footer controls, all 84 CSV coverage records, all 29 API page windows and exact-spend CPA rounding. JavaScript uses integer decimal arithmetic; amounts are never summed as binary floating-point numbers. Original files remain unchanged. Existing console-only publication is still available through `publish.mjs`; source modes are explicit and errors do not trigger fixture substitution.

Validation: **11 regression tests pass**, including duplicate/missing metrics, invalid scope/currency, attribution inconsistency, decimal precision, unavailable coverage and exact-before-rounded CPA. The independent Python reconciliation passes. Browser verification confirmed the 28-day dark view and 12 October light view; both show unavailable CPA with no installs and missing campaigns as not reported. The 28-day dark view was restored afterward. No redesign, framework, scheduling or production publication was introduced.

## Next step

This completes the bounded InnerType campaign/day demonstration, ready for owner review. Keep the operational limits explicit: saved manual export, legacy provider and stored campaign inventory. A matching full-window console export is the next reconciliation check if full 28-day external confirmation is needed; retain sub-cent amounts and historical revisions. Other ad channels wait until there is actual usage and source access. PASSPORT's existing retry/replay-contract approval gate remains the launch-critical roadmap blocker; this report does not authorize or change that collection contract.
