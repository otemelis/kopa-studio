# ASO migration status

Last updated: 2026-07-21

## Current phase

Production cutover — the new Tools application is deployed at `tools.kopa.studio`; the legacy console remains available as the rollback path.

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
- Migrated owner-only app creation (Apple public lookup), keyword creation/edit/delete, and competitor creation. Writes use Zod validation and server-only Supabase access; deleting a keyword assignment removes the shared keyword only when no assignments remain.
- Migrated owner-only insight workflow actions: mark complete, dismiss, and snooze for 14 days. These update only insight status and never overwrite deterministic evidence or source data.
- Migrated owner-only experiment management: create and edit experiment context, timing, status, result, conclusion, and next action. The existing before/after measurement logic remains the retained source of truth.
- Applied the additive `aso_jobs` migration to production, deployed the legacy collector update, and verified a queued collection job is claimed and completed by the Vercel cron worker with a linked sync run.
- Deployed the separate `kopa-tools` Vercel project from `apps/tools` and attached the verified `tools.kopa.studio` domain. The production signed-out route redirects to `/login` without rendering ASO data.
- `npm run typecheck`, `npm test`, and `npm run build` pass in `apps/tools`.

## Remaining production verification

- Add `https://tools.kopa.studio/auth/callback` to Supabase Auth redirect URLs if it is not already present.
- Complete one signed-in owner-session check on the new domain, including logout and an unauthorized-account check.
- Data-collection retries and App Store Connect sync controls remain on the retained legacy worker/integration.

## Commands

```sh
cd apps/tools
npm install
npm run typecheck
npm test
npm run dev
```

## Deployment and rollback

The `kopa-tools` project is configured with root directory `apps/tools`, and `tools.kopa.studio` is attached. Rollback is immediate: unmap the tools subdomain while leaving the existing root static-site/Vercel deployment in place.
