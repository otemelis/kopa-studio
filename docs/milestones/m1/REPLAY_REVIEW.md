> Update 16 October: approved backend deployed and verified. App shipping remains gated. See PASSPORT_BACKEND_DEPLOYMENT.md.

# PASSPORT replay-safe analytics — review checkpoint, 16 October 2026

**Local candidate verified; no hosted schema, collector, submission or release changed.** The actual counter/outbox, collector and receipt SQL now pass a lost-response retry without inflating totals: **8 → 8**, including concurrent database retries. This does not block the 23 October app submission; deploying or shipping the candidate remains an owner decision.

## Prepared change

- New app uploads use schema 2. A random UUID identifies **one batch only**, is persisted with its immutable payload before transport, survives restart, and rotates for the next batch. There is no person, device, installation or session identifier.
- Counts carry the channel/version captured at collection. Today stays local. Same-day TestFlight/App Store or version buckets are never mixed into one upload.
- Acknowledgements must bind the batch UUID, exact transmitted-body SHA-256 and complete aggregate-key row count. Only then does one atomic local write subtract the exact sent counts and clear the pending batch. New counts survive; failed disk writes and stale acknowledgements do not clear them.
- The app uses `analytics_daily_v2.json`. The original analytics file stays unchanged during normal upgrade. Unknown-provenance legacy counts are preserved locally and withheld rather than assigned invented version/channel metadata. Both queues honor the existing 35-day pruning when the app runs; an explicit sharing reset clears both analytics queues, without touching passport content. Unreadable/future-version state blocks upload instead of being overwritten.
- The candidate SQL adds **one private `passport_analytics.upload_receipts` table, one creation-time index and one service-only `public.passport_ingest_batch(jsonb)` RPC**. The receipt stores UUID, server-canonical payload hash, acknowledged row count and creation time. Receipt insertion and additive count storage share one transaction; a conflict with different content is rejected, and a storage failure rolls back both.
- RLS stays enabled. `anon`, `authenticated` and `kopa_report_reader` get no receipt/RPC access; only the existing server `service_role` can use them. The RPC is `SECURITY INVOKER`, with an empty search path. No schema exposure, new credential, login or provider is needed.
- Proposed receipt pruning threshold: **45 days**, executed after successful schema-2 ingestion; there is no new scheduler. With no further ingestion, physical deletion waits for subsequent traffic. Payloads older than the accepted 41-day window are rejected before a pruned token could reapply an old batch.

The existing endpoint keeps schema-1 compatibility for old binaries. **Schema-1 uploads remain additive and are not retroactively deduplicated.** The new app has no fallback to that protocol. Do not call every hosted count replay-safe merely because the backend was upgraded. At app release, establish a distinct reporting app version or otherwise verify that old additive senders cannot mix into the same version/channel/day. This candidate does not change marketing versions or release metadata.

## Evidence

**22 simulator analytics tests pass** on the dedicated `PASSPORT analytics preflight` simulator, separate from the user's booted simulator. Coverage includes restart/retry, exact snapshot subtraction, matching hashes, stale acknowledgements, acknowledgement disk failure, mixed provenance, unknown legacy counts, unreadable state, consent reset and retention. The standalone probe also executes the real Swift code and emits a schema-2 fixture; its transport never contacts production.

A fresh read-only scoped snapshot captured the existing table DDL/data, six constraints, indexes, three views, three function definitions, RLS policy and grants. It was restored in a disposable local PostgreSQL instance before exercising the candidate. The actual collector and SQL passed concurrent replay, changed-payload rejection, rollback/retry, invalid input rejection, environment separation, service-role access, denied browser/reader access, expired receipt cleanup and exact raw-body acknowledgement hashing. The local cluster used a private Unix socket with no TCP listener and was stopped/removed afterward. This is a **PASSPORT-scoped snapshot/restore**, not a full-project logical backup.

Fresh hosted inspection: **zero aggregate rows**; no receipt table or schema-2 RPC yet. Deployed collector version 2 matches the original source SHA-256 `5e5f3241cb775b9dbbf8c562d2cfb5fe889a5616463401529a564621a0a7bebc`, with JWT verification enabled. Hosted writes/tests: **zero**. Existing original app checkout remains unchanged; all changes are on the isolated development branch.

## Exact approval gate and next step

Roadmap rule 8 requires approval before changing live PASSPORT schemas, collector deployment or analytics contracts. Review the candidate SQL, collector and patch, then approve **backend only**: recheck the source/snapshot for drift, create the receipt objects with the scoped service-role grants and deploy the updated existing `passport-ingest-aggregates` collector **with JWT verification kept enabled**. Preserve existing aggregate records, old schema-1 RPC, environment settings and reader access. No hosted fixture events, app release, TestFlight upload or App Store change is included.

After backend verification, a separately approved future app build can provide the real TestFlight round trip. Until then, Kopa keeps PASSPORT's absence of qualifying data explicit. The source remains aggregate event counts on device-local days: no exact users, linked funnels, retention cohorts, verified purchase revenue or revenue attribution is introduced.

Rollback: the old collector source and scoped snapshot are saved privately. Reverting the collector would make schema-2 clients retain/retry rather than silently use the additive path; coordinate that decision before any app ships. Do not drop receipt history or merge old/new on-device queues as a routine rollback step.
