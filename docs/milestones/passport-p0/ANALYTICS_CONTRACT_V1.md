# PASSPORT 1.3 detailed analytics contract v1

**Authoritative Codex/Opus interface. Final for implementation; collection remains disabled.** This document, [the event manifest](analytics_event_manifest_v1.json), generated [JSON Schema](analytics_event_schema_v1.json), and the positive/negative fixtures define one contract. Opus owns all PASSPORT iOS code. Codex has not edited that repository. The existing production `passport_analytics.daily_counts` pipeline remains aggregate-only and is not this detailed tier.

## Release and consent boundary

Opus may implement the client model, local queue, screen/control mapping, fixture tests, and a **default-off** switch now. It must not send detailed events from production or TestFlight until the owner approves the consent flow, privacy policy, App Store disclosures, retention/deletion policy, and server deployment. The user must explicitly opt in before the first detailed event is generated; refusing or withdrawing consent leaves the aggregate pipeline untouched. Withdrawing consent stops uploads and requests deletion of previously uploaded detailed events. Existing daily aggregates must never be converted into fictitious installations, sessions, paths, or retention cohorts.

## Identifiers, ordering, and lifecycle

Each installation generates a random UUIDv4 `install_id` once and stores it in app-private storage. It is app-scoped, not an Apple ID, IDFA, IDFV, keychain-wide device identity, or shared identifier. Generate a fresh UUIDv4 `session_id` on a qualifying foreground session; reuse it for every event in that session, including recovered offline events and the session ending. Generate a fresh UUIDv4 `event_id` once per event and persist it unchanged through retries. `occurred_at` is the actual UTC event time, not upload time; the server records `received_at` separately. Retain local queue order and send events oldest first. A recovered session must keep its original session ID. A missing ending is not proof that the user abandoned the app; the server may infer a timeout only as a separately labeled derived measure.

The envelope is exactly the manifest's `envelope` list. `schema_version` is the integer `1`; `app_version`, `build_number`, `build_channel` (`appstore`, `testflight`, `debug`), `device_layout` (`regular`, `folded`, `unfolded`, `unknown`), `screen_id`, and `control_id` are required. Screen and control identifiers are the fixed allowlists in the manifest, never arbitrary UI text or touch coordinates. `properties` contains only the named enum properties allowed for that event, and every listed event property is required. The schema rejects extra fields and unknown enum values. A session can cross a UTC day; do not change its ID at midnight.

## Event dictionary

The manifest lists every accepted event and the exact property vocabulary. In particular:

| Flow | Events and interpretation |
| --- | --- |
| Lifecycle | `install_started` once for an opted-in installation; `session_started`, `foreground_resumed`, `session_ended`; `screen_viewed`, `control_activated` use allowlisted IDs. |
| Passport use | `cover_opened`, `page_turned`, `stamp_editor_opened`, `stamp_editor_cancelled`, `stamp_created`, `stamp_milestone_reached` with `first`, `third`, or `fifth`. A milestone is emitted once per installation for that count, after a successful save. |
| Stamp attribution | Every `stamp_created` includes a broad `collection_type` and `creation_source`: `manual`, `discovery_manual`, `discovery_inbox`, `flight_import`, or `unknown`. `discovery_manual` is a stamp created after a user-initiated Travel Discovery check; `discovery_inbox` follows acceptance from the suggestion inbox. Neither records the actual place or implies automatic stamping. |
| Journey and import | `journey_opened`, `bookmark_selected`, `share_sheet_opened`; picker/selection/preview/cancel/failure/completion/undo events for flight import. Counts are coarse buckets only. |
| DLC | `edition_viewed`, `purchase_started`, `purchase_completed`, `restore_completed` use allowlisted product keys and client outcome. These are client signals, **not verified transactions or revenue**. |
| Travel Discovery | `discovery_feature_activated`, `discovery_permission_result`, `discovery_check_requested` (manual or passive), candidate created/suppressed, inbox opened, suggestion accepted/dismissed, notification scheduled/opened, false-positive reported. No suggestion content, raw location, destination, or trip date is sent. A suggestion never creates a stamp automatically. |
| Settings/errors | `settings_opened` and `significant_error` with an allowlisted coarse failure code. No error message or arbitrary text. |

## Privacy exclusions

Never put a country/state/airport/park identity, latitude/longitude, precise or coarse location, travel date, name, note, photo, filename, file contents, receipt, transaction ID, arbitrary screen text, or URL into any event field, property, header, or diagnostic log. `collection_type` says only which kind of collection is used. The server must reject unknown names, properties, enum values, malformed IDs, missing fields, and invalid timestamps. TestFlight and debug are stored and queried separately from App Store production.

## Planned transport interface (disabled until privacy approval)

The proposed separate private pathway is `POST /api/passport-detailed-events` on the Kopa collector. It is **not** the existing aggregate endpoint, and is **not deployed or enabled**. Before enabling it, the collector needs service-only database objects, durable deduplication and deletion, an authentication and abuse review, and an approved privacy decision. A future `PASSPORT_DETAILED_EVENTS_ENABLED=1` gate must remain unset in production until those requirements are met. The client uses HTTPS and JSON with a bounded body of at most 50 events and 128 KiB. Body:

```json
{"schema_version":1,"events":[{"schema_version":1,"event_id":"11111111-1111-4111-8111-111111111111","install_id":"22222222-2222-4222-8222-222222222222","session_id":"33333333-3333-4333-8333-333333333333","event_name":"stamp_created","occurred_at":"2026-11-04T18:31:42.123Z","app_version":"1.3","build_number":"14","build_channel":"testflight","device_layout":"regular","screen_id":"stamp_editor","control_id":"confirm_stamp","properties":{"collection_type":"country","creation_source":"discovery_manual"}}]}
```

A future production caller will provide an app-scoped random 256-bit erase token in `X-Passport-Erase-Token`; only its hash is stored server-side. A second token for an existing installation is rejected. The exact client credential and server implementation are remaining integration requirements; **do not embed a server secret in the app**. There is currently no publicly callable detailed-event route.

On an accepted batch, the response shape is `{"schema_version":1,"accepted":["<event_id>"],"duplicates":[],"rejected":[{"event_id":"<event_id>","code":"invalid_event"}],"server_time":"<UTC ISO timestamp>"}`. `accepted` means durably stored; `duplicates` means the same event ID and canonical payload were already stored; a conflicting payload gets `conflicting_duplicate` and is not overwritten. Each input event ID must appear in exactly one result list. A 200 response can contain rejections: Opus must inspect them and never treat HTTP 2xx alone as success. Malformed batch envelopes return 400; disabled collection returns 503; unauthorized callers return 401/403; transient storage failure returns 503 with no false acknowledgment. Retry only unacknowledged events with bounded exponential backoff and jitter; retain rejected events with a diagnostic status until a deliberate discard policy is approved. Never log payloads or IDs.

Opt-out/deletion uses `DELETE /api/passport-detailed-events` with `{"install_id":"<UUIDv4>"}` and the erase token. The server verifies the token hash, deletes that installation's detailed rows, and keeps a short-lived opt-out tombstone so queued retries cannot re-create them. The client stops collection before sending deletion and clears its queue after a confirmed response. Existing aggregate counters are not retrospectively attributable and are not deleted as if they belonged to this installation.

## Compatibility and measurement

Version 1 is immutable once released; incompatible event or property changes require `schema_version=2` and side-by-side acceptance. Unknown versions are rejected, not coerced. Deduplication is by `event_id` and canonical payload hash, across offline retries. Batches with mixed installations are rejected. The server accepts only bounded event time (35 days in the past, five minutes in the future); older offline events stay locally marked rejected, not silently shifted to upload time. Raw detailed rows have a proposed 90-day maximum retention after an approved pruning job is deployed. Until then the detailed tier stays disabled.

Kopa may derive ordered funnels and D1/D7/D30 retention only from consented, production-channel detailed events with complete/mature cohorts and visible sample sizes. Apple Analytics first-time downloads, impressions, page views, Sales units, website visits, Apple Ads delivery, and client purchase outcomes remain separate source definitions. No cross-source person-level attribution is implied.
