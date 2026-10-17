# Independent ASO intelligence roadmap

**Prepared:** 17 October 2026
**Scope:** POIS first, with published InnerType as the live App Store test app.
**Product direction:** Kopa owns its ASO source contracts and history. AppFollow imports are optional comparison evidence and never a runtime requirement.

## Feasibility findings

### Current Kopa implementation

- The active development branch is `codex/kopa-milestones-2026-10-15`. At audit start, the dirty files were the App Store portfolio refresh snapshot/status and its generated CSV; those are unrelated and must stay untouched.
- Kopa already has useful App Store Connect report extraction and metric contracts in `scripts/app-store/`, including source-labeled Discovery and Engagement, downloads, purchases, and proceeds. The ongoing Apple Analytics requests for POIS, PASSPORT, and LoveType were approved and created; report instances are still pending. Keep the existing extractor and completeness checks.
- The migration-defined Supabase ASO schema has owner-controlled tables: `aso_apps`, `aso_keywords`, `aso_app_keywords`, `aso_keyword_rank_snapshots`, `aso_keyword_search_results`, `aso_daily_metrics`, and `aso_storefront_metrics`. Existing rank facts carry country through the keyword, `captured_at`, nullable `rank`, `found`, `result_depth`, checksum, status, and a broad source label. They do not record a robust provider method/version, device/locale context, source attempt, or source-specific observation contract. There is no dedicated Apple keyword-popularity/suggestion fact table. This is a repository migration audit, not a fresh live database inventory.
- The old collector calls Apple's public iTunes Search endpoint with `country`, `entity=software`, and `limit=100`; it has no device or meaningful locale parameter, retains only the first 25 mapped results, caches responses for six hours, and treats returned-array order as rank. Same-day rows can be overwritten. The existing decision records 22,368 rank snapshots over 88 dates and a 98-cell comparison with AppFollow (2 equal, 13 unequal, 10 vendor-ranked/Kopa-not-found, 68 missing, 5 vendor nonnumeric). Neither source was synchronized against native iPhone searches.
- The existing Apple Ads adapter is the legacy `/api/v5` campaign/report integration at `api.searchads.apple.com`. It uses the existing server-side OAuth client credential pattern and is already used for read-only paid reporting. The new Insights/Suggestions API is a separate `/v1` surface at `api.ads.apple.com`; do not relabel the legacy adapter or change its working page as part of the ASO proof.
- The checked local development worktree has no Apple Ads credential environment file or key. The deployed owner-only report page has protected credentials, but no endpoint currently exposes the new Insights/Suggestions methods. Therefore this review verifies the published API contract, not live account access or real endpoint responses. POIS is submitted for review in the project status; this audit did not verify a public POIS listing, so InnerType is the published app for the first live endpoint check.

### What Apple's API can establish

Apple documents `POST /v1/insights/apps/search-term-popularity/query`. The request scopes by App Store country/region and App Store genre, and supports `WEEKLY_SUN_SAT` or `MONTHLY` periods. Responses include the period, country, genre, term, and requested popularity fields: `rankInGenre`, `searchPopularityInGenre` (1–100), `searchPopularity1to100` (1–100), and/or `searchPopularity1to5` (1–5). These are relative popularity/rank-by-search-volume measures, not absolute search counts, app rank, downloads, or organic visibility. Weekly/monthly periods make genuine historical observations technically queryable; Apple does not document the maximum historical lookback in the material reviewed, so retention and old-period behavior remain to be proven with the account.

Apple also documents `POST /v1/suggestions/keywords/query`, scoped by a promoted App Store app ID and optionally country/region and seed terms. Its suggestion rows carry a relative `popularity` score. The endpoint is described as stateless discovery: it supplies a current suggestion result, not a time series. Do not combine its score with `searchPopularityInGenre` or `searchPopularity1to100` just because scales look similar.

Both endpoints are under the Apple Ads Platform API and require an authenticated bearer token and `X-AP-Context` for the ad account. Apple's OAuth instructions describe a designated API user, generated key pair/public key, client secret, OAuth client-credentials token and `searchadsorg` scope. Apple lists **API Account Read Only** and **Limited Access / API Read Only** roles that can view reporting. The actual role assigned to Kopa's existing account and its access to these two endpoints have not been checked live.

The published request schemas do not contain a campaign ID for either endpoint. Keyword suggestions require the app's Apple ID (`promotedObjectId`) but not a campaign ID; popularity requests filter by country/genre and period and do not require a promoted app ID in the documented request. Apple does not state in the endpoint references reviewed that a running campaign is a prerequisite. That is a strong feasibility signal, not proof of entitlement: verify with a read-only request against the existing account. Do not create or enable a campaign to test access.

Apple's public iTunes Search API is documented for website catalog search and lookup, supports a country and a 1–200 result limit, and describes response order as an ordered result list. Its documentation does not promise equivalence to organic ordering in the native App Store. The prior Kopa audit also found no device, locale, account-personalization, or sponsored-placement controls in its request. Apple's Apple Ads Impression Share API returns paid share and paid impression-share rank; it is not an organic-rank substitute.

App Store Connect Analytics can provide first-party App Store impressions, page views, source types, territories and counts, plus download and commerce reports. Its source types include App Store Search, which explicitly includes Search Ads, so it cannot isolate organic search. The reports do not expose the exact organic query-to-app rank. Data is privacy-filtered, delayed, and subject to correction; keep Apple's aggregate units and definitions intact.

### Organic ranking conclusion

No official Apple endpoint found in this audit returns an app's organic keyword position in native App Store results. iTunes Search API order is a catalog-search position only. Automated collection from the App Store website or native application has no approved collection/legal basis established by the prior audit, and this review did not find a documented Apple ranking endpoint. Do not implement a scraper, CAPTCHA/protection bypass, or “rank 101” sentinel.

Independent organic rank is therefore **not yet feasible as a defensible in-house measurement**. A synchronized manual native-storefront check can serve as a small, explicitly manual sanity observation if the owner supplies a suitable device/account/storefront state; it is not a scalable ranking feed. A licensed rank provider can be used as an optional, source-attributed benchmark only after its market/device methodology, missingness rules, retention/export rights, and total plan/API cost are confirmed. If neither route passes, organic position stays unavailable while Kopa proceeds with Apple popularity, App Store Connect acquisition and paid Apple Ads evidence.

The live App Store web search URL for InnerType in the Germany path returned Apple's “page can't be found” state in this review, so no storefront rank was inferred from that browser attempt. A real native App Store search comparison remains unperformed.

## Milestones

Cost policy: reuse current Apple, Supabase and Kopa accounts. This roadmap introduces no paid provider or recurring service. Apple documentation reviewed does not state a per-request charge for these read endpoints; verify any account-specific commercial terms before implementation. No credits or AppFollow keyword calls are required. Any vendor rank trial must have a user-approved written cap before use.

### ASO-0 — Correct source semantics and preserve the baseline

**Status: Done as an audit; implementation is included in the first code milestone.**

Keep historical rows and exact hashes. Change labels and claims at the read boundary so legacy `public_store` positions are described as **iTunes Search catalog positions** (method confidence limited by their saved source metadata), never organic rank. Do not delete, transform, or silently reprocess historical values. Keep the optional AppFollow comparison separate.

**Acceptance:** existing historical page explains method/date/depth and gaps; reports distinguish historical catalog positions from unavailable organic ranks; unrelated App Store refresh changes are preserved.

**Cost:** $0.
**Risk:** historic data has incomplete request provenance; relabel conservatively and retain original rows.

### ASO-1 — Apple Ads Platform v1 read-only proof

Add a narrow server-side adapter for only the keyword-suggestions and search-term-popularity query endpoints. Reuse the current credential store only if the existing read-only account and OAuth client are accepted by v1. Keep v5 campaign reporting unchanged. Initial request set: a bounded current DE query for the live InnerType app, plus one recent weekly and one older documented week for the matching App Store genre; request all useful popularity fields and a small page size. Add one bounded POIS term query only after its genre and app/storefront mapping are verified. Test one no-campaign test context only if such an account is already available; never create, pause, or spend on a campaign.

Capture sanitized request scope, API version, request/response timestamps, response status, pagination and raw-response hash. Never save OAuth secrets or tokens in fixtures/logs. Treat empty, rejected, partial and valid-populated results separately.

**Acceptance:** real HTTP responses prove access with the current account; response rows reconcile to exact requested country, genre and week; at least one historical period returns Apple rows; scores are stored with original names/scales; keyword suggestions match the requested app ID/country; no campaign create/update or spend operation is made. If denied, record exact status/error and the single required role/account action.

**Cost:** $0 planned incremental spend; bounded API calls under existing account.
**Risks:** role/account eligibility, unspecified historical lookback, endpoint/version changes, relative scores easy to mislabel.
**Unresolved dependency:** credentials exist only in protected deployed configuration per current evidence; local live proof needs an approved safe execution path using those credentials or an owner-provided path to the already-authorized private key. Do not fetch or expose production secrets to a local workspace.

### ASO-2 — Organic-rank method gate

Do not start a collector until one independent method is permitted and observable. First run a bounded live storefront comparison for InnerType in Germany using manually controlled App Store searches, with the exact keyword, storefront, device class, locale, OS version, timestamp, app listing ID, visible rank and sponsorship state recorded by a human. Compare only with iTunes catalog order as a separate candidate. Repeat three times on at least two terms to assess repeatability; do not infer a universal correlation from the pilot. For POIS, identify the actual searchable listing only after Apple publishes it.

If a licensed API is considered, request only one written, capped sample for DE/iPhone and the chosen terms. Verify raw observed positions, query coverage, device/locale controls, organic-vs-sponsored handling, out-of-depth vs failed/no-data, lookback, redistribution/retention rights, and total cost. AppFollow MCP/exports remain optional benchmarks; they do not satisfy the in-house source gate.

**Acceptance:** either a method passes the repeatability, source-scope, permission, terms, and retention checks and receives a bounded implementation decision; or the result is a documented **NO-GO** with organic rank unavailable. No crawler, vendor purchase, or automated web collection before this gate passes.

**Cost:** $0 for a manual test; a licensed provider is an unpriced dependency and requires an explicit spend cap.
**Risks:** personalization, storefront drift, ads/CPP/product-page features, provider black-box methodology and licensing.

### ASO-3 — Reuse first-party App Store Connect acquisition

Use the existing approved Analytics requests and `scripts/app-store/` extractor for POIS when the reports generate; use published InnerType to validate a live-app path. Reuse normalized source rows already flowing to the portfolio/ASO metric contract rather than create a second ASC ingestion engine. Keep LoveType/PASSPORT in the same contract when their approved reports become available. Preserve territory, native date/timezone, source type, event/page type, counts/unique counts, privacy suppression, completeness/correction markers and source hash.

**Acceptance:** per-app daily impressions/page views and first-time download metrics reproduce an official source sample and an independent aggregation; source segmentation is accurately labeled (Search includes Search Ads); absent report data is unavailable rather than zero; no keyword-level organic attribution is invented.

**Cost:** $0 planned incremental service cost; existing ASC API roles, requests and reader are reused.
**Risks:** report generation delay, privacy suppression, revised instances, source definitions that include paid placements.

### ASO-4 — Persist owned, source-attributed ASO observations

After ASO-1's real response contract passes, add a small additive Supabase migration for Apple popularity rows and app-specific suggestion snapshots. Keep their facts separate from `aso_keyword_rank_snapshots`. Store provider/source/method/version, term, country, genre, App Store app ID when applicable, period granularity and exact period, rank/popularity field names and scales, `observed_at`, `ingested_at`, request ID/hash, page coverage, and collection status. Successful observations remain append-only across periods; corrections/revisions are traceable. Do not store tokens or unnecessary raw user data. Add a narrow service-only server writer/reader and least-privilege policy after a migration review.

**Acceptance:** replayed captured API responses create identical normalized rows; repeated import is idempotent; distinct source scales cannot collide; database rows reconcile to Apple responses by term/country/genre/period; failure and valid-empty states remain distinct; legacy rank rows are unchanged. Production migration/permission changes require the roadmap's existing approval gate.

**Cost:** existing Supabase plan and small storage volume; no new service.
**Risks:** the existing public ASO schema relies on service role and RLS; preserve server-only writes and avoid exposing raw histories.
**Dependency:** ASO-1 endpoint contract and payload validation.

### ASO-5 — Evidence-based intelligence

Start deterministic and read-only. Generate candidate terms from Apple's popularity rows and app-specific suggestions; compare popularity movements with official App Store acquisition by territory/source, Apple Ads search-term outcomes, and verified metadata snapshots. Show observed inputs, method, confidence, sample/coverage, and alternatives. Competitor candidates may come from public catalog discovery, but must not be called search competitors or ranked competitors without query-scoped evidence. Recommendations propose metadata experiments; they never write metadata, create campaigns or change bids.

**Acceptance:** each opportunity can be traced to source rows and an exact window; popularity changes are not labeled demand counts; acquisition/source mixes are not called keyword attribution; recommendations do not claim causality without an approved test. First provide a reviewed report/API payload; only then consider adding a UI, in a separate milestone.

**Cost:** $0 if deterministic; any LLM/provider expense is deferred and requires approval.
**Risk:** genre demand vs an app's audience, sparse launches, confounded metadata/ads/seasonality.

## Current next step

The next engineering item is ASO-1's read-only access proof. The deployed Apple Ads connection is a viable credential source, but the current local branch has no credentials and only implements the legacy `/api/v5` reporting methods. Use the existing approved read-only account through a scoped server-side v1 request path; if production deployment is needed to execute that path, prepare a minimal reviewable diff and request the specific deployment approval only after local validation. No POIS campaign or new recurring cost is required by the documented endpoint payloads, but live campaign independence remains unproven.

## Sources

- Apple, [Insights Endpoints](https://developer.apple.com/documentation/apple-ads-platform-api/insights-endpoints) and [Search Term Popularity Query](https://developer.apple.com/documentation/apple-ads-platform-api/query-app-search-term-popularity-data).
- Apple, [Suggestions Endpoints](https://developer.apple.com/documentation/apple-ads-platform-api/suggestions-endpoints) and [Query Keyword Suggestions](https://developer.apple.com/documentation/apple-ads-platform-api/query-keyword-suggestions).
- Apple, [OAuth for the Apple Ads Platform API](https://developer.apple.com/documentation/apple-ads-platform-api/implementing-oauth-for-the-apple-ads-platform-api), [API access and roles](https://developer.apple.com/documentation/apple-ads-platform-api/access-overview), and [User ACL roles](https://developer.apple.com/documentation/apple-ads/useracl).
- Apple, [iTunes Search API](https://performance-partners.apple.com/search-api), [App Store Discovery and Engagement report](https://developer.apple.com/documentation/analytics-reports/app-store-discovery-and-engagement), [Analytics Reports API](https://developer.apple.com/documentation/appstoreconnectapi/downloading-analytics-reports), and [App Store Analytics overview](https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-dashboard).
- Repository evidence: `docs/milestones/m5a/DECISION.md`, `docs/kopa-reassessment/02_APPSTORE_DATA_AUDIT.md`, `docs/milestones/m4/FOUR_APP_SALES.md`, `scripts/app-store/`, `api/aso/collect.js`, and `supabase/migrations/20260719000000_aso_intelligence.sql`.

Documentation review date: 17 October 2026. Re-check live Apple docs, account roles and endpoint behavior before implementation because the API is changing.
