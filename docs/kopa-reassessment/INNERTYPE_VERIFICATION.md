# InnerType real-data verification — 15 October 2026

This is the review ledger for [16 actual-data integration](16_INNERTYPE_REAL_DATA_INTEGRATION.md). A running local snapshot is available at `http://127.0.0.1:4339/analytics?app=innertype`. No claim of live synchronization, verified people, revenue, full Supabase recovery or production deployment follows from these checks.

## Development checkpoints

- `03f3b780` — actual read-only telemetry adapter, observed-session report/Signal UI and reconciliation tooling.
- `1b89559c` — explicit unvalidated-area navigation and conservative observation-window censoring, with regression coverage.

## Executed automated checks

| Check | Result |
|---|---|
| Bounded Supabase REST GET backup | Two identical reads per table; counts and hashes match at receipt cutoff |
| Isolated PostgreSQL restore | 9,184 events, 32 catalog rows, 109 installs, 38 separate legacy rows; canonical content matches |
| pg_dump → separate verification database | All counts and normalized hashes match again |
| Reader privileges | SELECT true; INSERT/UPDATE/DELETE false; TCP disabled; private Unix socket |
| Vitest | 181 tests, 36 files passed; includes 14 new source/funnel/failure-guard tests |
| TypeScript | `npm run typecheck` passed |
| Production compilation | `npm run build` passed with the new server-only PostgreSQL adapter |
| ESLint | Zero errors; one pre-existing login navigation warning |
| Runtime advisories | `npm audit --omit=dev --json`: zero findings; five pre-existing high dev-lint-chain advisories remain |
| Independent SQL/API reconciliation | Eight scopes passed; current/prior event and session counts, both funnels, daily chart points and previous dates, first journey branches, event table counts, branch conservation and no raw identities |
| Failure guards | Wrong app returns no report; real endpoint rejects sample mode; alternate browser origin rejected; mocked query failure returns 503 with no fixtures/secrets/report; production mode refuses local source |
| Actual browser export | Downloaded scoped JSON exactly equals the API report for the same DE/current-period/quality scope; no raw identity UUIDs |
| Independent source traces | Complete/incomplete × fragmented/unfragmented session examples inspected; meaningful order and relative timings recorded without identity/result values |

SQL integration validation uses `apps/tools/scripts/reconcile-product-snapshot.mjs`; pure contracts/engine tests and endpoint tests are in `apps/tools/src/lib/product-analytics/`. Tests use their own synthetic fixtures; those fixtures are not a data source for the real endpoint.

## Browser walkthrough completed

The actual Next page was inspected in the Codex in-app browser at 1280×720. Both themes were switched through the existing Appearance control. Captured evidence is under `evidence/innertype-real-data/screenshots/`.

- Actual default data: 123 recorded sessions / 4,773 raw event rows. Assessment funnel 63 → 45 → 45, 71.4% observed-session conversion.
- Linked journey branch: 3 sessions next exit an assessment; selecting it reveals 2 with no next recorded step and 1 later completion. This explains the first-entry path versus any-qualifying-attempt funnel difference.
- Event Explorer search for `purchase`: four current-period purchase-success rows / four recorded sessions, and four purchase-tapped rows. Captured-DE filter changes the current period to 249 rows / 7 recorded sessions and shows zero recorded matching purchase events. No region allocation or attribution is inferred.
- Retention/cohort tabs show explicit quality gates in both themes: 107 fragmented sessions and 214 IDs without first opens. No retention chart is substituted.
- Custom date form applied 1–7 January 2026: zero recorded events and explicit “empty observation, not evidence of zero real activity.”
- Selecting unvalidated POIS source removes metrics and disables export; unavailable state explicitly says no metrics were substituted. Reset returns to InnerType. Backend outage handling is unit-tested; no production outage was induced for a screenshot.
- Navigation to Sources shows an explicit unvalidated area without loading production authentication or fixtures; its return link restores actual InnerType observations and the selected theme.
- Snapshot re-read visibly hides previous metrics while pending. Changing filters preserves explicit scope in the URL. The real endpoint rejects `data=sample` and other apps.
- Analysis dialog opens with focused close control; Escape dismisses it. Native modal semantics are used. A full keyboard/screen-reader/cross-browser acceptance audit is still pending; no blanket accessibility-compliance claim is made.
- Evidence export clicked in the browser and downloaded; exact API parity verified afterward. The delivered artifact records aggregate parity only.
- Laptop/mobile layout and no-overflow inspection recorded in the browser evidence JSON. Full daily observations are also available in a native details/table under the chart for exact values and comparison dates.

## Reproduce the local reader

The preview uses **no production Supabase, Apple or advertising credentials**. In this existing development worktree, use the already restored private source configuration:

```sh
cd /Users/otastemelis/Documents/Codex/2026-10-14/files-pasted-by-the-user-kopa/work/kopa-signal/apps/tools
KOPA_SIGNAL_UI=1 KOPA_SIGNAL_LOCAL_READONLY=1 \
KOPA_PRODUCT_DATABASE_CONFIG=/Users/otastemelis/Documents/Codex/2026-10-14/files-pasted-by-the-user-kopa/work/real-data/private/local-db.json \
npm run dev -- --hostname 127.0.0.1 --port 4339
```

The owned preview may already be running. Do not start a second process on its port or restart unrelated servers. The local restored database is a private Unix-socket server with TCP disabled; it must be running before the source query succeeds. A missing database/configuration produces unavailable, never sample data. The configuration is owner-only and uses `signal_reader`; the implementation rejects another user/database or a public TCP host.

To repeat independent reconciliation while that preview runs:

```sh
KOPA_PRODUCT_DATABASE_CONFIG=/Users/otastemelis/Documents/Codex/2026-10-14/files-pasted-by-the-user-kopa/work/real-data/private/local-db.json \
node scripts/reconcile-product-snapshot.mjs
```

The backup extraction and one-shot local restore scripts remain in `work/real-data/` alongside protected raw files outside the Git worktree. They were executed for this checkpoint. Do not rerun restore against an existing database; it intentionally creates new objects. Private archive/dump and two restored databases are preserved for further inspection. A later refresh should create another isolated snapshot, reconcile it, and deliberately repoint the reader, never overwrite this source checkpoint or production.

## Not yet verified or fulfilled

- Supabase managed backup inventory/retention, full production schema/RLS/migrations, actual deployed collector revision and Vercel/cron state. Plugin discovery confirms Supabase enabled, but its query tools are not callable in this running chat.
- Reliable person/device identity, genuine user-level funnels, retention and first-open cohorts. Existing data fails those gates. Native instrumentation changes are specified, not applied.
- Transaction-backed revenue, verified Apple Ads attribution, official ASC/Ads export parity or acquisition-to-product identity joins.
- Continuous authenticated production read adapter, production access regression checks and deployment.
- Owner hands-on acceptance, physical-device instrumentation QA and full cross-browser/screen-reader validation.

Production data/history and unrelated original/native checkout changes remain preserved. The review package contains aggregate evidence and screenshots, not credentials, anonymous/session IDs or source payloads.
