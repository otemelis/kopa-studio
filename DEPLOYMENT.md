# Deploying Kopa Tools

1. The separate `kopa-tools` Vercel project is configured with root directory `apps/tools`; it does not reuse the root project’s static `vercel.json`.
2. Set the variables in `apps/tools/.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_` name.
3. In Supabase Auth, set the site URL and add `https://tools.kopa.studio/auth/callback` and the relevant preview callback URLs.
4. Add the intended owner to `analytics_admins` using the existing SQL guidance in `supabase/security.sql`.
5. Run `npm run build`, deploy a preview, sign in, and compare the read-only screens with the old console.
6. `tools.kopa.studio` is attached and DNS-verified. Complete the remaining authenticated checks in `MIGRATION_VERIFICATION.md` before retiring the legacy console.

For local parity work, create `apps/tools/.env.local` from the example using an authorized secret manager or local secure environment. Do not rely on a redacted environment export: validate `NEXT_PUBLIC_SUPABASE_URL` is a real HTTPS URL before running the authenticated screens.

The existing Vercel Cron and `api/aso/collect.js` remain on the legacy deployment until a verified worker handoff. Production health checks: unauthenticated `/` redirects to login; owner login reaches overview; non-member reaches unauthorized; app-list count matches legacy; collector run history is visible. Roll back by unmapping the tools domain; the legacy console and data stay intact.

Before enabling collection controls, apply `supabase/migrations/20260721000000_aso_jobs.sql` in the existing Supabase project, deploy the legacy collector update, then queue one test collection from Tools. The job migration is additive and does not alter historical tables; if rollback is required, stop queuing jobs and leave the new table unused while the legacy cron continues normally.
