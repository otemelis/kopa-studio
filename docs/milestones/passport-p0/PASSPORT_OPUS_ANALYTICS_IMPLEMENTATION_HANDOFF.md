# PASSPORT 1.3 analytics handoff for Opus

This is the iOS implementation handoff. Codex has not changed the PASSPORT app repository. The authoritative event names, fields and allowed values are in [ANALYTICS_CONTRACT_V1.md](ANALYTICS_CONTRACT_V1.md) and [analytics_event_manifest_v1.json](analytics_event_manifest_v1.json); [analytics_event_schema_v1.json](analytics_event_schema_v1.json) and `fixtures/` are executable examples. Do not invent additional event fields or raw payloads.

## What to implement now in PASSPORT

1. Add a **default-off** detailed analytics switch. Keep the existing aggregate daily-count telemetry operating independently. No detailed event may be generated or uploaded before explicit opt-in; do not ship the switch enabled in 1.3. Build the consent UI and privacy text as reviewable work, but do not activate collection until the owner approves the privacy policy, App Store disclosure, consent behavior and backend release.
2. Generate one random app-scoped UUIDv4 `install_id` at first opt-in, one UUIDv4 `session_id` per foreground session and one UUIDv4 `event_id` per event. Persist event IDs, original UTC `occurred_at`, and session IDs through backgrounding and offline retries. Do not use IDFA, IDFV, Apple ID or a shared device identity. Store a separate random 256-bit erase token locally for the future deletion request; never log it.
3. Produce the exact required envelope in the contract. Map screens and controls to the manifest's stable allowlists. Every event-specific property is required; no arbitrary UI strings, touch coordinates, URLs, places or trip dates. Use `unknown` only where the manifest permits it. Keep `appstore`, `testflight` and `debug` distinct.
4. Instrument ordered lifecycle, onboarding, cover/page, stamp editor/create/milestones, Journey, import, DLC, Settings and Travel Discovery interactions listed in the manifest. Record a stamp milestone once per opted-in installation after the first, third and fifth **successful** saves. `stamp_created.creation_source` must distinguish `manual`, `discovery_manual`, `discovery_inbox`, `flight_import` and `unknown`; discovery never silently creates a stamp. `purchase_completed` is a client signal, not verified revenue.
5. Persist an offline queue in app-private storage, send oldest events first in batches of at most 50 events/128 KiB, and retain original IDs/time through retries. Treat a 200 response as partial: remove only `accepted` and `duplicates`; inspect and retain `rejected` for diagnostics. Retry unacknowledged events with bounded exponential backoff and jitter. A conflicting duplicate is never silently accepted. Do not rewrite old timestamps to upload time.
6. On consent withdrawal, stop collection and uploads immediately. Once the endpoint exists, send `DELETE /api/passport-detailed-events` with `install_id` and the erase token, then clear the queue after confirmed deletion. Before the endpoint exists, keep the detailed switch off in released builds, so there is no remote detailed data to erase.

## Exact transport to implement against

The planned `POST /api/passport-detailed-events` accepts `{"schema_version":1,"events":[...]}` over HTTPS. Each item is the manifest envelope; `X-Passport-Erase-Token` carries the installation's erase token. Successful response: `{"schema_version":1,"accepted":["event-id"],"duplicates":[],"rejected":[{"event_id":"event-id","code":"invalid_event"}],"server_time":"UTC timestamp"}`. An event ID appears in exactly one list. `400` means malformed batch, `401/403` unauthorized, `503` disabled or transient server failure. The route is **not live**. Do not point a release build at an aggregate collector as a substitute and do not embed a server credential. The future authentication mechanism must be agreed with Codex before enabling uploads.

The planned `DELETE` body is `{"install_id":"UUIDv4"}` with the same erase-token header. A deletion confirmation is required before treating remote erasure as complete. The 35-day past/five-minute future server time bound means the client should flag expired queued events instead of relabeling their occurrence time.

## Privacy boundary

Detailed events must never include country/state/airport/park **identities**, coordinates, location, trip dates, names, notes, photos, file contents, filenames, receipts, transaction IDs, raw UI text or URLs, including in diagnostics. `collection_type` is only the broad type (`country`, `us_state`, `airport`, `park`, `unknown`). Discovery uses coarse source, confidence and suppression enums only. Keep production and TestFlight separate in the envelope and in local QA.

## Opus acceptance tests

- Validate every emitted event against the supplied JSON Schema and positive/negative fixtures; unknown event/property/enum, missing property and forbidden geography fail.
- Simulate termination/relaunch with queued events: IDs, timestamp, order and the recovered session ID stay unchanged.
- Simulate HTTP 200 with one accepted, one duplicate and one rejected event: only accepted/duplicate leave the queue; no whole-batch success assumption.
- Simulate offline upload, timeout, duplicate replay and conflicting duplicate; backoff is bounded and no payload or token enters logs.
- Verify first/third/fifth milestones fire once after successful saves, and manual check versus inbox acceptance produces the correct `creation_source` without an automatic stamp.
- Verify TestFlight and App Store envelopes are different; opting out stops collection before any deletion call; no detailed event is sent with the switch off.
- Confirm the existing aggregate collector behavior and PASSPORT 1.2 review build remain unchanged.

## Work that waits for a separate decision

The owner must approve consent/privacy disclosures, detailed-data retention and deletion, then Codex must deploy a private service-only store and authenticated ingest/delete route before Opus enables uploads. The required server integration is: validate the generated schema and bounded batch/time; atomically persist event IDs and canonical hashes; acknowledge exact duplicates but reject conflicting duplicates; associate installation/session/timestamps; enforce 90-day raw-row retention; validate an erase-token hash, delete installation rows and temporarily block replay with a tombstone. It must reject mixed-installation batches, separate build channels, avoid payload logging, and expose no browser read grants. These pieces are **not production-deployed**. Until they are complete, this handoff authorizes only client-side implementation behind the default-off switch.
