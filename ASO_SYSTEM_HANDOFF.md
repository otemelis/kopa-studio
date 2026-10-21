# Kopa ASO system handoff

This document is the working map for an agent adding an ad-management module that will later make decisions using ASO data.

## What exists today

Kopa ASO is an internal, iOS/App Store-focused intelligence system for the studio's own apps. It is not a multi-tenant SaaS product and it does **not** currently manage Apple Search Ads, bids, budgets, or campaigns.

The system has two deliberately separate surfaces:

```text
tools.kopa.studio (Next.js internal UI)
  -> server-side repositories/services/route handlers
  -> Supabase ASO tables

www.kopa.studio legacy deployment
  -> Vercel cron + api/aso/collect.js
  -> App Store public data / App Store Connect / Supabase
```

`tools.kopa.studio` is the management and reporting interface. The legacy collector remains the production data worker. Keeping those concerns separate is intentional and should remain true when ads are added.

## Access and security

- Authentication uses Supabase Auth cookies.
- Every protected Tools page validates the server session and then verifies that the user exists in `analytics_admins`.
- The current approved user maps to a code-level `owner` role. There is no organization or invitation system.
- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Supabase publishable key).
- `SUPABASE_SERVICE_ROLE_KEY`, App Store Connect private keys, and `CRON_SECRET` are server/worker-only. They must never be exposed through a `NEXT_PUBLIC_` variable, client bundle, response, log, or ads UI.
- Browser components do not query Supabase directly. New UI should call Next.js route handlers; handlers validate input and use server-side services/repositories.

## Core domain model

All ASO data is in the existing Supabase project. These tables are retained production data; do not rename, rebuild, or add blanket tenancy columns.

| Domain | Key tables | Meaning and useful joins |
| --- | --- | --- |
| App catalogue | `aso_apps`, `aso_app_storefronts` | One owned iOS app per `aso_apps.id`; `store_app_id` is the App Store identifier. This is the primary foreign key for a future ads module. |
| Keyword strategy | `aso_keywords`, `aso_keyword_groups`, `aso_app_keywords` | `aso_app_keywords` links an owned app to a tracked keyword and carries app-specific priority/status. Use this link, not raw keyword text, when associating ads decisions with ASO strategy. |
| Organic rankings | `aso_keyword_rank_snapshots`, `aso_keyword_search_results` | Historical rank per app/keyword/country plus raw search result sets. Snapshot dates/capture timestamps are the source for organic trend analysis. |
| Competitors | `aso_competitors`, `aso_competitor_snapshots` | A competitor belongs to an owned app (`app_id`) and has public-store history. It is suitable for context and share-of-voice-style analysis, not attribution. |
| Store listing | `aso_metadata_snapshots`, `aso_metadata_change_events` | Versioned metadata and detected changes: title/subtitle/description/screenshots/version/release notes/price. Useful as explanatory context when conversion or rank changes. |
| Performance | `aso_daily_metrics`, `aso_storefront_metrics` | App Store Connect-derived sales and storefront/discovery metrics. Treat metric definitions and availability as provider-specific; storefront data may be empty until reports are provisioned. |
| Reviews | `aso_reviews`, `aso_review_classifications` | Public review collection and classifications. Useful for insight context, not an ad conversion source. |
| Analysis | `aso_experiments`, `aso_insights` | Human-authored measurement records and deterministic ASO recommendations. Do not overwrite evidence/source fields when adding new workflows. |
| Operations | `aso_sync_runs`, `aso_sync_errors`, `aso_collection_locks`, `aso_jobs` | Collection execution history, errors, concurrency protection, and requested work. See the collection section below. |
| Provider state | `aso_platform_connections`, `aso_analytics_report_requests` | App Store Connect/report provisioning status. Keep private integration controls server-side. |

### Stable join keys for ads work

Use these joins as the initial cross-module contract:

```text
ads entity                         ASO entity
----------                         ----------
ads_app.app_id              ->    aso_apps.id
ads_keyword_target.app_keyword_id -> aso_app_keywords.id
ads_keyword_target.keyword_id     -> aso_keywords.id
ads_daily_metric.app_id            -> aso_apps.id
ads_daily_metric.country           -> ASO country/storefront code
ads_daily_metric.metric_date       -> ASO metric/snapshot day
```

Store `app_id`, ISO country/storefront, and a normalized calendar date on every daily ads metric. Store source-platform IDs (campaign/ad group/keyword IDs) separately from Kopa IDs. Do not join only by keyword text: spelling, country, and app-specific priority matter.

## Collection and freshness

The Vercel cron invokes `GET /api/aso/collect` on the legacy deployment once per day. Vercel authenticates it with `CRON_SECRET`.

For an operator-focused list of exactly what the scraper collects and which tables it updates, see `ASO_COLLECTOR_REFERENCE.md`. Tools does not duplicate App Store Connect private keys; owner-only Tools actions call the retained root integration server-to-server with `CRON_SECRET`.

The collector is intentionally idempotent:

1. Acquires the database collection lock.
2. Creates an `aso_sync_runs` row with `status = running`.
3. Refreshes owned-app public metadata and writes a metadata snapshot/change events only when the checksum changes.
4. Refreshes competitor metadata/snapshots with the same checksum behavior.
5. Searches and ranks tracked keywords for owned apps and competitors.
6. Collects public reviews, App Store Connect sales/report data where configured, and runs deterministic insight rules.
7. Writes counters/errors/summary to `aso_sync_runs` and releases the lock.

The public-store provider is rate-limited. To stay inside the Vercel function time budget, a run processes at most **50** tracked keywords, choosing least-recently-collected keywords first. With more than 50 keywords, freshness is a rotating sweep rather than an all-keywords-per-day guarantee. Ads decision logic must read the relevant capture timestamp and never assume every organic rank was refreshed today.

### Durable queued collection jobs

Tools can request a collection by inserting an `aso_jobs` row through its owner-only `/api/jobs` route. Only one queued/running collection job for the same broad scope is allowed. The legacy cron atomically claims the next queued job using `aso_claim_next_job()`, runs the collection, and records completion/failure plus the linked `aso_sync_runs.id`.

`aso_jobs` is a control plane, not the historical source of truth. Use:

- `aso_jobs` for requested work, progress, retry intent, and user-visible status.
- `aso_sync_runs` / `aso_sync_errors` for what the worker actually did and why a run failed.

Do not call the collector directly from a future ads UI. Queue an explicit job only when fresh ASO data is required and avoid duplicate active jobs.

## Current Tools capabilities

The internal app currently provides owner-only management for:

- tracked apps (Apple public lookup)
- keywords: create, edit, delete, country, priority, and status
- competitors (Apple public lookup)
- insight actions: complete, dismiss, snooze
- ASO experiments: create and edit context/timing/status/result/conclusion/next action
- read-only reporting: ranks, keyword strategy, competitor data, localization coverage, App Store Connect status, insights, collection history, storefront metrics, and contested terms
- queueing a collection request

The browser UI is deployed independently at `tools.kopa.studio`. The legacy hidden console remains a rollback/reference surface while the Next.js Tools app is the forward path.

## Recommended ads-module shape

Build ads as a separate bounded module, not as columns added across ASO tables. Suggested new tables (names are illustrative):

```text
ads_connections              provider credentials/status (server-only)
ads_campaigns                provider campaign identity and app_id
ads_ad_groups                provider grouping identity and campaign_id
ads_keyword_targets          provider keyword target + optional app_keyword_id
ads_daily_metrics            daily impressions, taps, spend, installs, CPT/CPA, etc.
ads_search_term_metrics      daily search-term performance, if the provider supplies it
ads_decisions                proposed/applied decision, evidence, status, audit trail
ads_sync_runs / ads_sync_errors   separate provider ingestion observability
```

Keep provider ingestion, credentials, rate limits, and retries separate from `api/aso/collect.js`. An ads worker may share generic patterns (service-role-only writes, run/error records, idempotent upserts, a durable queue), but should have its own provider connection and execution history.

### Decision-engine contract

An ad decision should be an auditable recommendation rather than an immediate mutation. A useful record contains:

- target: `app_id`, country, provider campaign/ad-group/keyword IDs
- proposed action: create/pause/adjust bid/adjust budget/negative keyword/etc.
- before value and proposed value
- explicit ASO evidence: rank snapshot IDs/dates, keyword priority, competitor context, metadata-event IDs, insight IDs, and/or performance metric IDs
- explicit ads evidence: spend, taps, installs, conversion metrics, and date window
- freshness timestamps for every source used
- lifecycle: `proposed`, `approved`, `applied`, `rejected`, `superseded`, `failed`
- actor/time/audit fields and provider response identifiers

The initial policy should be **read ASO + propose ads action**. Require owner approval before changing a provider. This prevents a stale organic-rank snapshot, incomplete keyword sweep, or unprovisioned Storefront report from autonomously changing spend.

Examples of safe first integrations:

- Surface a high-priority tracked keyword that has poor organic rank but acceptable ad conversion as a bid-review candidate.
- Flag a high-spend target when organic rank improved after a metadata change, while clearly showing the date ranges and avoiding causal claims.
- Use competitor/contested-term context to prioritize review, not to make automatic budget changes.
- Attach an `aso_experiments` record or metadata change event to an ads decision so outcomes can be evaluated later.

## Constraints and non-goals

- Apple Ads/Search Ads integration is intentionally not implemented yet.
- Do not invent campaign, bid, billing, organization, or public onboarding behavior inside the ASO module.
- ASO public-store rank data is observational, country-specific, and freshness-limited; it is not paid-attribution data.
- App Store Connect metrics can be delayed, missing, or not provisioned. Preserve raw provider state and do not silently substitute zeros for unavailable data.
- Keep data-source provenance and capture timestamps when deriving metrics or recommendations.

## Implementation conventions

- Next.js app: `apps/tools` (TypeScript, App Router, Tailwind/CSS).
- Server authorization: `apps/tools/src/lib/auth.ts`.
- Supabase environment validation: `apps/tools/src/lib/env.ts`.
- Legacy collector: `api/aso/collect.js` and `api/aso/_lib/*`.
- Supabase migrations: `supabase/migrations/`.
- Validate route inputs with Zod; keep write logic server-side.
- Run `npm run typecheck`, `npm test`, and `npm run build` in `apps/tools` before deployment.

## Handoff checklist for the ads agent

1. Read this file plus `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, and `api/aso/collect.js` before changing data flow.
2. Confirm the ad provider, exact metrics, attribution windows, countries, and desired approval policy before creating schema.
3. Add ads tables through an additive migration only; do not modify or backfill ASO history destructively.
4. Design provider sync as its own idempotent worker with its own runs/errors and rate-limit handling.
5. Start with reviewable decision records and UI; add provider write actions only after evidence, approval, rollback, and audit behavior are defined.
6. Preserve `tools.kopa.studio` authentication/owner checks and never send a server secret to the browser.
