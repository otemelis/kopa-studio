# Platform consolidation status

## Current phase

Phase 6 final cleanup and handoff.

The Tools app has moved from many top-level implementation pages toward the target workspace model:

- Dashboard
- Apps
- ASO Intelligence
- Apple Ads
- Actions
- Data & Integrations

The old routes are intentionally preserved until the consolidated workspaces have been verified in production with real authenticated data.

## Completed work

- Reduced visible sidebar navigation into workspace groups.
- Added expandable workspace sub-navigation so users can choose a sub-page before loading it.
- Added a persistent global context bar with app, market and period selectors.
- Added the Apple Ads Lab workspace with overview, campaign structure, reporting, keyword intelligence, planner, attribution, recommendations and health surfaces.
- Added read-only Apple Ads API v5 organization, campaign, ad group, keyword, negative keyword, reporting and search-term ingestion.
- Added Apple Ads attribution intake and status views.
- Added deterministic Apple Ads recommendation generation from imported search-term evidence.
- Merged Apple Ads recommendations into the unified Actions recommendation feed.
- Preserved compatibility routes for existing pages and direct links.

## Verified pages

Verified locally by typecheck and focused test coverage:

- `/`
- `/apps`
- `/aso`
- `/keywords`
- `/rankings`
- `/competitors`
- `/localizations`
- `/insights`
- `/experiments`
- `/app-store-connect`
- `/collection`
- `/apple-ads-lab`
- `/apple-ads-lab/structure`
- `/apple-ads-lab/reporting`
- `/apple-ads-lab/keyword-intelligence`
- `/apple-ads-lab/research-planner`
- `/apple-ads-lab/attribution`
- `/apple-ads-lab/data-quality`
- `/apple-ads-lab/recommendations`

Production unauthenticated smoke verification passed for `/apple-ads-lab` and `/login`. Owner-login verification is still needed for data-bearing screens.

## Data issues fixed

- Apple Ads Search Match mapping now reads the official API v5 `automatedKeywordsOptIn` field and falls back to preserved raw payloads for previously imported rows.
- Duplicate keyword detection is scoped to campaign, market, ad group, normalized keyword and match type.
- Missing negative-keyword warnings are limited to discovery/Search Match or broad-coverage ad groups, not exact-only control groups.
- Reporting and search-term imports are idempotent despite nullable SQL fields in unique-like lookup keys.
- Search-term recommendations skip terms already covered by exact keywords or exact negatives.
- Recommendation evidence is stored in immutable decision snapshots separate from active recommendation rows.

## Remaining routes

These routes remain live as compatibility routes:

- `/keywords`
- `/rankings`
- `/competitors`
- `/localizations`
- `/app-store-connect`
- `/collection`
- `/experiments`
- `/apple-ads-lab/*`

They should not be deleted until the replacement workspace URLs and redirects have been deployed and checked with real data.

## Known issues

- `npm run lint` does not currently run because the project uses ESLint 9 without a flat `eslint.config.*`. This is an existing tooling gap, not a runtime blocker.
- Global context currently propagates through query parameters. Some repositories still need deeper filtering by selected app, country and period.
- Search-term recommendations are deterministic and conservative. They are evidence-backed suggestions only; no Apple Ads write API exists.
- Production search-term and recommendation validation depends on Apple Ads campaign delivery and deployed credentials.

## Database migrations

Additive migrations created during the Apple Ads Lab work:

- `20260721010000_apple_ads_lab_connection_foundation.sql`
- `20260721020000_apple_ads_campaign_sync.sql`
- `20260721030000_apple_ads_structure_sync.sql`
- `20260721040000_apple_ads_recommendations.sql`
- `20260721050000_apple_ads_attribution.sql`
- `20260721060000_apple_ads_reporting.sql`
- `20260721100000_apple_ads_search_terms.sql`

The user confirmed `20260721100000_apple_ads_search_terms.sql` has already been run.

## Testing status

Latest local checks:

- `npm run typecheck` passed in `apps/tools`.
- Focused Vitest suite passed: 12 files, 37 tests.

Covered behavior includes Search Match mapping, status normalization, keyword structure intelligence, recommendation rules, search-term parsing, search-term table reads and search-term recommendation decisions.

## Deployment status

Deployed to production on 2026-07-21:

- Production alias: `https://tools.kopa.studio`
- Deployment URL: `https://kopa-tools-9eiz5da0d-otemelis-projects.vercel.app`
- Vercel deployment ID: `dpl_6AL87Hsc7LadRjyP8GBTSajsPHzL`

Smoke checks:

- `https://tools.kopa.studio/apple-ads-lab` returned HTTP 200.
- `https://tools.kopa.studio/login` returned HTTP 200.

Authenticated owner verification is still required for sync actions and live data views.

## Rollback status

Rollback path is preserved:

- Public `kopa.studio` remains separate from `tools.kopa.studio`.
- Old routes and page components still exist.
- Database changes are additive.
- Apple Ads integration remains Automation Level 0: read-only import and recommendation generation only.
- No Apple Ads write endpoints for campaigns, ad groups, keywords, negatives or budgets exist.

## Next task

Deploy the current Tools app, log in, run **Sync last 7 days**, and verify:

- Daily reporting rows import.
- Search-term rows import.
- Recommendation rows refresh.
- Actions feed displays Apple Ads recommendations.
- No Apple Ads account objects are modified.
