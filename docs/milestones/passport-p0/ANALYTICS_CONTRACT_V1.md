# PASSPORT detailed analytics contract v1 — proposed, not deployed

This is the Codex/Opus handoff for version 1.3. The machine-readable [manifest](analytics_event_manifest_v1.json), generated [JSON Schema](analytics_event_schema_v1.json), and [fixtures](fixtures/) are the normative proposed interface. Opus owns all PASSPORT iOS changes. Codex has not changed that repository or deployed a detailed-event collector.

The existing production pipeline is **aggregate-only**: schema-1 daily counts in `passport_analytics.daily_counts`, with no installation, session, or event identifiers. The deployed collector also accepts schema 2 for idempotent aggregate batches, but the submitted 1.2 client uses schema 1. Neither is this detailed-event contract. Its 147-item aggregate catalog is not automatically promoted into detailed events.

For a future, separately approved detailed tier, send only allowlisted envelope fields and properties. `install_id`, `session_id`, and `event_id` are random app-scoped UUIDv4 values; an event ID is stable across retries. `occurred_at` is UTC; the server separately records receipt time. `build_channel` partitions App Store, TestFlight, and debug. Unknown event names, properties, enum values, malformed IDs, or impossible timestamps must be rejected with an explicit per-event outcome, never silently counted as accepted. A 2xx transport response is successful only if all expected event IDs are acknowledged, or each rejection is explicitly handled. A duplicate event ID with identical content is acknowledged as duplicate; conflicting content is an error. Uploads are offline-persisted and retried with bounded backoff, without dropping unacknowledged events.

No implementation or production collection follows from this draft. Detailed collection defaults **off** pending a user/owner consent and privacy decision. The manifest intentionally excludes locations, travel dates, country/airport identities, names, notes, photos, file contents, transaction IDs, and receipts. `collection_type` records only broad categories. Retention cohorts are computed from mature install-scoped sessions only after coverage is proven; existing aggregate rows cannot be backfilled into identities or ordered paths.

The contract tests validate representative positive and negative payloads using the JSON Schema. They do not prove client/server compatibility until Opus implements a matching client, Codex builds an isolated collector, and their shared fixtures pass end to end.

## Current-to-proposed boundary

| Current observation | Future detailed event | Caveat |
| --- | --- | --- |
| `app_opened` daily count | `install_started`, `session_started`, `foreground_resumed` | Cannot convert historical opens to installs or sessions. |
| `first_stamp_completed` count | `stamp_created`, `stamp_milestone_reached` | Future milestones require an install-scoped counter. |
| `flight_logged`/import counts | `flight_import_*` | No file content or individual journey records. |
| Purchase-related client counts | `purchase_started`, `purchase_completed`, `restore_completed` | Client outcomes are not verified revenue. |

For 1.3 Travel Discovery, record only feature activation, coarse permission outcome, candidate lifecycle, inbox use, and acceptance/dismissal. Suggestions never create stamps automatically. No actual suggestion content or underlying place is an analytics property.
