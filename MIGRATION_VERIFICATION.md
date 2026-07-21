# Migration verification checklist

Status: not started against a configured production-equivalent Supabase environment.

Environment note (2026-07-21): the linked Vercel project was reachable, but its pulled secret values were redacted in this workspace. Use an authorized local environment with real values or a dedicated preview deployment before checking any live data.

## Read-only baseline check — 2026-07-21

Executed through the server-role REST API using the configured local environment; no rows or secrets were printed.

| Surface | Live baseline | New-view bound | Result |
| --- | ---: | ---: | --- |
| Apps | 1 | 100 | covered |
| Active keyword assignments | 104 | 200 | covered (cap raised from 100) |
| Owned rank snapshots in 35-day window | 220 | 1,000 | covered |
| Competitors | 2 | 100 | covered |
| Active insights | 4 | 100 | covered |
| Sync runs | 5 | 10 | covered |
| App storefronts | 1 | 200 | covered |
| Storefront metrics in 28-day window | 0 | 5,000 | empty state expected |

This confirms the configured queries can read the current dataset within their limits. It is not a substitute for owner-session, screen-by-screen, filter, and metric-value comparison.

## Security smoke check — 2026-07-21

- [x] Unauthenticated request to `/` resolves to the `/login` redirect with no overview/card data in the response.
- [x] Unauthenticated `POST /api/apps` resolves to `/login` before any write handler is reached.
- [ ] Authenticated owner session reaches each migrated screen.
- [ ] Signed-in but non-member account resolves to `/unauthorized`.

## Migrated write workflows

- [ ] Owner adds an app through Apple lookup; verify the app and primary storefront are created once.
- [ ] Owner adds comma- or line-separated keywords; verify assignment creation and duplicate handling.
- [ ] Owner edits a keyword assignment; verify text/country and per-app priority/status behavior.
- [ ] Owner deletes a keyword assignment; verify shared keyword cleanup only when it has no remaining assignments.
- [ ] Owner adds a competitor through Apple lookup; verify it appears in the catalogue.
- [ ] Owner completes, dismisses, and snoozes an insight; verify it leaves the active list and preserves history.
- [ ] Owner creates and edits an experiment; verify fields persist without affecting historical metrics.
- [ ] Apply `20260721000000_aso_jobs.sql`; verify one queued collection job is claimed by the existing cron worker and records a linked sync run.

- [ ] Owner authentication, session refresh, logout, and unauthorized-account handling
- [ ] App list record count and app details match legacy console (new read-only view implemented)
- [ ] Keyword records, filters, groups, and status match legacy console (new read-only view implemented)
- [ ] Rankings and ranking-history values match for selected app/country/date ranges (new read-only view implemented)
- [ ] Competitor catalogue and snapshot data match (new read-only view implemented)
- [ ] Localizations/metadata history match (storefront coverage view implemented; metadata history remains legacy-only)
- [ ] App Store Connect sales and storefront metrics match date/country aggregations (connection/report status and 28-day storefront metrics implemented; sales aggregation remains legacy-only)
- [ ] Insight records and deterministic outputs match expected source windows (new read-only view implemented)
- [ ] Collection actions, duplicate prevention, failure display, and retry behavior match
- [ ] No sensitive environment value appears in HTML, client bundles, API responses, or logs
- [ ] Desktop and mobile smoke tests pass
- [ ] Production rollback to legacy console has been rehearsed
