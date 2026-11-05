# PASSPORT Apple Analytics recovery — protected preview check, 5 November 2026

**NO-GO for production release.** No production database change, backfill, or deployment occurred.

## Preview result

- The candidate tools preview is Vercel deployment `dpl_2RC46DxiYvFBxuF91ktweVHjByBE` from commit `7e88df04bf9a9c9fe6ae4b270df04bb23b502850`, target Preview, state READY. Vercel's build compiled the Next.js app and completed TypeScript and static page generation.
- Vercel SSO protects the preview. A request for `/passport-signals` through a short-lived Vercel share link returned the Kopa login redirect as expected without a Kopa owner session. The owner-only page was not rendered remotely.
- The branch has Preview-only overrides for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APPLE_ADS_CLIENT_SECRET`, and `APPLE_ADS_SYNC_SECRET`. The Supabase URL is `https://preview-isolated.invalid`; the keys/secrets are non-credentials. Thus this deployment cannot contact the production Supabase database using either the browser or service client.
- The existing `www.kopa.studio` collector project is not connected to Git. Vercel rejected a branch-specific credential override for it. No collector preview was deployed because its general Preview environment contains live Supabase service credentials. The temporary branch has `git.deploymentEnabled=false` in root `vercel.json` to prevent any repository-level preview deployment.
- Local Apple read-only dry-run, focused importer tests, isolated PostgreSQL SQL tests, and the PASSPORT page tests are the functional evidence. The tools preview cannot display imported PASSPORT data until a separately authorized production migration and import, and its isolated environment intentionally has no data source. Existing POIS production reporting remains untouched.

## Owner backup check

In Supabase, select the **innertype** project (`dsjgbxkerucutrjltgws`) and open **Database → Backups**. Confirm the newest backup shows **Completed/Successful**, record its timestamp and timezone, type (Daily or PITR), and retention or earliest available recovery point. Confirm the restore option is available, but **do not click Restore**. If the project is on Free and no backup exists, report that; a scoped logical export and tested isolated restore would then be required before production writes. A managed backup listing is not itself a tested restore. Supabase documents that physical backups can be restored to a new project; doing so may create cost and is outside this preview authorization.

## Remaining release gates

1. Owner reports the backup status above; a restore-safe procedure or isolated test must be established before live changes.
2. A collector preview must be built without live write credentials (for example, an isolated project or a supported per-deployment environment override), then the exact scoped collector files and owner action must be smoke-tested.
3. Only after a separate production authorization: recheck Apple revision and POIS baseline, apply the reviewed SQL, deploy collector, run bounded PASSPORT import, reconcile source partitions and POIS controls, then deploy the owner UI.
