# ASO migration status

Last updated: 2026-07-21

## Current phase

Phase 3 — shared domain and read-only data layer. Phases 1–2 are complete.

## Completed and verified locally

- Audited the legacy static site, hidden console, ASO server functions, and SQL migration history.
- Added a separate Next.js application at `apps/tools`; the public `kopa.studio` deployment remains untouched.
- Added SSR Supabase session handling, server-side approved-account checks through `analytics_admins`, logout, protected server components, environment validation, repositories, services, Zod validators, and a read-only overview/apps/collection UI.
- Added initial unit coverage for bounded pagination and job-state transitions.
- Migrated read-only keyword strategy/rank snapshots and active insight views through server-side repositories. They have bounded queries and URL-persisted filters; legacy edit, dismissal, and collection actions remain unchanged.
- Migrated read-only owned-app ranking history and competitor catalogue/latest snapshot views. Contested-term calculations and competitor mutations remain legacy-only pending production comparison.
- Migrated read-only storefront localization coverage and App Store Connect connection/report-request status. Private credentials, report provisioning, and sync controls remain in the existing server-side integration.
- Migrated read-only 28-day App Store Connect storefront-metric summaries and contested-term comparison. Both retain the legacy source data and use bounded server-side windows.
- Performed a live, service-role read-only baseline check on 2026-07-21: 1 app, 104 active keyword assignments, 220 owned rank snapshots in the 35-day screen window, 2 competitors, 4 active insights, 5 sync runs, 1 storefront, and 0 storefront-metric rows in the 28-day window. The keyword view cap was raised from 100 to 200 after this check found four assignments would otherwise be omitted.
- Fixed and smoke-tested an authorization-order issue found during local verification: every protected page now checks the approved owner session before any repository query. An unauthenticated request exposes only a redirect to `/login`, with no ASO content rendered.
- `npm run typecheck`, `npm test`, and `npm run build` pass in `apps/tools`.

## Not yet verified against production data

- Real Supabase reads are now configured locally. Authenticated owner-session and visual screen testing are still required.
- No database migration has been applied. No production data was modified.
- All write actions remain legacy-only.

## Commands

```sh
cd apps/tools
npm install
npm run typecheck
npm test
npm run dev
```

## Deployment and rollback

Deployment is not configured yet. Deploy `apps/tools` as a separate Vercel project and attach `tools.kopa.studio` only after verification. Rollback is immediate: leave the existing root static-site/Vercel deployment in place and remove the tools subdomain mapping.
