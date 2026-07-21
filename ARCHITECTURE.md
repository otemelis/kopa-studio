# Kopa Tools architecture

`apps/tools` is a separate Next.js App Router deployment. It does not replace the root static public site.

```text
Browser -> Next.js Server Components / Route Handlers -> repositories -> Supabase
                                                     -> existing collector (later control contract)
Existing Vercel cron -> api/aso/collect.js -> Supabase
```

Authentication uses Supabase Auth cookies. Every protected page calls `requireUser`, which validates the current server session and checks membership in the existing `analytics_admins` allowlist using a server-only service-role client. The current owner is mapped to `owner`; this is a code-level role seam, not a new role-management product.

React components never query Supabase directly. Repositories own direct database access; services compose repositories; routes validate input before service calls. The service-role key is server-only. App Store Connect private keys remain in the existing server worker until their behavior is migrated and tested.
