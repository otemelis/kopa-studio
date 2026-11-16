# Kopa Mac mini handover — start here

Prepared 16 November 2026. **Phase 1 only:** no production schedule, deployment, database schema, app, or worker was changed. Do not start collectors merely to test this handover.

## Source of truth

Clone the private `https://github.com/otemelis/kopa-studio.git` repository. This handover is on branch `codex/mac-mini-handover-2026-11-16`, based on `main` commit `e9f27797`. Read this directory in order: [inventory](SYSTEM_INVENTORY.md), [setup](MAC_SETUP.md), [environment](ENVIRONMENT.md), [migration](WORKER_MIGRATION.md), [scheduling](SCHEDULING.md), [validation](VALIDATION.md), [rollback](ROLLBACK.md). The product roadmap remains `docs/KOPA_ROADMAP.md`; it does not override this migration's approval gates.

`main` does **not** yet contain [PR #33](https://github.com/otemelis/kopa-studio/pull/33), although the PASSPORT aggregate Edge Function version 13 and its SQL migration were applied to the live Supabase project after owner approval. Reconcile that branch before treating `main` as an exact deployed-backend copy. Do not reapply the migration blindly.

Two Vercel projects share this repository: `kopa.studio` (`www.kopa.studio`, root static/API project) and `kopa-tools` (`tools.kopa.studio`, `apps/tools` Next.js). Supabase project `dsjgbxkerucutrjltgws` is shared by Kopa and app telemetry. Preserve its records.

## First safe actions on the Mac mini

1. Clone/fetch Git and check the commit and open PRs. Install dependencies from both lockfiles. Run local tests and builds without live credentials.
2. Check the live Vercel Schedules page and Supabase `cron.job` read-only. The tables below are repository declarations plus read-only observations on 16 November; production can drift.
3. Write a one-worker-at-a-time implementation PR. Keep Vercel cron active until the Mac worker is validated and that individual cutover is approved.
4. Never copy `.env*`, `.vercel`, `*.p8`, Keychain exports, Supabase tokens, auth caches, or raw production data from the old Mac. Provision credentials separately through the owner and the receiving Mac's secure store.

The separate transfer archive contains only a sanitized local example template; Git is the primary source. See [transfer manifest](TRANSFER_MANIFEST.md).

## Paste-ready Codex prompt on the receiving Mac

> Open the private `otemelis/kopa-studio` repository on this Mac mini. Read `docs/MAC_MINI_MIGRATION/START_HERE.md` and all linked handover files, then audit the current `main`, open PR #33, live Vercel schedules and Supabase job state read-only. Prepare the first Mac-native ranking worker as a reviewable local PR with direct external API and Supabase access, idempotent resume, exclusive lease, logs and tests. Do not enable launchd, disable Vercel cron, deploy, mutate production data, or copy old-Mac secrets until I approve that worker's cutover.
