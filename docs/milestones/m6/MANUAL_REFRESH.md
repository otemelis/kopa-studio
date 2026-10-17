# Apple Ads manual refresh · 17 October 2026

**Local mechanism implemented and tested; fresh provider/full-window validation pending input.** The accepted dashboard snapshot has not changed. The owner-authenticated exporter still returns ERR_BLOCKED_BY_CLIENT in the in-app browser; Chrome automation is unavailable. No cookies, credentials, browser protections or provider permissions were changed. This is a manual saved-export workflow, not unattended live API access.

## Run

1. Open the existing owner exporter in your signed-in browser: https://tools.kopa.studio/api/apple-ads/reports/export. It defaults to the last 28 complete UTC days. Save its successful JSON response. On 17 October, the explicit window is 19 September–16 October: https://tools.kopa.studio/api/apple-ads/reports/export?start=2026-09-19&end=2026-10-16.
2. In Apple Ads, export the **Campaigns** table for exactly the same start/end dates, **UTC**, **EUR**, with the same three campaign IDs, including paused campaigns. Include Spend, Impressions, Taps, Total/Tap-Through/View-Through Installs, New Downloads and Redownloads, plus the report metadata and total row. Campaign lifetime dates are not the reporting period. Do not change campaigns. If account timezone/currency or inventory differs, retain that export and investigate rather than relabeling it.
3. From the Kopa development checkout:

```sh
npm run ads:refresh -- /absolute/path/export.json '/absolute/path/Campaigns.csv'
```

An additional same-scope subwindow CSV can follow. A matching **full-window** control is required to publish. The rolling 28-day window is calculated at execution time in UTC. Query timestamps from the future fail. Only supported InnerType/EUR/UTC source contracts are accepted; other apps must not be inferred from this export.

The command reuses existing extraction output, CSV parser, exact-decimal aggregation, snapshot generation and independent Python reconciliation. Both checks run in an isolated temporary directory before publication. The browser snapshot is atomically replaced last; existing page reads it without application-code edits or server restart. Its existing scope line retains API queried time separately from local imported time. Refreshing the page displays the accepted data. No UI code changed.

Failures leave the browser snapshot unchanged. They produce a command error, not synthetic/zero data or a successful refresh. The UI continues to show its original historical query/import timestamps. A successful import is still a saved snapshot, not a live feed. Raw source files stay at the supplied paths and should be retained to reproduce the result.

## Verification performed

- 16 regression tests pass, including staged JS/Python validation, exact sub-cent arithmetic, missing campaign rows, mismatched control preservation, check-only nonpublication, stale windows, missing full-window controls and future timestamps.
- Explicit synthetic integration fixtures run only in temporary test directories; never in the dashboard.
- Real historical export independently replayed: 28 observed rows, 56 unavailable campaign/day coverage rows, 347 impressions, 18 taps, 11 attributed installs, EUR 7.5740. All 33 API windows/four weekly comparison contracts pass; both historical console controls still reconcile. This does **not** create a new full-window console control or a fresh provider read. See refresh-replay-validation.json.
- Existing historical dashboard files remain unchanged. No production deployment, campaign action, database writes, new credentials, scheduler or framework.

For an offline historical replay without publication:

```sh
npm run ads:refresh -- --check-only /absolute/path/export11.json '/absolute/path/one-day.csv' '/absolute/path/four-day.csv'
```

The independent check reopens the original JSON/CSV with Python csv + Decimal, checks campaign/footer counts and cent-rounded spend, derived daily records, hash/query-time provenance, daily/weekly/whole-window aggregates and matched prior-week coverage.

## Limits and next step

Next: supply a fresh JSON and matching full-window Campaigns CSV, run the same command, retain the reconciliation result, and verify the existing page's displayed values and scope. Until then this milestone is incomplete. Even when the full-window export reconciles, absent campaign rows remain unavailable and inventory is the exporter's stored mapping, not a fresh account inventory. Network-attributed installs are not verified paying customers; no ROAS or channel-to-purchase link is created. Attribution revisions are compared honestly, not forced to match.
