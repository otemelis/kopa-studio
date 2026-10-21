# POIS source view checkpoint · 21 October 2026

Branch: `codex/pois-source-overview-2026-10-21`. No production deployment, source permissions, campaign settings or database rows changed in this checkpoint.

The new owner-only `/pois-signals` page reads the existing ASO repository and the existing private POIS event reader. It presents source-specific 7/28-day observations. App Store Connect and Apple Ads cells remain unavailable when POIS has no scoped rows. `/aso/progress?app=pois` now resolves POIS rather than silently selecting InnerType. `/apple-ads-lab?app=pois` excludes historical InnerType and unmapped campaign rows.

## Direct source checks

| Source | Read-only validation | Result and display rule |
|---|---|---|
| Supabase ASO | App-scoped row counts from `aso_storefront_metrics`, `aso_daily_metrics`, and campaign-linked `apple_ads_daily_metrics` | POIS: 0 rows in each table as checked 21 October. No ASC or paid value is rendered as zero. Rankings are queried separately from current snapshots. |
| Apple Ads v1 OAuth | Existing protected local key; live `/v1/me`, `/v1/acls` and keyword tests | Authenticated test passed. This does not repair Vercel's older stored client secret. |
| Apple Ads v5 campaign API | Same dedicated key signed a fresh client-secret JWT; read-only ACL, campaign list and report | Four campaigns across two app IDs. POIS Adam ID `6820665225` has one enabled Australia campaign, ID `2144931256`. Its 19–20 October daily campaign report had zero rows. No campaign change or spend was initiated. |
| Production Apple Ads importer | `apple_ads_sync_runs` | Latest run 21 October 20:41 UTC failed `invalid_client`. `apple_ads_connections.status=healthy` is stale from its previous success; do not treat it as current health. |
| App Store Connect Analytics | Approved ONGOING request inventory and daily instance lists, retrieved with the existing reporting key into private `/private/tmp/kopa-pois-asc-check-20261021` | POIS Discovery, Downloads and Purchases each have **zero generated daily instances**. All three metrics remain unavailable. LoveType Discovery and Downloads now have four pending-validation instances; separate follow-up. |
| App Store Connect Sales and Trends | Official daily account reports 15–20 October, checksum/response evidence in the same private folder | 15, 16, 18, 19 and 20 October returned complete account reports with no POIS rows. The 17 October request returned 404, so no complete six-day POIS aggregate is asserted. Sales units are not first-time downloads. |
| POIS product analytics | Existing restricted `form.events` reader | Production-channel installation and event counts are displayed only when the live read succeeds; client purchase completion is not verified money. TestFlight is excluded. |

## Validation and next gates

`npm run typecheck`, the Next production build and seven existing POIS/ASO tests passed. The guarded live Apple Ads v1 and v5 read tests also passed. No hosted visual acceptance or POIS paid/ASC chart reconciliation can pass until those source rows exist.

Next: replace the stale production Apple Ads OAuth client secret using the validated dedicated API key, then run a read-only campaign import and bounded POIS report sync and reconcile the resulting campaign ID, country, dates and currency. The credential update is an explicit roadmap approval gate. Before applying it, verify the existing Vercel production baseline and prepare a rollback of the old secret. The POIS Analytics instance gap requires continued read-only checks of Apple's approved request; it must not be filled from Sales units or product events.
