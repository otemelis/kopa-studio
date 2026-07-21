# Migration verification checklist

Status: not started against a configured production-equivalent Supabase environment.

Environment note (2026-07-21): the linked Vercel project was reachable, but its pulled secret values were redacted in this workspace. Use an authorized local environment with real values or a dedicated preview deployment before checking any live data.

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
