# Apple Ads Keyword Lab audit

Status: Milestone 0 complete on 2026-07-21. No Apple Ads account credentials have been supplied, no schema migration has been applied, and no Apple campaign has been read or changed.

## Existing platform to reuse

`apps/tools` is a Next.js 15.2 App Router application using React 19, TypeScript, Zod and Supabase. Its server-rendered pages use `PageShell`, `Sidebar`, the compact table/card system in `src/app/globals.css`, and the service → repository → Supabase-admin-client pattern. Authentication is Supabase Auth; `analytics_admins` is the owner allowlist. There is no organization/tenant table yet.

Existing assets to join instead of duplicate:

| Existing data | Reuse in Lab |
| --- | --- |
| `aso_apps` | App record and Apple `adamId` mapping target |
| `aso_keywords`, `aso_app_keywords` | Existing organic-keyword strategy and ASO candidates |
| `aso_keyword_rank_snapshots` | Organic visibility / ranking context |
| `aso_competitors`, `aso_competitor_snapshots` | Competitor and positioning context |
| `aso_metadata_snapshots` | Localized product-page intent checks |
| `aso_daily_metrics`, `aso_storefront_metrics` | App Store Connect acquisition context |
| `aso_insights`, `aso_experiments` | Existing ASO workflow and measurement records |
| `aso_sync_runs`, `aso_jobs` | Operational history and durable job pattern |

The database is service-role-only for this internal tool: RLS is enabled and `anon`/`authenticated` do not receive table access. Environment validation currently covers Supabase only. The testing baseline is Vitest unit tests plus typecheck, lint and Next build.

## Apple API verification

Apple’s current official documentation describes **Apple Ads Campaign Management API 5**. It uses OAuth 2 client credentials: a server-held signed client-secret JWT is exchanged at `https://appleid.apple.com/auth/oauth2/token` with `grant_type=client_credentials` and scope `searchadsorg`; the access token has a one-hour lifetime. Calls use `Authorization: Bearer …`, and organization-scoped calls also require `X-AP-Context: orgId=…`.

Reports are available for campaigns, ad groups, keywords, search terms and ads. Search-term reports have an Apple-documented 10-impression visibility threshold and only support `ORTZ`; missing terms must therefore never be interpreted as zero demand. Impression share is an asynchronous custom-report flow. Apple documents `429` responses, so sync workers need capped exponential backoff with jitter. Endpoint payloads must be rechecked against Apple’s live API reference when each adapter method is added.

Official sources: [Apple Ads API overview](https://developer.apple.com/documentation/apple_ads), [OAuth](https://developer.apple.com/documentation/apple_ads/implementing-oauth-for-the-apple-search-ads-api), [calling the API](https://developer.apple.com/documentation/apple_ads/calling-the-apple-search-ads-api), [reports](https://developer.apple.com/documentation/apple_ads/reports), and [impression-share reports](https://developer.apple.com/documentation/apple_ads/impression-share-reports).

## Proposed module and migration sequence

The module route is `/apple-ads-lab`, followed by nested routes only when their corresponding data is available: `setup`, `campaigns`, `keywords`, `search-terms`, `aso-opportunities`, `recommendations`, `research-planner`, `actions`, `attribution`, `guardrails`, `sync-health`, and `audit-log`.

The first additive migration is `20260721010000_apple_ads_lab_connection_foundation.sql`: it adds only non-secret connection metadata and Adam-ID app mappings. Later migrations will add structure snapshots, report facts, recommendations/actions/snapshots, attribution, and audit/guardrail records. `organization_id` is nullable because the existing platform is owner-only; introducing an organization table is a separate tenancy decision, not a side effect of this Lab.

## Security and risk assessment

- Credentials remain server environment variables in Milestone 1. The browser never receives a secret, client secret, or access token. The `CredentialStore` abstraction isolates this initial choice so encrypted per-tenant storage can replace it later.
- The API adapter exposes only connection/org discovery now. There are no write methods, action endpoints, or feature flags that can mutate Apple Ads.
- Connection test results contain only organization metadata. Access-token and raw OAuth response logging is prohibited.
- Apple Ads permissions and the exact ACL response must be verified with a real read-only account before sync is considered complete.
- The current job table only accepts `collection`; it needs an additive enum/check expansion or a dedicated Lab job table before background sync is introduced.
- API-field drift, report latency, 10-impression search-term suppression, incomplete reports, currency/time-zone differences, and a missing tenant model are known design risks.

## Phased plan

0. Audit and API verification — complete.
1. Apply connection migration, configure a read-only Apple credential, test OAuth, select an organization and confirm app mappings.
2. Add durable idempotent structure sync jobs for campaigns, ad groups, keywords, negatives and ads.
3. Add validated report ingestion and freshness state.
4. Add compact intelligence pages and ASO joins.
5. Add documented low-volume calculations and tests.
6–8. Add validated AI interpretation, deterministic recommendations, and a draft-only research planner.
9+. Introduce approval copilot only after prior milestones are verified; keep automation Level 0 until then.
