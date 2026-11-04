# Opus handoff: PASSPORT iOS analytics, future release only

**This is a technical specification, not authorization to edit or ship PASSPORT.** Version 1.2 is under Apple review. Do not alter that submitted build. Kopa work is separate. Use [audit/plan](PASSPORT_P0_ANALYTICS_AUDIT_AND_PLAN_2026-11-04.md) and [event/backend contract](PASSPORT_P0_EVENT_AND_BACKEND_CONTRACT_2026-11-04.md) as definitions; this document assigns app-side implementation to Opus after owner/privacy approval.

## Current code to inspect first

- `Passport/App/Analytics.swift`: typed `AnalyticsEvent` and allowlisted properties; `AnalyticsRecord`; `Analytics.track`; `AggregateCounter`; `AggregateUploader`; existing channel and opt-out policy. Preserve the aggregate path until a new path is validated. Later commits `81f4648` and `d8a0df1` added replay-safe batches and acknowledgment validation; verify release coverage.
- `Passport/App/RootView.swift`, `Passport/Book/Onboarding.swift`, `Passport/Model/PassportStore.swift`: launch/background, onboarding, stamp persistence/milestones.
- `Passport/Book/AddVisitSlip.swift`: picker/stamp flow and backup restore. Do not relabel backup restore as CSV import.
- `Passport/Book/NarrowBook.swift`, `Passport/Book/SpreadBook.swift`, `Passport/Journey/JourneyShare.swift`: cover/page/navigation/journey/share calls; share-sheet opening is not proven share completion.
- `Passport/Parks/PassportLibrary.swift`, `Passport/Atelier/Commerce.swift`: DLC exposure, StoreKit client outcomes and restore.
- `PassportTests/PassportTests.swift`, `PassportUITests/AnalyticsJourneyUITests.swift`, `docs/ANALYTICS.md`: extend tests/docs only when app work is authorized.

## Exact implementation slices for a later branch

1. **Privacy decision first.** Review current policy, App Store privacy labels, GDPR/ePrivacy consent basis and analytics Settings copy. Decide whether event-level tracking is opt-in, default-off or permitted under another basis. Keep the existing aggregate opt-out semantics explicit; never silently convert it into permission for longitudinal tracking. Include deletion/reset behavior. No release until signed off.
2. **Identity and lifecycle.** Generate `installation_id` as a random app-scoped UUID, stored only in the app container. Generate a random `session_id` on foreground entry under a documented inactivity boundary. Persist session ID with queued events so a crash/retry does not change historical session membership. Emit `first_launch_observed` once, `session_started`, `app_foregrounded`/`app_backgrounded`, and `session_ended` only when its ending is genuinely observed; otherwise use an explicit unknown/recovered ending. Include UUID event ID, UTC timestamp, app version/build/channel/layout on every event.
3. **Validated local queue.** Append allowlisted event envelope durably before upload; cap size and lifetime. Encrypt at rest if local privacy review requires it. Batch send with unchanged event IDs and per-item acknowledgments. Retry network failures and partial rejections with bounded backoff; never drop accepted items until server acknowledgment is validated. Keep production, TestFlight and debug channels distinct. Never log IDs or payloads to release console output.
4. **Call sites.** Reuse exact existing semantic events where correct. Add screen/navigation IDs, picker stage and cancellation, CSV import stages, collection-type usage, first/third/fifth stamp, first-session path, settings and coarse errors as specified in the event dictionary. Emit stamp milestones only after persisted save and at most once per installation. Use collection *type* only, not destination. Include regular/folded/unfolded/unknown layout from app-observed state. Purchase outcomes are client-side only; do not attach prices as revenue claims. Do not emit `share_completed` unless an actual completion callback is reliable.
5. **Tests and release gate.** Unit-test event/property allowlists, one-time first launch/milestones, session rollover/recovery, queue durability, duplicate/partial ack/retry, opt-out deletion, clock skew and channel isolation. Run controlled simulator journeys and inspect exact event sequences; separately validate physical Duo layout. Compare accepted server counts to controlled sent counts. Only then prepare a **new** TestFlight build; do not affect 1.2 review. Production enablement and privacy disclosure updates require owner approval.

## Hard privacy exclusions

No name, notes, photo data, passport contents, search terms, country/state/airport/park identities, itinerary dates, precise location, imported CSV contents/filename, Apple account/device advertising IDs or cross-app identifiers. UI screen and control identifiers must come from fixed enums, not arbitrary visible text. Installation UUIDs are potentially personal data and must follow the approved retention, consent and deletion policy.

## Interface with Kopa/backend team

Opus should agree on the event contract and acknowledgment JSON **before** app implementation. Backend must be private, schema-versioned and idempotent on `event_id` with payload hash; Kopa must show sample sizes, channel/version/date filters and data-quality state. Existing daily aggregates remain historical aggregate data and cannot be promoted to journeys. The backend table and production collector are **not** implemented in this handoff and require separate approval.
