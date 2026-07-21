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
- `npm run typecheck`, `npm test`, and `npm run build` pass in `apps/tools`.

## Not yet verified against production data

- A configured local `apps/tools/.env.local` is required to verify real Supabase reads and authenticated owner access.
- No database migration has been applied. No production data was modified.
- Contested-term comparison and all write actions remain legacy-only.

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
