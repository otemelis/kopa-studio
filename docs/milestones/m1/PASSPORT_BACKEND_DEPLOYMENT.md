# PASSPORT backend deployment · 16 October 2026

Owner-approved contract applied as hosted migration `20261016065705_passport_replay_receipts`. Existing collector is ACTIVE at version 3, retaining JWT verification. Deployed source matches the reviewed candidate byte-for-byte.

- PASSPORT-scoped backup restored and replay/concurrency/rollback tested in isolated PostgreSQL before deployment; this is not a full-project backup. Deployment baseline matched the saved collector and had zero aggregate rows.
- Private receipt table has RLS enabled. Only postgres owner and existing service_role have privileges. New RPC is SECURITY INVOKER with empty search_path. anon, authenticated and kopa_report_reader cannot read receipts or execute this RPC.
- Original three function definitions/ACLs, three view definitions/options and existing policies are unchanged.
- Live rejection checks: missing JWT returns 401; authenticated empty schema-2 batch returns 400. No accepted hosted fixtures. Aggregate and receipt tables remain empty after probes.
- Prior candidate verification: 22 simulator tests pass; isolated retry 8→8, concurrent retry counted once, payload conflict rejected, storage failures roll back both receipt and counts. Genuine hosted app delivery remains unverified.

Receipts are pruned after subsequent successful schema-2 ingestion using a 45-day threshold; no traffic means deletion waits. Old schema-1 uploads remain additive. Backend deployment alone does not make all counts replay-safe.

Next step: obtain separate approval for a PASSPORT TestFlight/release build containing local commit 81f4648, establish a distinct reporting version (or prove old additive senders cannot share its buckets), then verify genuine app delivery, acknowledgement and retry. No app shipping, release metadata changes or hosted fixture events were performed.

The first migration request expired without changes; a checked retry succeeded. Managed migration service generated the version because the local Supabase CLI is unavailable. No local migration filename was fabricated. HTTP probes used curl with certificate verification after Python's local certificate store failed.
