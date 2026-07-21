# Deploying Kopa Tools

1. Create a new Vercel project with root directory `apps/tools`; do not reuse the root project’s static `vercel.json`.
2. Set the variables in `apps/tools/.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_` name.
3. In Supabase Auth, set the site URL and add `https://tools.kopa.studio/auth/callback` and the relevant preview callback URLs.
4. Add the intended owner to `analytics_admins` using the existing SQL guidance in `supabase/security.sql`.
5. Run `npm run build`, deploy a preview, sign in, and compare the read-only screens with the old console.
6. Only after `MIGRATION_VERIFICATION.md` critical checks pass, add the DNS/CNAME mapping for `tools.kopa.studio`.

The existing Vercel Cron and `api/aso/collect.js` remain on the legacy deployment until a verified worker handoff. Production health checks: unauthenticated `/` redirects to login; owner login reaches overview; non-member reaches unauthorized; app-list count matches legacy; collector run history is visible. Roll back by unmapping the tools domain; the legacy console and data stay intact.
