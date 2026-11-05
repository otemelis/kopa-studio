# PASSPORT Apple Analytics recovery — protected preview check, 5 November 2026

**NO-GO for production release.** No production database change, backfill, or deployment occurred.

## Preview result

- The candidate tools preview is Vercel deployment `dpl_2RC46DxiYvFBxuF91ktweVHjByBE` from commit `7e88df04bf9a9c9fe6ae4b270df04bb23b502850`, target Preview, state READY. Vercel's build compiled the Next.js app and completed TypeScript and static page generation.
- Vercel SSO protects the preview. A request for `/passport-signals` through a short-lived Vercel share link returned the Kopa login redirect as expected without a Kopa owner session. The owner-only page was not rendered remotely.
- The branch has Preview-only overrides for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APPLE_ADS_CLIENT_SECRET`, and `APPLE_ADS_SYNC_SECRET`. The Supabase URL is `https://preview-isolated.invalid`; the keys/secrets are non-credentials. Thus this deployment cannot contact the production Supabase database using either the browser or service client.
- The existing `www.kopa.studio` collector project is not connected to Git. Vercel rejected a branch-specific credential override for it. No collector preview was deployed because its general Preview environment contains live Supabase service credentials. The temporary branch has `git.deploymentEnabled=false` in root `vercel.json` to prevent any repository-level preview deployment.
- Local Apple read-only dry-run, focused importer tests, isolated PostgreSQL SQL tests, and the PASSPORT page tests are the functional evidence. The tools preview cannot display imported PASSPORT data until a separately authorized production migration and import, and its isolated environment intentionally has no data source. Existing POIS production reporting remains untouched.

## Owner backup check

The owner checked **innertype** (`dsjgbxkerucutrjltgws`) in Supabase and reported that the Free plan has **no managed backup**. This is an explicit production release blocker; no full-project restore point is available.

As a bounded fallback, a read-only SQL export captured the exact PASSPORT reporting scope for 29 October–3 November 2026. It contains 17 existing `appstore_connect_sales` daily rows, zero storefront rows, and zero Analytics request mappings. The private local snapshot is `/Users/otastemelis/.codex/private-evidence/kopa/passport-reporting-snapshot-2026-11-05.json` (mode `0600`, SHA-256 `7e754312ba312671664f47ce385a5b1affa20959e0da97a701a0c93ec180ff5c`). Restoring all three sets into an isolated local PostgreSQL 16 instance yielded `17|0|0`; canonical source and restored Sales JSON hashes both equal `ffbdca94cc4dcfdffb256475edb742b1da70a3eaeea1e7cb010e723b32fd99bb`. The local instance was stopped after validation. This establishes a tested **scoped data snapshot**, not a full Supabase backup or schema-level restore. The Sales rows are outside the proposed Analytics mutation.

## Remaining release gates

1. A full logical database backup and an isolated PostgreSQL restore test are needed before live changes, or the owner must explicitly accept the narrower scoped rollback risk in a separate production decision. The tested scoped snapshot above is insufficient to claim full-project recoverability.
2. A collector preview must be built without live write credentials (for example, an isolated project or a supported per-deployment environment override), then the exact scoped collector files and owner action must be smoke-tested.
3. Only after a separate production authorization: recheck Apple revision and POIS baseline, apply the reviewed SQL, deploy collector, run bounded PASSPORT import, reconcile source partitions and POIS controls, then deploy the owner UI.
