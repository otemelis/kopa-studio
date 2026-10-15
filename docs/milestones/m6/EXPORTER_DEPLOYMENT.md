# Apple Ads read-only exporter deployment · 15 October 2026

**Deployed; authenticated data validation pending.** The owner approved the four-file exporter deployment. Production is now `dpl_4a8R4cpGaV6FidNHfyEhcpPWFb3n`, aliased to https://tools.kopa.studio. No report has yet been independently reconciled from this new endpoint. The accepted manual CSV snapshot remains unchanged.

## Scope verification

The previous production deployment was `dpl_AJcmhnfbhcso8GNp3CfWQ2rZ2J5G`. Its uploaded source tree contained 304 files. All were reconstructed and matched to Vercel's SHA-1 file identifiers; 300 matched local original-repository bytes, four packaging/documentation files were retrieved through the official authenticated file API. The release adds exactly:

- `apps/tools/src/app/api/apple-ads/reports/export/route.ts`
- `apps/tools/src/app/api/apple-ads/reports/export/route.test.ts`
- `apps/tools/src/lib/apple-ads/read-only-export.ts`
- `apps/tools/src/lib/apple-ads/read-only-export.test.ts`

Both successful preview and production source trees independently matched **304 unchanged files + four additions, no modifications/deletions**. No milestone UI, dependency change, unrelated refactor, database migration, environment variable, permission or campaign change was included. Existing production Next.js 15.5.20 dependencies were preserved; the development branch's newer package files were excluded.

## Verification results

- Exact production-lockfile installation, local production build, lint/type checks: PASS.
- Focused provider/reporting/exporter/auth tests on the production dependency baseline: **23 passed**. An external test-only alias configuration was needed for the baseline Vitest runner; it was not deployed.
- Existing official CSV validation regression tests: **five passed**.
- CLI preview `dpl_3weAXciHHDdJnGF2WAay91HJy2v3`: READY, build/functions packaging PASS, 308 source hashes verified. Vercel preview authentication remained enabled; no protection bypass or permission change was made.
- Production `dpl_4a8R4cpGaV6FidNHfyEhcpPWFb3n`: READY, build/functions packaging PASS, 308 source hashes verified; https://tools.kopa.studio alias confirmed.
- Unauthenticated GET: **307 → /login**, no report returned.
- Authenticated live report: **NOT YET VALIDATED**. The existing signed-in owner page remains accessible, but both direct JSON navigation attempts in the in-app browser returned `ERR_BLOCKED_BY_CLIENT`. No browser cookies were extracted, security controls changed or credentials replaced.
- The first two REST-created previews compiled and type-checked but failed Vercel packaging with a missing routes-manifest path. They never reached production. Repeating the original CLI deployment path with the existing Tools-specific configuration resolved this without changing any application source or project settings.

## How to use

Sign into the existing owner Tools account, then open:

- One-day control: https://tools.kopa.studio/api/apple-ads/reports/export?start=2026-10-11&end=2026-10-11
- Current bounded window: https://tools.kopa.studio/api/apple-ads/reports/export?start=2026-09-17&end=2026-10-14
- Rolling default: https://tools.kopa.studio/api/apple-ads/reports/export

Save the JSON response as a local file. The default rolls with UTC; the explicit dates above are valid within the endpoint's 28-day lookback on 15 October. An HTTP error or `error` response is unavailable data, not a zero report. The endpoint uses existing owner authentication and protected runtime credentials, performs SELECT queries and provider reporting calls only, and returns no credentials. Do not use the legacy import/sync buttons as a substitute: they write database records.

The source is explicitly the existing legacy v5 reporting adapter and only the owner's already-mapped, nondeleted campaigns (1–10); this is not a current account-inventory sync or a completed API migration. Omitted no-metric days remain unobserved. Attributed installs are not verified purchases or people.

## Exact next task

Obtain the authenticated 28-day JSON file, validate its scope and daily rows independently, then reconcile 11 October against the official **13 impressions / EUR 0 / zero taps and installs** control and 11–14 October against **52 impressions / EUR 0.49 / one tap / zero installs**. Preserve any revisions and distinguish absent rows from source-reported zero. Only after that passes, extend the existing local paid reporting snapshot with the verified daily data. Do not import into production Supabase or change ads.

Rollback, if required: return the service to the retained previous production deployment. No database rollback is needed because the exporter has no persistence calls; its `databaseWrites:0` response describes this implementation contract, not a database-wide audit of other jobs.

Source manifest: `exporter-source-manifest.json` in the checkpoint outputs. Raw deployment metadata and build logs remain in the local deployment-review working directory; no secrets are included in the report.
