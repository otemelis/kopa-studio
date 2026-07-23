# ASO collector reference

This document explains what the public ASO scraper collects when the Jobs page runs **Rerun keyword ranking scrape** or when the daily Vercel cron calls `/api/aso/collect`.

## Short version

One collector run refreshes:

- owned app public App Store metadata
- competitor public App Store metadata
- tracked keyword search results
- owned app keyword ranks
- competitor keyword ranks for competitors linked to those owned apps
- recent public reviews
- App Store Connect sales, when configured
- App Store Connect Discovery & Engagement storefront metrics, when a report request exists
- deterministic ASO insights based on the current data

The collector writes a run record to `aso_sync_runs`. If the run was requested from Tools, the request itself is tracked in `aso_jobs`.

## How a run starts

There are two production paths:

| Trigger | Path | What it means |
| --- | --- | --- |
| Daily schedule | Vercel cron calls `GET /api/aso/collect` on `www.kopa.studio` | Runs the retained legacy worker once per day. |
| Tools button | `tools.kopa.studio` inserts an `aso_jobs` row, then wakes `GET /api/aso/collect` | Lets an owner request the same worker from the Jobs page. |

The collector uses `CRON_SECRET` for server-to-server authorization and `aso_collection_locks` to prevent two collection runs from overlapping.

## What gets collected

### 1. Owned app metadata

For each tracked iOS app in `aso_apps`, the collector looks up the public App Store listing and updates the current app row.

Fields refreshed include:

- app name
- developer
- description
- icon URL
- category
- current version
- release notes
- rating and rating count
- price and currency
- store URL
- listed app languages
- screenshot URLs
- last store update timestamp, when available

Tables touched:

- `aso_apps`
- `aso_metadata_snapshots`
- `aso_metadata_change_events`

Snapshot behavior:

- The collector calculates a checksum from the listing fields.
- A new metadata snapshot is inserted only when the checksum changes.
- If a previous snapshot exists, changed fields are written as metadata change events.

### 2. Competitor metadata

For each competitor in `aso_competitors`, the collector looks up the public App Store listing.

Fields refreshed include:

- competitor name
- developer
- icon URL
- rating and rating count
- price
- current version
- release notes
- screenshot URLs

Tables touched:

- `aso_competitors`
- `aso_competitor_snapshots`
- `aso_metadata_change_events`

Snapshot behavior is the same checksum-based approach as owned app metadata. Competitor subtitle and description are not stored as active competitor fields in the current implementation.

### 3. Keyword search results

The collector searches the public App Store for tracked keywords.

Source rows:

- `aso_keywords`
- `aso_app_keywords`

Stored output:

- `aso_keyword_search_results`

For each keyword, it stores:

- keyword id
- capture timestamp
- capture date
- top search results, currently stored as the first 25 result entries
- result depth from the provider response
- checksum
- source: `public_store`

Important limit:

- One run processes at most **50 tracked keywords**.
- It chooses the least-recently-collected keywords first.
- If there are more than 50 tracked keywords, a single click is a partial sweep by design. Run it again, or wait for the next scheduled run, to continue through the remaining keywords.

### 4. Owned app keyword ranks

For each tracked keyword, the collector checks each owned app linked to that keyword through `aso_app_keywords`.

Stored output:

- `aso_keyword_rank_snapshots`

For owned apps, each rank snapshot stores:

- keyword id
- App Store app id
- `app_kind = owned`
- capture timestamp and capture date
- rank position, or not-found state
- result depth
- previous rank
- 7-day rank change
- 30-day rank change
- best rank
- checksum
- source: `public_store`

The rank snapshot key is idempotent for the same date, keyword, owned/competitor kind, and App Store app id.

### 5. Competitor keyword ranks

For every competitor attached to an owned app linked to the keyword, the collector also records the competitor's organic rank in the same search result set.

Stored output:

- `aso_keyword_rank_snapshots`

For competitors, each rank snapshot stores:

- keyword id
- competitor App Store app id
- `app_kind = competitor`
- capture timestamp and capture date
- rank position, or not-found state
- result depth
- checksum
- source: `public_store`

Current limitation:

- Competitor rows do not get derived `previous_rank`, `change_7d`, `change_30d`, or `best_rank` values. Those trend fields are currently calculated only for owned apps.

### 6. Recent public reviews

The collector attempts to sync recent public reviews for tracked apps.

Tables touched:

- `aso_reviews`
- review-related insight inputs

The review import is treated as a warning-level subtask. If review collection fails, the main run can still complete.

### 7. App Store Connect sales

When `APP_STORE_CONNECT_VENDOR_NUMBER` is configured, the collector downloads the latest daily Summary Sales report.

Tables touched:

- `aso_daily_metrics`
- `aso_platform_connections`

Stored values include downloads and, when available, proceeds/currency by app/date/country.

If Apple has no sales report yet, the collector treats that as no data rather than a broken integration.

If Apple returns sales rows but none match `aso_apps.store_app_id`, the sync response includes a small unmatched sample of Apple report app IDs/titles plus the Kopa tracked app IDs. This usually means the selected App Store Connect vendor number has sales rows for another app, while the currently tracked Kopa app has no matching sales row in the latest report.

The importer normalizes Apple's Summary Sales `End Date` into `YYYY-MM-DD` before writing `aso_daily_metrics`. If a row matches a tracked app but still cannot be imported, the sync response includes sample raw date/country values so the operator can see whether the report format changed again.

### 8. App Store Connect Discovery & Engagement

When at least one Discovery & Engagement report request exists in `aso_analytics_report_requests`, the collector attempts to import recent report segments.

Tables touched:

- `aso_analytics_report_requests`
- `aso_storefront_metrics`
- `aso_daily_metrics`

Stored values include:

- date
- country/territory
- event
- page type
- source type
- count
- unique count, when present
- daily aggregate impressions
- daily aggregate product page views

These reports can be delayed or absent on Apple's side. The collector preserves that state instead of inventing zeroes.

### 9. Deterministic insights

After collection, the worker runs the ASO insight rules.

Tables read include:

- apps
- storefronts
- daily metrics
- storefront metrics
- tracked keywords
- owned and competitor rank snapshots
- competitors
- metadata change events
- reviews and review classifications
- experiments
- sync runs
- existing insights
- alert preferences

Tables written:

- `aso_insights`

The rules are deterministic. They create new active recommendations only after filtering against existing insight dedupe keys and snooze state.

## What does not get collected

The public ASO collector does **not** currently collect or modify:

- Apple Ads campaign spend, bids, budgets, or live campaign settings
- Apple Ads account structure beyond the separate Apple Ads Jobs actions
- Android / Google Play data
- paid attribution beyond the separate Apple Ads attribution work
- every tracked keyword in one run when the account has more than 50 tracked keywords
- competitor rank trend fields such as 7-day and 30-day change

## Where to look in Tools

| Question | Tools area |
| --- | --- |
| Is a scrape queued or running? | Jobs |
| Did the worker actually run? | Jobs -> Recent jobs |
| Which keywords have latest rank snapshots? | Keyword Intelligence |
| How are competitor ranks looking? | Competitors |
| Did metadata change? | Experiments / Insights context currently; raw history is in Supabase |
| Did App Store Connect reports import? | Sources / App Store Connect |
| What recommendations were created? | Actions / Insights |

## Operational notes

- Jobs times are displayed in `Europe/Berlin` time in Tools.
- A queued Tools job lives in `aso_jobs`.
- A real worker execution lives in `aso_sync_runs`.
- The collector can safely be rerun, but repeated runs will still respect the 50-keyword-per-run cap.
- If Jobs says a scrape is queued for a long time, the worker wake path or daily cron should be checked first.
- If Jobs shows a completed run with fewer keywords than total tracked keywords, that is expected when the tracked keyword count is above 50.
