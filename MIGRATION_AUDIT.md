# ASO tool migration audit

Status: completed for Phase 1 discovery on 2026-07-21. No production tables, collector code, or public-site routes were changed.

## Current architecture

The public `kopa.studio` site is a dependency-free static site deployed by the root `vercel.json`. Its hidden console is rendered inside `index.html`; `src/main.js` handles password login and studio analytics, while `src/aso-console.js` is a 2,208-line client-side ASO UI. It calls Supabase PostgREST directly using a browser session and invokes privileged Vercel functions under `api/aso/`.

The operational backend is intentionally split already:

- `api/aso/collect.js`: cron/manual public-store collection, persistence, review classification, and deterministic insights. It has an in-memory guard and a six-minute database lease (`aso_collection_locks`).
- `api/aso/appstore-connect.js`: server-only App Store Connect token work, connection testing, sales and discovery analytics sync.
- `api/aso/lookup.js`: authenticated public App Store lookup proxy.
- `api/aso/_lib/`: reusable calculation, metadata-diff, App Store, provider, insight, and service-role Supabase modules.

## Reuse and migration map

| Existing implementation | New home | Decision |
| --- | --- | --- |
| `api/aso/_lib/calc.js` | `apps/tools/src/services` plus tests | Reuse calculations; convert only at typed boundaries. |
| `api/aso/_lib/insights.js` | existing worker initially | Retain; it is deterministic and already operational. |
| `api/aso/collect.js` | external worker/control integration | Retain; never run from a page request. |
| `api/aso/appstore-connect.js` | server-only service/route handler | Reuse private-key logic; never move it client-side. |
| `src/aso-console.js` | feature-by-feature React screens | Replace only the DOM UI and direct browser PostgREST access. |
| Supabase migrations | same project/schema | Retain without destructive changes. |

## Risks and findings

- The old console keeps refresh tokens in `localStorage`; the new application uses Supabase SSR cookies and server authorization.
- `api/config.js` returns the anon key, which is normal for a Supabase browser client, but its legacy naming can be confusing. The new application uses explicit `NEXT_PUBLIC_*` variables only for public values.
- `aso_sync_runs` is observability, not a true generic queued-job table. Do not claim background-job migration is done until a durable queue/worker interface is selected and the existing collector’s limits are tested.
- The direct browser writes in the old UI must be migrated through validated server handlers or dedicated RLS-backed repositories one workflow at a time.

## Data-preservation plan

The new application starts read-only against the same Supabase database. No existing tables are renamed, dropped, or rewritten. Each later write migration requires row-count comparison, a backward-compatible migration, and a legacy/new output comparison recorded in `MIGRATION_VERIFICATION.md`.
