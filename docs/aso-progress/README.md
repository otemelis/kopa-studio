# ASO progress pilot

The Signal ASO console now has an **ASO progress** tab. It starts with InnerType, supports its configured storefronts, and keeps Apple web observations separate from the legacy `public_store` series (whose collector uses the iTunes Search API). Neither series is called a verified native ranking. The view aligns the recent comparison end date to the latest day common to App Store Search records and the accepted first-time-download snapshot.

The pilot keyword set lives in [`config/aso-monitoring.json`](../../config/aso-monitoring.json). It contains five already-tracked high-priority terms for each of the US and Germany. A term must also be linked and active in `aso_app_keywords`; the collector refuses to create a series for an untracked term.

First-time downloads come from the already validated `reporting/portfolio/daily-acquisition-monetization.csv` App Store Connect snapshot. The view uses only its `first_time_downloads` summary rows with a validated value or validated zero status, reports coverage days, and keeps the all-storefront scope explicit. Current snapshot data covers InnerType from 14 September through 11 October 2026 (extracted 15 October); it does not invent earlier or later dates. The app's live `aso_daily_metrics` Sales Units remain separately labeled because they are not first-time-only.

### Current source-to-view reconciliation

The view's recent comparison is aligned to the latest shared day in the Search table and accepted download snapshot: 11 October 2026. The displayed totals reconcile to those sources:

| Period | US Search impressions | US Search product-page views | All-storefront first-time downloads | All-storefront Search-attributed first-time downloads |
| --- | ---: | ---: | ---: | ---: |
| 28d · Aug 17–Sep 13 | 1,005 (28 dates reported) | 41 (17 dates reported) | Unavailable in the accepted daily snapshot | Unavailable |
| 7d · Sep 28–Oct 4 | 113 (7 dates reported) | 4 (2 dates reported) | 13 (7/7 dates reported) | 9 (7/7 dates reported) |
| 28d · Sep 14–Oct 11 | 1,263 (24 dates reported) | 53 (14 dates reported) | 54 (28/28 dates reported) | 45 (28/28 dates reported) |
| 7d · Oct 5–11 | 283 (7 dates reported) | 9 (4 dates reported) | 9 (7/7 dates reported) | 8 (7/7 dates reported) |

The 28-day acquisition windows are 17 Aug–13 Sep and 14 Sep–11 Oct; the 7-day windows are 28 Sep–4 Oct and 5–11 Oct. The first-time download snapshot has no earlier 28-day window, so the view leaves that comparison unavailable. Seven-day all-storefront downloads fell 13→9 (Search-attributed 9→8) while reported US Search impressions rose 113→283; Search page views rose 4→9 on the dates reported. The available signals are therefore mixed, not evidence that the metadata changes caused an improvement. Search impressions/page views are country-scoped and Search may include paid placement; first-time downloads are all-storefront counts attributed by Apple's report.

The existing daily Vercel cron continues to gather iTunes Search catalog order under its `public_store` source label. To collect an Apple web snapshot locally, set the existing server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a private environment file outside version control, then run:

```sh
node --env-file=/absolute/path/to/private.env scripts/aso/collect-web-progress.mjs
```

That command previews the result and does not write. Add `--write` to append source-tagged observations to the existing `aso_keyword_rank_snapshots` table:

```sh
node --env-file=/absolute/path/to/private.env scripts/aso/collect-web-progress.mjs --write
```

It uses the repository's already installed Playwright package from the earlier App Store web experiment. It makes ordinary anonymous storefront page requests, uses the configured country locale, and stops on a challenge. It marks only explicit ad labels as ads. Other displayed cards remain uncertain; an absent app means **not observed within the returned page depth**, never “unranked.” Each persisted row includes its capture timestamp, storefront keyword, source label, result depth, and collection status. No full competitor list is imported, and no AppFollow calls are made.

## Interpretation limits

- Apple web and iTunes Search positions are separate observations. Web cards without explicit ad labels are not proven organic, and iTunes ordering is catalog order, not device ranking.
- The progress comparison is descriptive. It compares source-specific rank movement with App Store Search impressions in adjacent 7- or 28-day periods; it does not claim a metadata change caused the movement.
- ASC rows that are absent stay missing in the chart. They are not filled with zero. Search-source counts may include paid placements; Apple Ads metrics are displayed separately when present.
- First-time downloads use the accepted official ASC daily report snapshot and are all-storefront totals; they are not installs or first opens. Ranking/Search country scope is displayed separately. The snapshot is not live and its extraction date is shown.
- The assessment is descriptive evidence, not causal attribution. It shows the exact rank source and date movement, App Store Search impressions/page views, and (when comparable) all-storefront first-time downloads with reported-day coverage. Search placements may include paid search; Apple Ads remains separate.
- POIS becomes available in the same view when its production app, keywords, ASC rows, and source snapshots exist. No POIS metrics are substituted or synthesized.

Run the pure comparison and rendering tests with `npm run test:aso`. This pilot is local code only; it does not deploy the page, schedule the browser collector, or change database schema or permissions. The browser collector preview requires the existing private server-side Supabase credentials to read the tracked keyword configuration; do not paste or commit them. A successful preview is local collection evidence; adding `--write` saves owned-app observations in the existing rank table under the distinct `apple_web_search` source label.
