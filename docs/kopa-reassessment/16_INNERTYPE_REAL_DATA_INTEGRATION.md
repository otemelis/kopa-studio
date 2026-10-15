# 16 — InnerType actual-data integration checkpoint

Verified 15 October 2026. Development branch: `codex/signal-product-analytics`. Signal appearance is owner-approved. This checkpoint implements a bounded, read-only **actual telemetry snapshot**, not continuously live ingestion or verified user analytics. No production deployment, migration, record mutation, paid integration, Apple Ads change or App Store operation occurred.

## What can be reviewed now

Open `http://127.0.0.1:4339/analytics?app=innertype`. The existing Next application serves actual InnerType event aggregates through Signal's light/dark/system design system. The banner explicitly identifies a read-only snapshot. Date controls, previous-period comparisons, captured-field segments, ordered session funnels, linked journey branches, Event Explorer, source diagnostics and aggregate evidence export work against the restored database. Re-reading the snapshot queries that local database; it does not fetch newer production data.

Default scope: **17 September–14 October 2026, UTC**, all captured regions/versions/languages. Source receipt cutoff: **15 October 2026, 06:40:58 UTC**. The default end is the last elapsed UTC day, not a guarantee of completeness.

| Observation | Default period | Previous equal-length period |
|---|---:|---:|
| Recorded sessions with at least one captured event | 123 | 54 |
| Captured production event rows, retries retained | 4,773 | 2,381 |
| Assessment-entry sessions | 63 | 35 |
| Sessions reaching a matching assessment completion | 45 | 29 |
| Sessions reaching a matching result after completion | 45 | 29 |
| Ordered recorded-session conversion | 71.4% | 82.9% |

These rates describe the observed records. They are not population estimates, person conversion, causal changes, or attribution. Incomplete coverage and late arrivals prevent treating period differences as a proven change in actual use.

The first-entry journey has 63 sessions: 44 next reach assessment completion, 16 have no next recorded meaningful step, and 3 next reach an assessment exit. This differs deliberately from the funnel: the path follows the first entry, while the funnel permits any qualifying assessment attempt inside a session. An exit followed by a later completed attempt can convert in the funnel.

**The original unique-user/retention acceptance criterion is not yet fulfilled.** The evidence does not support reliable person or installation continuity. Those modes remain explicitly unavailable; no historical identities or events were invented.

## Branch, environments, deployments and schema

| Item | Verified evidence | Limit |
|---|---|---|
| Development worktree | Existing repository worktree on `codex/signal-product-analytics`, initially clean at `0adf6fd6` | Local checkpoint; no push/deploy |
| Original checkout | `/Users/otastemelis/Documents/kopa-studio`, `nextjs-migration`, baseline `189d42b6` | Unrelated untracked files and approved screenshot assets preserved |
| Historical Kopa connection | Shared production Supabase project `dsjgbxkerucutrjltgws`; existing service-role REST GET access works | Optional legacy InnerType URL value is not a valid separate URL; no independent dev Supabase project verified |
| New local data environment | Separate PostgreSQL 16.15 cluster; private Unix socket, TCP disabled; database `kopa_innertype` | Reconstructed telemetry schema, not a copy of all managed-project objects |
| Dashboard reader | `signal_reader`: SELECT-only, non-superuser, default transaction read-only; request transactions explicitly read-only | Production source authentication/role deployment remains future work |
| Track endpoint | Shared project's `/functions/v1/track` responds to GET with 405 | This proves reachability only; deployed source revision, JWT settings and environment configuration unverified |
| Collector source | Local InnerType source at `414d5f5`, with existing dirty/untracked changes; read only | Local source is not proof of deployed mobile or edge code |
| Vercel | Local project metadata identifies `kopa.studio` and `kopa-tools`; existing CLI identity's metadata GET returned 403 for both | Deployed commits, active cron and effective production variables not verified |
| Cron configuration | Root `vercel.json` contains `/api/aso/collect`, `30 17 * * *` | Configured is not deployed/executed |
| Supabase plugin | Installed and enabled according to plugin discovery | No Supabase SQL/management tools exposed in this chat; management-only checks remain pending |

REST OpenAPI verified column names/types and exposed PK notes. `events` includes database bigint ID, app/environment, name, anonymous/session UUIDs, platform/version/OS/country, client/receive times and JSON properties. There is **no logical event UUID or schema-version column**. `event_catalog` supplies names/required-property lists; `installs` has app/anonymous ID and attribution fields. Legacy `analytics_events` is a separate schema with different identity fields. Full production constraints, RLS, triggers, migration history and deployed function metadata have not been verified through a PostgreSQL or management connection.

Raw identities, source keys, SQL error details, assessment results, answer values and free-text properties are excluded from the API and delivered evidence. The local preview is gated by development mode plus explicit server flags, loopback Host and same-origin checks. The endpoint returns 404 in production even if the local flag is accidentally set. Normal production pages retain the existing owner-authentication guard. No production service-role key is provided to the preview.

## Backup and restoration evidence

Before UI implementation, REST **GET-only** keyset pagination exported a bounded source copy and repeated the same read. Counts and hashes matched twice at the receipt cutoff. Private artifacts have owner-only permissions and are excluded from Git/deliverables.

| Archived table | Source rows | First local restore | Dump → second isolated restore |
|---|---:|---:|---:|
| InnerType `events` | 9,184 | 9,184 | 9,184 |
| InnerType `event_catalog` | 32 | 32 | 32 |
| InnerType `installs` | 109 | 109 | 109 |
| Separate unscoped legacy `analytics_events` archive | 38 | 38 | 38 |

Every table's canonical content hash matched source → first restore → second restore. Timestamp formats were normalized to UTC microseconds for comparison; data values were not rewritten in production. The restored events contain 9,183 prod rows and 1 excluded dev row. The reader cannot mutate the source tables or read the archived installs/legacy rows. `restore-verification.json` records privileges, counts and hashes.

**This is a scoped telemetry restore proof, not a full Supabase disaster-recovery proof.** REST offers no cross-table transactional snapshot; two identical bounded reads establish stability only for this extraction. The local schema was reconstructed from available migration/type evidence, not a complete dump of live constraints/RLS/roles/functions. Managed backup retention/status, full schema and role restoration remain unverified. Supabase documents separate database backup and restore mechanisms and excludes Storage object contents from database backups; a telemetry export must not be presented as equivalent. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

The working private archive, custom-format PostgreSQL dump, isolated databases and socket remain available locally. No restore targeted production. Do not rerun the original one-shot restore over an existing database. Future refreshes must create a new private archive/isolated restore, reconcile it, and deliberately switch the reader; preserve the current checkpoint.

## Actual telemetry coverage and identity audit

Across all restored prod rows, 12 July–15 October 2026:

| Diagnostic | Observed |
|---|---:|
| Captured event rows | 9,183 |
| Distinct recorded session UUIDs | 234 |
| Distinct anonymous UUIDs | 322 — **not verified users/installations** |
| Sessions containing multiple anonymous IDs | 107 |
| IDs with a recorded first-open event | 108 |
| IDs without a recorded first-open event | 214 |
| IDs with repeated first-open events | 9 |
| Exact-payload duplicate candidates, excluding database ID/receive time | 281 — retained |
| Missing prod session/anonymous IDs | 0 |
| Missing catalog-required properties | 0 existence checks; not comprehensive value validation |
| Observed activity dates | 73; no collection completeness heartbeat |
| Delivery lag median / p99 / max | about 11.45 seconds / 35.6 hours / 6.82 days |
| App versions | 1.1.0 and 1.1.1 |
| Platforms | iOS |
| Session duration sanity | Maximum recorded span 2.07 hours; no session spans 24 hours or multiple app versions/captured regions |
| Client purchase-success rows | 5; no verified transaction join |

No country is relabeled as App Store storefront. The field is a captured country/region code with mixed client/edge origins. All captured source tags in this snapshot are `unknown`; no paid/organic attribution is inferred. There is no authenticated person identifier or identity-link ledger. Legacy events and installs are archived independently and are not joined by timing, session, country or guessed identity.

Missing daily records display gaps, not fabricated zero activity. Event Explorer can show “0 recorded” for catalogued events with no matching rows, with coverage limits beside it. Delivery lag can revise recent periods. No green completeness indicator is invented.

## Metric definitions and safeguards

- **Event count:** raw prod rows at/before the source receipt cutoff, selected by client UTC event time and captured-event filters. Possible duplicates remain visible; there is insufficient logical-ID evidence to delete them.
- **Recorded-session count:** distinct `(app_id, session_id)` with matching records. Different anonymous IDs inside a session are neither multiplied into users nor stitched into a person.
- **Assessment funnel:** closed, strictly ordered `assessment_started → assessment_completed → result_viewed`, same recorded session **and assessment type**, within 24 hours of a qualifying start in the selected period. Each session contributes once per reached step. Later steps may occur after the selected end date within the horizon. Equal-time records cannot establish order. No missing starts are synthesized. There is no assessment-attempt UUID, so type-matched session conversion must not be relabeled as an individual-attempt completion rate.
- **Purchase-signal funnel:** `paywall_viewed → purchase_tapped → purchase_success`, same recorded session, ordered within 24 hours. These are client behavior signals, not verified transactions, currency-normalized revenue, refunds or proceeds.
- **Journeys:** first selected entry in each recorded session; consecutive distinct meaningful events within 24 hours. Question-answer noise and duplicate aliases are excluded. Assessment-entry paths retain the assessment type. Equal-time branches are marked ambiguous. “No next recorded step” is an observation boundary, not proven abandonment. Branch totals conserve recorded sessions.
- **Segments:** captured-event filters apply to **every** selected event/funnel/path step. A language/region/version change may remove later matching steps; the UI states this. Sessions may overlap across segment groups. No cohort-at-entry semantics are implied.
- **Comparisons:** previous equal-length UTC period; chart dates align by offset and tooltip/table identify actual comparison dates. No percent-change assertion is made from sparse coverage.
- **Retention/cohorts:** unavailable under this unversioned identity contract. First observed activity is never relabeled as first open or acquisition. No retention denominator is reverse-engineered from fragmented IDs.
- **Failures:** pending requests hide prior metrics; an error yields an unavailable state and no substitute report. Only an explicitly flagged development demo route can serve fixtures. The real endpoint rejects `data=sample`.

API, charts, visible tables and JSON evidence export share `kopa.product.observed-session.v1`; this is a **report contract**, not an invented version on historical source events. The source remains `legacy-unversioned`.

## Instrumentation changes required

Read-only source evidence: InnerType `src/lib/installationId.ts`, `analyticsClient.ts`, `sessionLifecycle.ts`, `analytics.ts`, `purchases.ts`, assessment routes and `supabase/functions/track/index.ts`. The native checkout was not modified.

1. **Identity initialization:** coalesce concurrent calls around one in-flight persistent-ID promise. The inspected code caches only after awaiting storage, so simultaneous first calls can generate different IDs. This is a plausible mechanism for the observed fragmentation, **not proof of the deployed cause**. Mark storage failures explicitly; never silently substitute an apparently durable identity. Define reset/reinstall semantics. A stable anonymous installation still does not establish a cross-device person.
2. **Event envelope:** assign a cryptographically strong stable `event_id` and real schema version at enqueue time, retained through retries. Validate environment, UUIDs, timestamps and required-property types at the collector. Preserve legacy rows unchanged; start a separately versioned contract at a known cutover.
3. **Idempotent ingestion:** stage and test a new event UUID constraint/acknowledgment protocol before any production migration. The inspected collector inserts a fresh DB row per retry. Catalogue membership alone does not validate property semantics.
4. **Delivery and first open:** acknowledge accepted/rejected records individually. The inspected queue drops the whole batch on HTTP success; a rejected name can be lost. Mark first-open delivery after durable acknowledgment, not before queuing. Current first-open marking can permanently lose the event. Handle queue capacity/age drops as quality signals (currently 500 events / 7 days).
5. **Observation coverage:** receive/client clocks, rejected/dropped/late counts, ingestion heartbeats, app/platform/environment/version and identity-quality markers. Gate mature retention on eligible cohorts and actual coverage, not the existence of a daily row.
6. **Purchase truth:** retain client behavior events but add a reviewed transaction/entitlement reconciliation source with sandbox/production, transaction identity, renewal/refund and native currency semantics. RevenueCat's anonymous identity is not currently linked to the analytics ID; do not guess a join.

Required stage tests: concurrent cold-start identity calls; persistence failure; same-batch/multiple-request retries; partial accepted/rejected acknowledgment; offline first launch and delayed delivery; reinstall/reset; session rotation; schema/env rejection; same-assessment attempt matching; delayed refund/transaction replay. No instrumentation rollout or production constraint has been applied in this checkpoint.

## Existing infrastructure versus PostHog

| Option | Evidence-based advantage | Limitation / cost of proceeding |
|---|---|---|
| Existing Supabase + small read model | Actual retained events and timestamps are available now; bounded aggregates reconcile in SQL; no historical data transfer or new provider required | Identity/queue contract must be repaired; maintaining general-purpose path/cohort tooling ourselves becomes expensive |
| PostHog integration for future data | Dedicated product-analysis engine and established distinct-ID/person processing; reusable SDK/integration rather than importing its whole UI/backend | It still requires valid distinct IDs and trustworthy identify transitions. Current fragments cannot be repaired by changing query engine. Account region, permissions, minimization and budget gates remain open |
| Self-host the full PostHog platform | Control of deployment | Introduces another operating system to maintain before source truth is solved; not justified by this small observed volume or the current milestone |

**Recommendation:** keep the existing historical Supabase source and the small read-only Signal adapter for this checkpoint. Repair and stage the event/identity contract first. Then evaluate a limited future-data PostHog integration behind an adapter if its analysis capabilities reduce ongoing maintenance. Do not build a large custom cohort engine over this broken legacy identity, and do not bulk-import historical fragments with invented identity links. The conclusion that PostHog cannot repair missing identity evidence is an inference from the actual audit and its documented distinct-ID/link model. [PostHog persons](https://posthog.com/docs/data/persons), [anonymous versus identified events](https://posthog.com/docs/data/anonymous-vs-identified-events), [official identify specification](https://github.com/PostHog/sdk-specs/blob/main/openspec/specs/identify/spec.md).

No PostHog project, SDK connection, replay, account purchase, data transfer or paid integration was initiated. The previous ASO Studio/AppRankly feasibility decision in document 14 remains; neither supplies missing InnerType identities or verified purchases.

## Remaining milestones and extension contracts

| Milestone | State / next acceptance |
|---|---|
| Scoped backup and recovery | Passed: two bounded reads, typed local restore, custom dump and independent second restore with content equality |
| Full production schema/deployment/recovery inventory | Pending SQL/management tool availability; verify RLS/constraints/migrations, deployed track version, cron/deployment and managed backups. No source migration until resolved |
| InnerType observed-session UI | Implemented and reconciled for local review; both themes; no fabricated user metrics |
| InnerType stable user/device analysis | Blocked by instrumentation evidence, not UI choice. Versioned future collection and measured identity/coverage gates precede activation |
| Other apps | Reuse report/quality semantics, but validate each app's source mapping, environment, event vocabulary, identity/session lifecycle, backup and SQL parity first. Current API explicitly refuses other apps; no accidental InnerType reuse |
| ASC ingestion | Prepare one app/storefront/report/date contract: native download type/source definition, source timezone, report request/instance/segment identity, newest complete instance, pagination, privacy suppression, completeness and retained raw artifact. Keep downloads, first opens, sales units and proceeds separate; reconcile an official export before switching reads |
| Apple Ads ingestion | Prepare one account/app/campaign/date contract: account mapping, native timezone/currency, daily versus range granularity, tap/view/total attribution and window, revised partitions, pagination and completeness. Reconcile an identical official export; no bid/budget/campaign writes |
| Acquisition-to-product exploration | Only after an independently verified attribution/identity mapping exists. Never join Ads downloads, ASC downloads, first opens and purchases by matching date/country or treating one as another |
| Continuous read-only source | Future authenticated production read adapter/refresh process with query budget, permission and source-health checks; local snapshot is not that service |

The later ASC/Ads ingestion work remains staged after this evidence review, preserving the selective rebuild and historical records. No existing writer was disabled or redirected.

## Validation and review evidence

Evidence directory: `evidence/innertype-real-data/`.

- `source-inventory.json`: REST schema/count inventory and reachability; configuration versus deployed uncertainty retained.
- `backup-summary.json`, `restore-verification.json`: bounded source extraction, content hashes, both restores, reader privileges and full-project limitations.
- `telemetry-audit.json`: aggregate coverage, event/property inventory, versions, first opens and identity failures. Contains no raw identities or result values.
- `reconciliation.json`: independent SQL versus API for eight scopes (default, full observed range, captured US, German language, old version, relationship assessment, purchase funnel, empty period). Checks event/session/purchase counts, every event-table count, current/prior daily points, current/prior ordered funnels, first journey branches, branch conservation and no raw identity serialization.
- `manual-trace-verification.json`: four independently inspected source-session traces: complete/incomplete × fragmented/unfragmented; only event names, assessment type and relative time retained.
- UI evidence/screenshots and executed commands are indexed in `INNERTYPE_VERIFICATION.md`.

The reader role, source mode and production/cross-origin/error guards are tested. Initial checkpoint: 181 tests across 36 files passed; TypeScript and production build passed. Lint has zero errors and one pre-existing login navigation warning. Runtime dependency advisory check returned zero findings; the previously documented five high development-lint-chain advisories remain. See the verification ledger for the final run after review fixes.
