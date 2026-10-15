# M1 · PASSPORT telemetry preflight · 15 October 2026

**Local acknowledgement fix tested; exact aggregate telemetry remains NO-GO pending storage deduplication approval.** This is a telemetry decision, not an instruction to delay the 23 October submission. No release, collector or hosted schema was changed.

The hosted collector matches the app repository. Read-only SQL confirms `passport_analytics.daily_counts` is empty. There is no real TestFlight or App Store behavior to display yet. PASSPORT intentionally has no installation/session identifiers: Kopa must show event counts, not distinct users, ordered funnels or cohort retention. Days are **device-local calendar days**, not UTC.

Smallest actual journey: `app_opened(first_use=true)` → `first_stamp_completed` / `stamp_created` → later opens (`days_since_last_open` bucket) → `atelier_opened` → `purchase_started` / `purchase_completed`. These are population-level stage counts, not a linked conversion funnel; the Atelier is an edition shop, not a recorded paywall event. Verified revenue and paid retention are unavailable.

**Working validation:** 11 simulator unit tests pass. An isolated fixture goes through the actual Swift emitter, actual deployed-matching collector and captured SQL functions in a temporary Unix-socket-only local Postgres instance: eight prior-day events stored; today's count withheld; invalid event/schema/channel rejected before storage; storage failure returns non-success; debug and TestFlight buckets separate. The temporary database is stopped. No live write, TestFlight upload or release build occurred.

**Prepared app fix:** `AnalyticsUploadAcknowledgement` accepts only HTTP success plus `ok=true` and an integer row count equal to the submitted aggregate keys. Malformed/false/partial acknowledgements retain local counts. Tests cover the existing uploader retention behavior and strict acknowledgement cases. Local branch: `codex/analytics-preflight-2026-10-15`.

**Blocking defect reproduced:** after a lost response, retrying an identical batch adds its counts again (8 → 16). The live SQL function performs additive upserts and has no replay token. Exact counts require a narrowly scoped per-batch replay receipt, not an installation identifier: immutable upload token persisted with the batch, matching payload hash and row acknowledgement, and an atomic deduplication check in the existing PASSPORT ingest function. This requires an owner-approved payload/storage contract and collector/schema deployment. No hidden identity or new analytics platform should be introduced.

Further limitation: queued days are stamped with the channel/version at upload, not at collection. An upgrade or move between distributions can relabel unsent aggregates. Do not claim release-version or environment provenance for historical queued counts across that boundary. Fixing the on-device bucket metadata can be prepared locally; shipping remains approval-gated.

Evidence: [verification](verification.json), [event matrix](event-matrix.json), [small source contract](passport-source-contract.json). Eight journey events are observed **only in isolated tests**; other declared events remain emitted-but-not-validated. Absent capabilities stay explicit. Next: approval-gated replay protection and an authorized future build round trip; meanwhile continue independent M0/M2 work.
