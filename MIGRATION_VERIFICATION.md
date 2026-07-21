# Migration verification checklist

Status: not started against a configured production-equivalent Supabase environment.

- [ ] Owner authentication, session refresh, logout, and unauthorized-account handling
- [ ] App list record count and app details match legacy console (new read-only view implemented)
- [ ] Keyword records, filters, groups, and status match legacy console (new read-only view implemented)
- [ ] Rankings and ranking-history values match for selected app/country/date ranges (new read-only view implemented)
- [ ] Competitor catalogue and snapshot data match (new read-only view implemented)
- [ ] Localizations/metadata history match
- [ ] App Store Connect sales and storefront metrics match date/country aggregations
- [ ] Insight records and deterministic outputs match expected source windows (new read-only view implemented)
- [ ] Collection actions, duplicate prevention, failure display, and retry behavior match
- [ ] No sensitive environment value appears in HTML, client bundles, API responses, or logs
- [ ] Desktop and mobile smoke tests pass
- [ ] Production rollback to legacy console has been rehearsed
