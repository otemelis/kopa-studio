# 09 — Evidence ledger and audit limits

Date: 2026-10-14, Europe/Berlin. Baseline: `189d42b6d0be441e43a427791e33ebcd01be1ead`. Audit repository source: `/Users/otastemelis/Documents/kopa-studio`.

## Reproducible local checks

Commands below were run in an isolated tracked-source copy, with the already installed `node_modules` copied locally. No `.env`, `.vercel` deployment configuration or credentials were loaded. Node v24.13.1, npm 11.8.0. Network-bound commands needed sandbox escalation; that is an environment constraint, not an application defect.

| Check | Outcome | Saved output |
|---|---|---|
| Tools `npm test` | 30 files / 129 passed | [Vitest output](evidence/vitest.txt) |
| Root `node --test api/aso/_lib/*.test.mjs` | 43 passed | [Collector output](evidence/collector-tests.txt) |
| Tools `npm run typecheck` | Pass | [Typecheck output](evidence/typecheck.txt) |
| Tools `npm run build` | Pass | [Build output](evidence/build.txt) |
| Tools `npm run lint` | Exit 2, missing ESLint flat configuration | [Lint output](evidence/lint.txt) |
| `npm audit --json --ignore-scripts` | 15 affected dependency nodes; 3 critical, 11 high, 1 moderate | [Dependency/advisory summary](evidence/dependency-summary.md) |
| Offline contract probes | Reproduced six semantic issues/paths below | [Probe output](evidence/contract-probes.txt), [audit-only script](evidence/contract-probes.mjs) |

The dependency advisory request was initially rejected by automatic approval review because it exports dependency metadata to npm. The user then explicitly approved it, and the check completed. No unresolved permission request remains. No dependency fix was applied.

## Synthetic contract probes

These intentionally small in-memory fixtures validate code behavior; **they are not observed app metrics or production datasets**. The script mocks every fetch and database call and generates an ephemeral signing key only to exercise the existing parser path. It performs no provider/database writes and prints no key material.

1. A successful HTTP response with an unexpected search schema becomes an empty successful search list.
2. An undated range search-term total receives the caller's fallback date, concealing its multi-day grain.
3. Sales parser returns the per-unit proceeds value; the importer treats it as a total.
4. Reporting summarizer adds amounts without considering currency.
5. Two ASC report instances for one event date, older count 10 / newer 12, produce 22 instead of the required newest-instance count 12.
6. Three sales units at proceeds 1.50 each produce stored proceeds 1.50 rather than 4.50.

These confirm F02/F03/F04/F06/F07 paths. They do not quantify live damage. Repair requires inspecting actual retained records and source revisions in a separately authorized safe data session.

## Runtime smoke check

Started the isolated production Next app at localhost port 4317, without source credentials. Startup succeeded. Anonymous `GET /api/apple-ads/sync/run` and `POST /api/apple-ads/attribution` returned 401; `/unauthorized` returned 200. `/` and `/login` returned HTTP 200 streamed loading shells, while server logs reported missing Supabase environment values. Consequently login, authenticated navigation, owner data queries and real integrations are **not accepted as working**. No browser rendering or authenticated interactive QA was claimed.

The audit test server was stopped after checks. The sandbox initially denied binding and localhost requests; narrow escalation permitted the isolated local smoke test. No production endpoint was invoked.

## Repository coverage and scope

[Complete baseline inventory](evidence/repository-inventory.md) lists all 315 tracked paths and SHA-256 hashes. The review mapped the public site/legacy console, all ingestion mechanisms, modern pages/routes, repositories/services, helper/test families, 19 ASO/Ads SQL migrations, policies, scripts, deployment files and root handovers. Core high-risk collection, parsing, normalization, storage, query and presentation paths were inspected directly with one-based source references in documents 01/02. All tracked files were copied for reproducible checks; this is not exhaustive dynamic coverage of every component.

There are 23 Next page files and 22 route handler files, 30 Vitest files plus 6 collector test files. Migrations were inspected but not applied; no local Supabase stack was installed. Root website/game functionality was inventoried, not fully playtested because it is separate from the requested growth-platform assessment. No performance/load or penetration test was performed.

No applicable AGENTS.md was found in the target repository or checked parent locations. No app code or existing data was modified. Pre-existing untracked support/screenshot work was retained. No git commit/push was made.

## Current relational model

| Group | Tables / key relationships | Migration characteristics |
|---|---|---|
| ASO registry | apps → storefronts, app-keywords → shared keywords/groups; apps → competitors | Unique platform/store ID; keyword unique term/country; cascading child deletes |
| Public evidence | keyword-search-results; keyword-rank-snapshots → keyword; metadata/competitor snapshots, metadata change events | Daily search unique key; rank collection key added preserving legacy IDs; competitor snapshots lack market dimension |
| Metrics and reviews | daily metrics → apps; storefront metrics/report requests → apps; reviews → apps → classifications | Source-aware daily uniqueness; Discovery parser/raw diagnostics added later |
| Decisions | experiments, insights, alert preferences | Threshold/evaluation fields, later insight identity/locale corrections |
| Operations | sync runs/errors, jobs, collection locks, connections/import records | SKIP LOCKED claim and collection lease; no full attempt/reaper lifecycle |
| Paid acquisition | connections → app mappings, campaigns → groups → keywords/negatives; daily metrics, search terms, recommendations/decision snapshots, attribution | Nullable grain uniqueness and application-level lookup/insert; RLS/revokes defined |
| Shared telemetry/auth | analytics_admins, events, analytics_events, event_catalog | Dependencies partly external to the ASO migration chain; clean restore requires more than these migrations |

Chronological migration inspection: initial ASO schema → data integrity/lease → ASC mapping/sales/Discovery → experiment measurement → jobs → Ads connection/campaign/structure/recommendations/attribution/reporting/terms → Ads evidence assessment → Discovery parser integrity → metadata/competitor insight identity → exact locale. SQL and policy definitions are not proof that all migrations/policies exist in production.

## Public research evidence

[Apple source retrieval index](evidence/official-source-index.md) records successfully downloaded public reference URLs and snapshot hashes. Competitor evidence links are attached to each substantive capability in document 03. No login, vendor trial, credit-consuming request or subscription purchase was performed. Some guessed deep URLs returned 404 and were replaced by links discovered from the canonical Apple collection index. Current primary material takes precedence over older vendor/blog descriptions.

Examples of documentation gaps retained rather than guessed: exact general Ads history horizon; account-level Insights eligibility/retention; precise v5 shutdown date; vendor rank accuracy and usage rights; AppFollow current plan table/usable response schema; Sensor Tower account-specific ASO/API pricing; CPP/PPO result-metric API parity; actual RevenueCat integration availability.

## Required future verification

Live deployed commit and cron; database migration/RLS state; restored backup; true source coverage and row counts; actual magnitude of historical data errors; credentials/role/expiry validity; official report reconciliation; organic rank-provider validation panel; authenticated UI; owner usefulness pilot. No passing local build/test substitutes for these gates.
