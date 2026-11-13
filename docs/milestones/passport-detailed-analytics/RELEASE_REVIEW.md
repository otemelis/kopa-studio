# PASSPORT 1.3 detailed analytics — Kopa release review

**Status, 12 November 2026:** Kopa and Supabase release completed with owner approval. The owner explicitly waived the restorable-backup gate. PASSPORT iOS files remain untouched; detailed collection is not enabled in the app.

## Review these production changes before approval

1. Apply [`20261112222558_passport_detailed_analytics.sql`](../../../supabase/migrations/20261112222558_passport_detailed_analytics.sql) to the shared Supabase project `dsjgbxkerucutrjltgws` after making a restorable logical backup. It adds only `passport_analytics.detailed_install_tokens`, `passport_analytics.passport_detailed_events`, their indexes/RLS/grants, and service-role RPCs `public.passport_detailed_ingest` and `public.passport_detailed_erase`. It does not alter `daily_counts` or old RPCs.
2. Deploy the new Edge Function `passport-detailed-events` with `verify_jwt=false`. The route is intentionally token-only because the PASSPORT app has no Supabase user session. It validates every event against the copied v1 app manifest, caps requests at 50 events/128 KiB, hashes the random erase token, and returns exact accepted/duplicate/rejected IDs. The private service key remains server-side.
3. Deploy the updated existing `passport-ingest-aggregates` function with `verify_jwt=true`. Its only change is the additive 1.3 event-name list; the current schema-1/2 validation and RPC routes are untouched. Its `source` validator already accepts the bounded tokens `photo_discovery`, `web_import`, and `bulk_import`.
4. Deploy the Kopa Tools page change. It adds an opt-in section to the existing owner-authenticated `/passport-signals` page. Queries use `kopa_report_reader` in a read-only transaction. Counts and ordered first-use steps appear only when at least five installations support a cell; no event stream or identifier is rendered.
5. Only after the owner authorizes release, Opus can wire PASSPORT's POST endpoint and DELETE call, enable consent in Release, and run TestFlight fixture checks. The iOS repository was not edited here.

## Contract for Opus

- Planned URL: `https://dsjgbxkerucutrjltgws.supabase.co/functions/v1/passport-detailed-events` (deployed).
- `POST`: `Content-Type: application/json`, `X-Passport-Erase-Token: <64 lowercase hex characters>`, body `{ "schema_version": 1, "events": [...] }`. Success: HTTP 200 with `schema_version`, `accepted`, `duplicates`, `rejected`. A conflicting retry is rejected with `conflicting_duplicate`; wrong token is HTTP 403; rate limit is HTTP 429. Invalid events receive `invalid_event` in the 200 rejected list.
- `DELETE`: `X-Passport-Erase-Token` and `X-Passport-Install-Id: <lowercase UUIDv4>`; HTTP 200 `{ "schema_version": 1, "erased": true }`, including an already-erased install; wrong token on an existing install is HTTP 403.
- The client must serialize opt-out deletion after any in-flight POST has finished; otherwise a late POST can recreate a just-erased installation. The current app code does not yet implement the DELETE call. This is a **release blocker** until Opus verifies it with a race test.
- Aggregate stamp `source` tokens remain `photo_discovery`, `web_import`, and `bulk_import`. The PASSPORT app's current 1.3 source vocabulary has not yet added those tokens; Opus owns that client change.

## Measurement and privacy limits

- `passport_analytics.daily_counts` is anonymous and device-local-day based. Detailed events are opt-in, timestamped in UTC, and use random app-scoped installation and session IDs. Do not join their totals as if they were the same population or day.
- The Kopa page can show distinct consenting installations and an ordered cover → onboarding-presented → stamp-created → journey-opened path when cells meet the five-install threshold. The v1 manifest does not provide a distinct name-card or discovery-card step. It does not support a population-wide opt-in rate because aggregate `session_started` is a session count, not distinct active installations.
- Upload duplicate/rejection counts and erasure counts are not persisted by this migration. The UI labels them unavailable rather than zero. Production purchase completions remain client signals, not verified transactions.
- A token-only public route cannot prove that the event came from a genuine app install. The per-install limit is 60 batches/hour; it does not prevent creation of many fake install IDs. Restrict production activation and monitor abuse.
- The app privacy policy and App Store privacy labels need owner review before enabling the detailed stream in Release.

## Local evidence and release gates

- The isolated PostgreSQL migration applied cleanly. Permission checks showed `anon` cannot execute ingest, `service_role` can, and `kopa_report_reader` cannot write. Ingest accepted one app fixture, an identical retry returned duplicate, wrong token was forbidden, erase removed the row, and erase retry succeeded.
- PASSPORT app fixture tests and aggregate 1.2 compatibility tests pass. Kopa Tools typecheck, build, and full test suite pass. No live TestFlight 1.3 event exists to validate yet.
- Before deployment: confirm current hosted aggregate function still matches version 11 baseline; verify a restorable backup of the shared project; review SQL and both function files; obtain owner approval for the schema, permission and deployment changes. Then run hosted fixture checks using debug channel and erase every fixture install immediately. Verify existing 1.2 aggregates and POIS reporting remain unchanged.
- Rollback: revert the Kopa deployment and redeploy the saved aggregate version 11; disable the new detailed route. Do **not** drop detailed tables until an owner-approved retention/erasure decision covers any real opt-in data. A function rollback does not undo accepted detailed events.

## Production validation, 12 November 2026

- Supabase migration ledger records `20261112222558_passport_detailed_analytics`; the filename matches it. RLS is enabled; `anon` cannot select or execute ingest, `kopa_report_reader` can select but cannot insert, and `service_role` can execute ingest.
- `passport-detailed-events` version 1 is active with JWT verification disabled and token authentication inside the function. `passport-ingest-aggregates` version 12 is active with JWT verification enabled.
- Hosted debug fixture: first POST accepted one event, retry returned one duplicate, wrong-token DELETE returned 403, correct DELETE returned 200. Subsequent counts: zero detailed events and zero install tokens.
- PR #25 merged as `68d83a77f190720f7d6c084f62b72acb68af9926`; Vercel production deployment `dpl_8fdn3qnUgu1GnHca1KGYyTo3X3LV` reached READY. The public owner-only page returns Unauthorized without a session. Signed-in visual inspection was unavailable because browser access to the origin was blocked by a saved permission.
- PASSPORT aggregate rows remained 3772 and POIS event rows remained 4456 across the fixture/deployment check. This is a row-count regression check, not a full end-to-end dashboard verification.
- No restorable backup was made. The owner explicitly waived that gate on 12 November 2026. Detailed collection in the PASSPORT release remains blocked on client DELETE/opt-out race testing and privacy/disclosure review.

## Contract clarification, 13 November 2026

- Detailed `stamp_created.creation_source` accepts exactly `manual`, `discovery_manual`, `discovery_inbox`, `flight_import`, `photo_discovery`, `web_import`, `bulk_import`, and `unknown`. The PASSPORT iOS manifest is still owned by Opus and must be updated to match.
- The aggregate collector already accepts every event in brief §3 and the bounded source tokens. Its property validator checks allowlisted property names and token syntax, but does not enforce per-event value enumerations. Version 1.2 production uploads continued after the v12 collector deployment.
- Kopa detailed analytics are at `/passport-signals` on `tools.kopa.studio`, with 7/28-day, build-channel, and detailed-version controls. Several requested §4 measures are unavailable: a valid opt-in rate denominator, name/discovery-card path stages, erasure and upload-health counters. They are explicitly labeled unavailable; no substitute rates or counts are shown.
- The Edge Function code and analytics tables do not store client IP or user agent and do not log either explicitly. Supabase gateway/invocation logs may retain those request headers independently of the function; do not promise that platform logs contain neither.
