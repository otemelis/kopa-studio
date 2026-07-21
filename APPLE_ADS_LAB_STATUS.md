# Apple Ads Lab status

## Current milestone

Milestone 13 search-term recommendation evidence is ready. The Lab now imports Apple Ads search-term reports, stores real query-level delivery evidence, and refreshes read-only recommendation records from that evidence after report sync.

## Completed work

- Audited the existing Next.js, Supabase, auth, ASO data, job and test foundations.
- Verified Apple’s current official API family as Campaign Management API 5 and documented its OAuth/reporting constraints.
- Added `/apple-ads-lab` with a server-only credential readiness display and owner-only connection test.
- Added an API v5 adapter limited to OAuth and organization discovery.
- Added and applied the additive migration for connection metadata and Adam-ID mappings.
- Deployed the read-only Lab foundation to production on 2026-07-21. `tools.kopa.studio/apple-ads-lab` resolves successfully; the connection-test endpoint correctly redirects unauthenticated requests to login.
- Verified live OAuth and organization discovery with the configured read-only Apple Ads credential: `Otas Temelis` / organization ID `23026890`.
- Deployed the guided organization-save and Adam-ID app-mapping flow to production, including owner-scoped server-side authorization for mappings.
- The selected organization and first Kopa app mapping have been saved by the owner in production.
- Added the API v5 read-only campaign adapter (official paginated `GET /campaigns` endpoint), campaign storage migration, and idempotent sync service. No UI or API path invokes this service yet.
- Applied the campaign-sync migration, deployed the queue and owner-only first-run fallback, and completed the first live read-only import: 0 campaigns returned, with no errors.
- After the first paused campaign was created, verified live structure import: 2 ad groups, 12 keywords, and 0 negatives. No Apple Ads resource was modified.
- Added paginated read-only API v5 adapters for ad groups, targeting keywords and ad-group negative keywords, plus their completed storage and sync flow.
- Applied the reporting migration and added a campaign-level daily-report adapter. The owner can use **Sync last 7 days** from the Lab; it uses Apple’s campaign report endpoint with a campaign filter and writes only daily source metrics.
- Reporting ingestion explicitly finds and updates an existing campaign/day row before inserting. This keeps repeated runs idempotent even though SQL null values do not naturally collide in a compound unique key.
- Added the compact **Ads reporting** view. It has an honest empty state before delivery and will show totals plus daily campaign performance automatically after the first successful report sync.
- Added the compact **Ads structure** view. It reads the imported Apple Ads account shape from Supabase and shows campaign status, budgets, countries, ad group search-match state, keyword match types, keyword bids, and negative keywords without introducing any Apple Ads write surface.
- Added the compact **Ads data quality** view. It summarizes connection, mapping, campaign, structure, keyword, negative-keyword, reporting-row and sync-history health so missing delivery data is clearly shown as waiting rather than broken.
- Added the compact **Ads attribution** view. It shows whether the server-to-server attribution secret is configured, the production intake endpoint, mapped app readiness, event counts, latest event timing and recent attribution records. Repeated attribution upserts now refresh `received_at`, keeping the status page accurate for returning anonymous installs.
- Restored and upgraded the main **Apple Ads Lab** mapping workspace. The page now shows why Adam-ID mappings matter, lets the owner save new mappings, and displays the currently saved Kopa app / Adam ID / Apple app mapping table before sync controls.
- Added the compact **Ads keyword intelligence** view. It uses deterministic structure-only analysis to flag duplicate keyword coverage, ad groups without negatives, broad-only or exact-only match coverage, paused keyword rows and inactive campaign delivery state. A dedicated unit test covers the setup-risk analyzer.
- Fixed Apple Ads API v5 Search Match mapping for ad groups. The API returns top-level `automatedKeywordsOptIn` as a boolean in the live ad-group payload; the provider now maps that field, preserves the raw payload, tolerates string boolean values, and the structure read model falls back to the preserved raw payload for already-imported rows.
- Added Apple Ads search-term report ingestion using the campaign search-term report endpoint. **Sync last 7 days** now imports daily campaign metrics, search-term rows and refreshes recommendation evidence without creating or changing Apple Ads campaigns, ad groups, keywords, negatives or budgets.
- Added deterministic search-term recommendation generation. Imported terms that are fresh, not already covered by exact keywords or exact negatives and have enough evidence can produce active read-only Apple Ads recommendations with immutable decision snapshots.

## Verification and safety

Typecheck, focused tests and build pass. The repository’s existing `npm run lint` currently fails before linting because ESLint 9 cannot find a flat `eslint.config.*`; this is a pre-existing project configuration gap outside the Lab scope. Deployment, unauthenticated route checks, live OAuth and organization discovery pass. The database migrations are applied. Automation level is **0 / read-only**. No Apple Ads write API surface exists; no campaign, ad group, keyword, negative or budget can be changed.

## Required environment and next task

Next: log in at `https://tools.kopa.studio`, run **Sync last 7 days** in production, and validate real performance rows, search-term rows and generated recommendations against live Apple Ads data. Retain Automation Level 0 throughout.

Recommendation persistence is prepared in `20260721040000_apple_ads_recommendations.sql`; it stores immutable evidence snapshots separately from rule or AI rationale.
