# PASSPORT Apple Analytics recovery — release readiness, 4 November 2026

**NO-GO for live execution yet.** The code and local database transaction pass, but the exact candidate has no Vercel preview deployment and a restorable managed production backup was not independently verified. The Supabase backup console was unavailable to this session. Neither a production SQL change nor a deployment nor a backfill has been run.

## Exact targets and baselines

| Target | Verified identity | Current production baseline |
| --- | --- | --- |
| Supabase | `innertype`, project `dsjgbxkerucutrjltgws`, region `us-east-1`, PostgreSQL 17 | Active/healthy; PASSPORT Apple ID `6822753543`, Kopa app UUID `926ad3c6-c68d-4b70-9dd0-c0073916d771` |
| Kopa reporting collector | Vercel `kopa.studio`, project `prj_fImvXjjPtOD5xO7DFDKgntwC2kRg`, team `team_YZN5tQECK9yBH6kFQ54p5Ejw`, domain `www.kopa.studio` | READY deployment `dpl_GxeY2pLRv7eN4mizD2JmeZ1CqvnP`, Git SHA `1dfd71584880826b2bf97b6e099eb4d3cb31da65` |
| Kopa owner UI | Vercel `kopa-tools`, project `prj_df7OUySAvxdLfTRviLgimqcQcnfb`, same team, domain `tools.kopa.studio` | READY deployment `dpl_FQ7hZJUXp4FF3zYJKhPQ8K22y58A`, Git SHA `988f5373da1b2c8c37aaedaa289b96a84af532e3` |

The candidate branch is `codex/passport-analytics-recovery-2026-11-04`. The collector baseline was fetched read-only and the proposed collector files compared; unrelated branch files must not be deployed to `www.kopa.studio`. The `tools` production SHA matches the candidate's mainline base.

## SQL, access, and scope

The [reviewed SQL](REPLACE_ANALYTICS_PARTITION.sql) has **not** been applied. It creates only `public.aso_analytics_partition_state` and `public.aso_replace_analytics_partition(jsonb)`. The new table has RLS enabled; `PUBLIC`, `anon`, and `authenticated` grants are revoked, and the service role alone is granted table access and function execution. The function is `SECURITY INVOKER` with an empty search path and accepts **only** PASSPORT's UUID, Discovery or Downloads, and report dates no older than 35 days. It serializes each PASSPORT date/source partition, rejects stale or conflicting revisions, and replaces only that partition. Isolated PostgreSQL tests verified an older row's removal, changed counts, idempotent replay, non-PASSPORT rejection, service-only grants, and RLS. Production `service_role` has `BYPASSRLS` and the existing two metrics tables' DML grants; their existing authenticated admin read path is unchanged. There is currently no replacement RPC or state table in production.

The collector retains the legacy upsert path for POIS and other mapped apps. The new RPC path is selected only for PASSPORT. Scheduled maintenance cannot auto-create the PASSPORT request mapping before the controlled owner backfill; after mapping, normal refresh can include it. A bounded owner action requires the exact PASSPORT Apple app ID and dates. This is covered by a regression test; no claim is made that POIS's normal, independent Apple refresh will cease.

## Bounded backfill and reconciliation

The proposed first import is **29 October–3 November 2026**, six Apple Analytics `Date` values in UTC, using existing approved ONGOING request `1a1002c3-3a07-4d10-afca-6352b89790d5`. A fresh read-only Apple dry-run selected **12 app/date/report-source partitions**, **515 source rows across revisions**, and **254 latest Discovery source rows**. Expected new records: **154 Discovery + 23 Downloads = 177 storefront rows**; **87 Discovery + 18 first-time Downloads = 105 daily country rows**. Current PASSPORT Analytics rows in that window: **0** in each table; current PASSPORT Sales rows: **17**, left untouched. For 3 November, the selected 4 November revision has **104 impressions, 80 product-page views, 2 developer-page views, and 36 first-time downloads**. [Evidence](evidence/passport-apple-dry-run-2026-11-04.json) retains per-partition checksums and source-type totals. These counts are a preflight expectation, not permission to force a match if Apple publishes a newer revision; re-run the dry-run immediately before import and reconcile to that selected revision.

Before/after POIS control for the same window: **72 storefront rows**, checksum `7f3c8388bcf971fded464a73f240ad53`; **60 daily rows**, checksum `589aa209a58ea46078590e6aeffda5bb`. Verify these again immediately before and after the scoped backfill. Other apps' baseline counts/checksums are in the SQL audit record; the PASSPORT RPC cannot select their app IDs.

## Backups and rollback

The production target partitions are currently empty and the PASSPORT request mapping absent; the 17 existing PASSPORT Sales rows are outside the proposed mutation. This gives a simple **scoped logical rollback**: revert both Vercel deployments to the IDs above; remove only PASSPORT Discovery/Downloads rows for the approved dates and the newly created PASSPORT request mapping/state rows, after taking a new read-only snapshot and checking no subsequent valid data was ingested. Leave Sales, POIS, and other apps untouched. The SQL change can remain inert during a code rollback; dropping it would be a separate reviewed operation. The isolated fixture proves the partition replacement/rollback logic, but is **not** a restore of an actual production backup.

Production `archive_mode=on` and WAL push are configured, but that is **not proof of a restorable managed backup**. The owner should confirm a current successful Supabase backup/restore point and retention in the dashboard, or authorize a verified scoped logical export and isolated restore before live changes. Do not claim backup verification from WAL settings alone.

## Preview and exact execution order after separate authorization

Local Next production build, 254 UI tests, 77 ASO library tests, 19 focused importer/contract tests, and isolated PostgreSQL assertions pass. **No remote preview for this candidate was deployed**, because the owner's current instruction bars deployment until approval. A protected preview and smoke check of `/passport-signals` plus the collector route are outstanding. The unrelated repository-wide ASO capacity test and POIS lint error predate this change; neither is in the scoped diff.

1. Verify managed/scoped backup and restore, refresh the read-only Apple dry-run, and capture current PASSPORT and POIS counts/checksums and the two Vercel production deployment IDs.
2. Build a scoped preview from the current `www.kopa.studio` baseline containing only `api/aso/_lib/appstore-analytics.js`, `api/aso/appstore-connect.js`, and `api/aso/collect.js`; build a separate `kopa-tools` preview containing only `apps/tools/src/app/passport-signals/page.tsx` and `apps/tools/src/repositories/aso-progress-repository.ts`. Validate protected preview behavior; no live source writes.
3. After explicit production authorization, apply the reviewed SQL to Supabase; verify RLS, grants, function owner/invoker, and that `anon`/`authenticated` cannot execute it.
4. Deploy the scoped collector to Vercel project `prj_fImvXjjPtOD5xO7DFDKgntwC2kRg`; verify its production baseline and route health before any import.
5. Invoke the owner-only PASSPORT scoped `sync_analytics` action with `appId=6822753543`, `start=2026-10-29`, `end=2026-11-03`. This creates the existing-request mapping and replaces only the six bounded PASSPORT date partitions.
6. Reconcile all 12 partition hashes, date/source rows, page types, source types, and aggregate totals to the latest Apple revision; confirm POIS controls and PASSPORT Sales are unchanged. If the Apple report has revised, use the refreshed dry-run's counts rather than the old expectation.
7. Deploy the scoped `kopa-tools` PASSPORT acquisition page to project `prj_df7OUySAvxdLfTRviLgimqcQcnfb`; verify owner-only rendering, UTC period/source labels, unavailable states, and actual imported counts.

The proposed [1.3 detailed-event contract](ANALYTICS_CONTRACT_V1.md) remains a shared Opus reference only. No event-level table, PASSPORT iOS change, privacy switch, or app release is part of this action.
