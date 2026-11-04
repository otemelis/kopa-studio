# PASSPORT future event contract — proposal, not deployed

Version 1 proposal for review. It does not reinterpret current anonymous `passport_analytics.daily_counts`. Enable only in a future PASSPORT build after privacy, consent, release and production-schema approval.

## Envelope and validation

Every event: `schema_version=1`, random immutable `event_id` UUID, random app-scoped `installation_id` UUID, random `session_id` UUID per foreground session, UTC `occurred_at`, server `received_at`, allowlisted `event_name`, `screen_id`, optional `element_id`, `app_version`, `build_number`, `build_channel` (`appstore|testflight|debug`), `layout` (`regular|folded|unfolded|unknown`) and allowlisted `properties`. IDs must not derive from Apple IDs, device IDs, accounts, travel records or website cookies. Event IDs survive retries. A reinstall creates a new installation ID. Persist the current session ID with its queued events and mark recovered/background endings explicitly; never guess an ending timestamp after a crash.

`screen_id` and `element_id` are stable code-defined enums; no text labels, query strings, touch coordinates or accessibility contents. Reject unknown event/property/schema values server-side; cap batch size, payload size, timestamp skew and per-install rate. Separate build channels at storage and query time. The client should never transmit names, country/state/airport/park **identities**, individual travel dates, notes, photos, precise positions, import file contents/names, receipt bodies or free text.

## Minimal event dictionary

| Journey | Reuse existing event(s) | New event(s) / property contract | Meaning and denominator |
| --- | --- | --- | --- |
| Install/lifecycle | `app_opened`, `app_backgrounded`, `device_folded/unfolded` | `first_launch_observed` once per fresh install; `session_started`, `session_ended` with `end_reason=background|timeout|crash_recovery|unknown`; `app_foregrounded` if distinct from launch | Observed app installation and foreground session, **not** App Store download. One session ID per bounded foreground session. |
| Screens/navigation | `cover_opened/closed`, `page_turned`, `index_opened`, `passport_library_opened`, `collection_viewed`, `atelier_opened` | `screen_viewed` and `navigation_selected` with fixed `screen_id`, `element_id`, destination screen | Record actual visible screen and user-selected route; suppress duplicate redraws. Avoid every animation frame/tap coordinate. |
| Onboarding | `onboarding_presented`, `onboarding_name_completed/skipped`, `onboarding_completed`, `first_stamp_hint_shown/dismissed` | `onboarding_step_viewed` and `onboarding_step_completed` with fixed step enum if current milestones leave gaps | Ordered same-install path within a defined conversion horizon. No entered name. |
| Stamps | `stamp_editor_opened`, `stamp_collection_selected`, `stamp_destination_selected`, `stamp_confirm_tapped`, `stamp_editor_cancelled`, `stamp_created`, `first_stamp_completed`, `stamp_milestone_reached` | `stamp_picker_opened`, `stamp_picker_selection`, `stamp_picker_cancelled`, `stamp_picker_completed` only if editor events do not uniquely cover picker; `stamp_milestone_reached` values 1/3/5 once per installation | `collection_type=country|us_state|airport|park|unknown`, never identity. Creation means persisted item, not tapped button. Exclude bulk import from organic first-stamp funnel or label separately. |
| Journey/share | `journey_opened`, `trip_opened/closed`, `bookmark_selected`, `share_opened`, `share_format_selected`, `share_image_generated/failed`, `share_sheet_opened`, `parks_journey_shared` | `share_completed` **only if iOS completion callback reliably signals success**; otherwise stop at `share_sheet_opened` | Sharing intent, generated asset and actual completion are different states. |
| Collections | `passport_library_opened`, `collection_viewed`, `parks_passport_previewed/opened`, `park_selected`, `park_stamp_added` | `collection_discovered`, `collection_opened` where absent, fixed `collection_type` | Country, US State, Airport, Park usage by type only; no destination. |
| CSV import | `backup_restore_tapped/finished` are **backup restore**, not CSV import | `csv_import_selected`, `csv_import_previewed`, `csv_import_cancelled`, `csv_import_started`, `csv_import_succeeded`, `csv_import_failed` with `failure_class` enum and bounded row-count bucket only | Distinguish each stage and do not conflate backup restore. No file contents/name, itinerary or dates. |
| DLC/commerce | `edition_viewed/previewed`, `purchase_started/completed/cancelled/pending/failed`, `parks_purchase_started/completed/ended`, `restore_tapped/completed` | Normalize fixed `product_key`; use `dlc_offer_viewed`, `dlc_purchase_completed_client`, `dlc_restored_client` aliases if needed for consistent funnels | Client interactions only. Verified purchase/revenue require separate App Store/StoreKit verification; do not claim client completion is paid revenue. |
| Settings/errors | `language_selected`, `save_failed`, `navigation_fallback`, `atelier_products_unavailable` | `settings_opened`, `settings_option_changed` with fixed option enum, `significant_error` with coarse reason enum | No setting values that expose personal content. Avoid raw exception strings. |

Prefer reusing existing wire names where meaning is exact. The table names missing milestones as proposals; Opus should verify each actual call site before adding one. Avoid event explosion from every navigation redraw.

## Private backend design for approval

Create a **new private** `passport_analytics.events` table only after approval: `event_id uuid PRIMARY KEY`, `installation_id uuid NOT NULL`, `session_id uuid NOT NULL`, `occurred_at timestamptz NOT NULL`, `received_at timestamptz NOT NULL DEFAULT now()`, `event_name text NOT NULL`, `screen_id text NOT NULL`, `element_id text`, `properties jsonb NOT NULL`, `app_version text NOT NULL`, `build_number text NOT NULL`, `build_channel text NOT NULL`, `layout text NOT NULL`, `schema_version smallint NOT NULL`, `payload_hash text NOT NULL`. Index `(build_channel, occurred_at)`, `(installation_id, occurred_at)`, `(session_id, occurred_at)` only after EXPLAIN and storage review. Validate event/property vocabularies in a service-only ingest function; no anonymous browser SELECT. Unique event ID plus payload hash makes replay idempotent and conflicting IDs reject. Acknowledge accepted/rejected IDs individually; persist failed client items for bounded retry. Keep schema-2 aggregate receipt path separate during rollout.

Derived views or queries: distinct installation per step and fixed 24h/7d horizon; session paths ordered by `occurred_at,event_id`; D1/D7/D30 cohort = first accepted `first_launch_observed` UTC date and at least one `session_started` on exact day +1/+7/+30. Only count mature cohorts with upload grace (proposed 48h), report excluded/late/clock-skewed volume. Store event rows for a short reviewed period (proposed 90 days pending legal/privacy sign-off) and aggregate older cohorts without identifiers. Provide opt-out, deletion/reset and internal/TestFlight exclusion. Do not join Apple or Vercel aggregate records to installation IDs.

## Acceptance tests before any production data

1. Offline queue survives termination; retry reuses IDs and server accepts exactly once; changed payload for same ID rejects.
2. Session ID survives queued-event recovery, changes at a real new session, and crash recovery is labeled rather than fabricating an end.
3. Invalid schema/property, personal text, unknown product/collection/screen, skewed timestamp and oversize batch reject cleanly; collector reports accepted/rejected counts.
4. A controlled install yields first launch→onboarding→first/third/fifth stamp order and correct UTC cohort; no prior aggregate data is assigned an ID.
5. TestFlight/debug never enter App Store queries. Opt-out prevents new collection, clears queued events and follows the reviewed deletion policy.
6. Purchase client events remain separate from verified sales; sharing is never labeled completed from sheet opening alone.

Privacy review reference: [Apple app privacy disclosures](https://developer.apple.com/app-store/app-privacy-details/), [EU GDPR legal text](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [EU ePrivacy Directive](https://eur-lex.europa.eu/eli/dir/2002/58/oj).
