# ASO migration plan

1. **Discovery and audit — complete.** Document existing architecture and preserve it.
2. **Foundation — complete.** The independent `apps/tools` Next.js application has App Router, TypeScript, Tailwind, cookie-based Supabase Auth, server authorization, repositories, services, validation, tests, and a protected shell.
3. **Read-only parity — in progress.** App list/detail, keyword strategy/latest ranks, active insights, and collection history have server-rendered read-only views. Compare them with the legacy console before enabling writes.
4. **Collection controls.** Define a durable job contract around the current worker. Migrate triggers only after duplicate protection, retry semantics, and production execution are validated.
5. **Parallel verification and cutover.** Run both tools together, complete the verification checklist, then configure `tools.kopa.studio`. The legacy console remains rollback until stability is demonstrated.

Deferred by instruction: Apple Ads, campaign/bid management, billing, organizations, invitations, public SaaS onboarding, and new marketing modules.
