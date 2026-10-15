# 15 — Signal Product Analytics contract and implementation

Owner decision: **B · Signal, 15 October 2026**. Implementation is authorized on `codex/signal-product-analytics`, based on `189d42b6`. This specification supersedes the earlier direction-choice gate. The current milestone is a real Next.js development implementation with synthetic data and tested definitions. It does not claim complete live ingestion, production readiness or owner preference over AppFollow.

## What is built

Six core destinations share scope and theme: Overview, Keywords, Apple Ads, Product Analytics, Experiments and Sources. Existing routes and authenticated legacy reports remain available behind a reversible flag. Product Analytics has four views: User journeys, Funnels, Retention & cohorts and Events explorer. Overview links acquisition to the app-specific behavioral view without duplicating its controls.

Light / Dark / System uses independent semantic palettes, before-paint initialization, browser storage keyed by owner and an OS preference listener. This milestone persists locally per owner/browser, not across devices. Both themes share table density, focus behavior, chart grammar and source states. The Signal keyword workbench retains watchlist-left/chart-right at desktop/laptop widths and stacks the chart first when the columns would be too narrow.

## Evidence from the existing telemetry store

A GET-only metadata audit examined the **latest 1,000 `events` rows** and a bounded `event_catalog` listing. It retained field names/counts and event vocabulary, not raw identity/property values. The recent sample spans received dates Oct 3–15: 991 InnerType production rows and nine Pocket Panic development rows; catalog response had 113 rows. All 1,000 had anonymous-install IDs, session IDs, client timestamps and received timestamps; there was no `schema_version` column. The only apparent deduplication candidate is database `id`; uniqueness in these rows does not establish that retries preserve a logical event ID. No invalid client timestamps appeared in this sample. These are bounded findings, not a historical completeness or identity-stability audit.

Observed InnerType vocabulary includes `app_first_open`, `assessment_started`, `assessment_completed`, `result_viewed`, `paywall_viewed`, `purchase_tapped`, `purchase_success`, `session_start`, `session_end` and other assessment/paywall events. Presence confirms names, not their instrumentation semantics or purchase validity. No POIS or LoveType rows appeared in this recent sample; their historical presence remains unknown.

**Live Product Analytics remains gated** because schema/version provenance, stable event IDs, deployed writer behavior, owner/app mapping and complete date partitions are unverified. No historical counts were backfilled, no IDs were merged and no database changes were made. The earlier event-frequency report is explicitly labeled legacy; it no longer presents client purchase properties as verified revenue or missing environment as production.

## App-specific configuration

| App | Preview ordered journey | Return activity | Evidence status |
|---|---|---|---|
| POIS | first_open → onboarding_started → calibration_completed → session_started → session_completed → paywall_seen → trial_started → subscription_active | session_completed | Proposed vocabulary and sequence. Confirm native instrumentation; every preview value is synthetic. |
| InnerType | app_first_open → assessment_started → assessment_completed → result_viewed → paywall_viewed → purchase_tapped → purchase_success | session_end | These names were observed in the recent bounded audit. Their sequence and all preview counts are synthetic. Validate one complete production funnel before connecting. |
| LoveType | first_open → test_started → test_completed → basic_results → premium_paywall → unlock_tapped → purchase_client_signal | test_completed | Proposed vocabulary and sequence. No recent sample evidence; do not manufacture history. |

Definitions are configuration, not app-name branches inside the query engine. Returning sessions are separate from the onboarding entry sequence. Cue usage is a POIS fixture property/event only; it must not imply native support where uninstrumented. Feature adoption segmentation and locale/attribution breakdowns require captured, validated properties before being enabled live.

## Identity, time and normalization

`EventFact` contains app, stable event ID, anonymous installation, session ID, canonical client event time, environment, country, version, schema version and allowlisted properties. No person identity is claimed. Distinct installations use **app + anonymous installation**; session identity uses **app + installation + session**. Missing identities are excluded from the relevant identity-based measure, never replaced with a session/event ID. Reinstalls and multiple devices are not automatically merged into people.

`normalizeTelemetry` is a pure validation boundary, not a connected importer. It rejects unknown app mappings, dev/unknown environments, unvalidated row IDs, missing/invalid client time, absent schema version and missing captured country. There is no silent received-time fallback. Its property allowlist contains locale and cue; arbitrary text, emails, client money values and unknown properties are discarded. Native instrumentation must supply stable event UUIDs across retries and an explicit schema version, or an audited per-writer legacy mapping must be separately defined and versioned. Do not stamp today's schema onto historical rows without evidence.

Queries normalize timestamps to UTC, deduplicate app-scoped event IDs, and sort canonical event times. Date controls are inclusive days, equivalent to `[start 00:00 UTC, day-after-end 00:00 UTC)`. Custom comparisons use the immediately preceding equal-length window. App, market, dates, cohort, definition, horizon, identity, direction and selected series round-trip through the URL. Rapid filter changes use Next-supported native history updates; cross-screen navigation uses Next links. No database migration is needed for this UI checkpoint.

## Journey exploration

Choose starting event, following/preceding direction, two to four transitions, 1/24/168-hour horizon and installation/session identity. Take the first matching start per selected identity within scope and inspect its following or preceding recorded events. Nodes/edges show distinct selected identities; drawers separately explain event frequency. Repeated events do not create extra identities. A clickable and keyboard-focusable node/edge opens evidence, including scope and observation boundaries.

“No next event” means none observed within the selected horizon and available window. It is not a recorded churn event or proof the user closed the app. A first-open path at a short observation boundary is incomplete evidence. Direction is persisted and exported; a reversed chart cannot export a forward path. Aggregate App Store discovery/download reports cannot reconstruct these paths or link to installations without a legitimate attribution key.

## Ordered funnels

Closed, ordered, one conversion per selected identity. A conversion must contain the selected steps in order within the configured time from entry. Repeated starts may provide a valid later sequence but never inflate the denominator. Out-of-order steps and conversions beyond the horizon do not count. An entry without a complete observation horizon is excluded even if that installation happened to convert quickly; this avoids favoring early converters. Step counts, stage conversion, absolute drop-off, median minutes from the preceding step and prior-window counts are shown. Previous windows outside fixture coverage are unavailable.

The configuration panel selects events from the app's vocabulary, removes the last step or resets defaults. Versioned arbitrary event/property builders, per-step daily trend charts, validated attribution/locale segments and production query optimization are subsequent vertical-slice work. The current UI provides exact current/prior step comparisons; it does not claim those larger features are complete. Live incomplete partitions block trustworthy conversion reporting; partial fixtures exist to review disclosure behavior, not to establish a production conversion rate.

## Retention and cohorts

First observed entry event defines the installation's cohort day. Exact D1/D7/D30 retention counts a distinct installation with the app's configured return activity **on that UTC date**, divided by known cohort installations. It is not rolling “on or after” retention. A return event repeated several times counts once. Immature target dates and incomplete cohort/return partitions have null rates. Zero is shown only when the date is mature and the fixture partition is complete. Known fixture history begins Aug 9; a 90-day request therefore discloses incomplete earlier coverage.

The scrollable cohort table includes every non-empty cohort in the selected window, supports cohort selection and evidence drawers, and exports its definition/denominator/maturity. Active installations and app-scoped sessions are separate. New observed installations are those with an entry event in scope; “returning” means active with an earlier observed entry under these fixture rules, not a verified person returning after acquisition. Production definitions need historical entry coverage before this split is trustworthy.

## Events, monetization and annotations

Events explorer searches event labels and exposes event count, distinct installations, sessions, captured app versions/countries and a schema/property drawer. Fixture schema v1 is explicitly synthetic; real events currently have no validated schema version. Acquisition attribution is unavailable. Do not infer source from country, an app open or an Apple aggregate download count.

Client purchase/trial/paywall events describe behavior. Verified proceeds remain unavailable in Product Analytics until App Store/RevenueCat transaction, refund, currency, net/gross and entitlement reconciliation exists. Overview's EUR proceeds are visibly synthetic official-report-shaped fixtures. No client money property enters the normalization contract. Apple Ads uses native EUR/UTC fixtures, explicit tap/view/total attribution, ratio-of-totals CPA, campaign/group/keyword/actual-term scope and suppression caveats. Reported term totals may be lower than campaign totals.

Metadata/release/screenshot timeline markers are sample annotations. Evidence drawers explain coincidence; notes require hypothesis, criterion and evaluation date and persist locally with source scope. These are planning records, with no experiment/ad/metadata launcher. Product's experiment handoff preserves the analysis context. Production annotation ingestion and controlled-experiment result models remain later source work.

## Exports and typed reads

`buildSampleSnapshot` and `snapshotExport` are shared by UI definitions and `/api/signal`. JSON and CSV include app/market, current/prior dates, identity, event definitions, path direction/horizon, sample marker, complete-through date, source and definition version. Rank exports include status/method/depth; Ads exports retain currency, attribution and hierarchy. Failed/empty snapshots contain no observed fact rows. Search on the keyword table does not silently remove plotted histories from export; plotted selection defines the chart export. Event search uses the same label normalization in UI and export.

Example local read:

```text
/api/signal?data=sample&app=innertype&area=funnels&identity=install&period=28d
/api/signal?data=sample&area=keywords&selected=k0,k1&format=csv
```

The sample API is enabled only in development with `KOPA_SIGNAL_FIXTURES=1` and an explicit `data=sample` request. Production returns 404 even if that flag is accidentally present. It has no production credentials or source-query implementation. Non-sample Signal pages still require the existing authenticated owner and show “validated live data not enabled.” Source endpoints for real metrics and future AI require owner authorization, read-only scopes, strict area/definition allowlists, bounded result sizes and source-quality enforcement. An analyst must receive minimized aggregates/evidence IDs, not arbitrary SQL, SDK events or screenshots.

## Engine decision and privacy prerequisites

Prefer a narrow PostHog EU query/export integration trial over implementing a general analytics platform. Retain Kopa's versioned business definitions and independent export parity tests. PostHog's person merging, interval retention, session identity and default funnel behavior must be aligned explicitly; similarly named metrics are not evidence of equivalence. See [14 — feasibility](14_OPEN_SOURCE_FEASIBILITY.md) for pinned code, license, API, privacy, maintenance and pricing evidence.

Before sending any existing telemetry to a new processor: identify controller/processor roles, lawful purpose/basis and applicable consent; minimize pseudonymous fields; review DPA, subprocessors, region/transfers, access and subject-rights workflows. Pseudonymous identifiers can still be personal data. EU location alone does not complete this review. The [European Commission's data-protection guidance](https://commission.europa.eu/law/law-topic/data-protection_en) is the legal-policy starting point; this document does not certify compliance.

Proposed operational policy for review, **not applied**: retain raw normalized events for 90 days by default, retain minimized daily/cohort aggregates only for a documented reporting need, keep source payloads private with short replay retention, exclude free text/IP/replay by default, and define deletion across source, PostHog, Kopa caches, exports and backups. Keep a restricted installation deletion mapping, prevent re-import resurrection, and record deletion completion without retaining deleted identities in general logs. Confirm actual needs, lawful retention and vendor deletion behavior before activation. No production data was deleted or retention setting changed in this phase.

## Milestones and remaining gates

| Milestone | State / evidence | Next acceptance |
|---|---|---|
| Signal direction / six-area specification | Complete: owner decision incorporated into 05, 07, 10–13, 14–15 | No further design-direction choice required |
| Actual Next Signal UI / themes | Development implementation complete for review; flag off by default | Owner laptop task review; automated cross-browser/screen-reader coverage still pending |
| Fixture Product Analytics definitions | Implemented and unit/API tested | Manual live one-app funnel parity before activation |
| OSS feasibility | Actual source inspected; no candidate code imported | Permitted native rank evidence and PostHog account/identity/cost trial |
| M0 preservation / writers | Partial: original checkout/history untouched; GET-only event metadata audit | Verified backup restore, deployed schema/writers/cron and ownership inventory; no live migration until these pass |
| Dependency baseline | Runtime audit zero; dev lint chain risks recorded | Resolve/accept development tooling advisories before release; no forced downgrade |
| Live source vertical slices | Not connected to Signal; no backend rebuild claimed | Known non-empty rank contract; official ASC/Ads parity; complete typed partitions |
| UX3 owner comparison | Not conducted | Same-app/market/date tasks against AppFollow; record interpretation errors, scope loss, time and owner preference |

Further approval is needed only for a concrete destructive production action, new cost or live advertising/App Store operation. Current missing technical evidence is not a request to select a direction again. No production deployment, schema write, account purchase, source-data transfer to PostHog or live operational change occurred.
