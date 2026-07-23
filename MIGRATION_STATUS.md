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
- Clarified the Jobs page as an ordered sync runbook: keyword ranking scrape first, App Store Connect Discovery/sales report retries second, Apple Ads structure third, and Apple Ads performance fourth. App Store Connect report retries now run through an owner-only Tools route that reuses the retained server-side integration.
- Fixed App Store Connect Discovery report parsing for Apple's tab-delimited analytics files while preserving legacy comma-delimited fixture support.
- Deployed the parser fix to the root `kopa.studio` project and deployed the Jobs runbook/App Store Connect retry route to `kopa-tools`; smoke checks returned HTTP 200 for `https://www.kopa.studio` and `https://tools.kopa.studio/collection`.
- Updated Jobs to show active `aso_jobs` queue rows as well as completed `aso_sync_runs`, format Jobs timestamps in Europe/Berlin time, and nudge the retained collector when a keyword scrape is queued or already waiting. Added `CRON_SECRET` to the production `kopa-tools` environment and redeployed so the worker wake path is configured.
- Hotfixed the Jobs timestamp formatter after Vercel rejected `dateStyle`/`timeStyle` combined with `timeZoneName`; Jobs now uses explicit Europe/Berlin date/time fields and the production `/collection` route redirects cleanly for signed-out users.
- Rotated `CRON_SECRET` across both production Vercel projects after a masked placeholder value caused Tools worker wakes to receive `401 Unauthorized`; redeployed both projects and verified queued job `9c379a5f-d95d-4467-b1c4-3df273b6a9f6` completed with sync run `6b56d44c-cfa1-4f6d-ae65-08be5582fb27`.
- Added `ASO_COLLECTOR_REFERENCE.md` to document what the public ASO scraper collects, which tables it writes, current limits, and what is explicitly out of scope.
- Kept App Store Connect private keys only on the root `kopa.studio` project: Tools now proxies owner-approved App Store Connect sync retries to the retained root integration over server-to-server `CRON_SECRET` auth.
- Improved App Store Connect sales mismatch diagnostics: when Apple returns sales rows for app IDs that do not match tracked Kopa apps, the sync response now includes sample Apple report app IDs/titles and the currently tracked Kopa App Store IDs.
- Fixed App Store Connect sales import date handling: Summary Sales rows with Apple slash-formatted `End Date` values are normalized before matching/import, and tracked rows with invalid date/country fields now return sample raw values instead of looking like an app-ID mismatch.
- Started the Discovery & Engagement decision layer in Tools: App Store Connect now separates Discovery report rows from daily download metrics, shows 28-day visibility/page-view/download totals, daily storefront trend, source-type mix, storefront conversion rates, and a non-error "waiting for delivery" state while Apple Ads has no served impressions.
- Added tested Discovery decision brief rules: Tools now compares the latest half of the storefront window against the previous half and surfaces operator cards for weak impression-to-page-view pull, weak download conversion, strongest discovery source, page-view trend changes, and waiting states when Discovery or download imports are not ready.
- Added Discovery & Engagement cards to the unified Recommendations feed. The feed now supports ASO, Discovery, and Apple Ads sources, applies the existing app/priority filters to Discovery cards, and keeps Discovery signals advisory while the system is still pre-ad-delivery.
- Linked Discovery recommendations to the Change Log: app/storefront-specific Discovery cards can open a prefilled investigation draft with the relevant app, market, metric, evidence, and next action while preserving the existing owner-only experiment creation flow.
- `npm run typecheck`, `npm test`, and `npm run build` pass in `apps/tools`.

## Remaining production verification

- Add `https://tools.kopa.studio/auth/callback` to Supabase Auth redirect URLs if it is not already present.
- Complete one signed-in owner-session check on the new domain, including logout and an unauthorized-account check.
- Verify one signed-in run of each Jobs runbook action against production data after deployment.

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
