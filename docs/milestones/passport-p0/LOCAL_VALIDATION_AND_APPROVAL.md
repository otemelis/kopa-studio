# PASSPORT 1.3 Codex checkpoint and production gate

## Local validation

The official App Store Connect dry-run covered report dates **29 October–3 November 2026 UTC** using the approved PASSPORT Analytics request. It selected 12 complete date/source partitions across Discovery and Downloads, 515 source rows across revisions, and 254 latest selected rows. Kopa had **zero** PASSPORT Analytics rows in the two reporting tables before the dry-run. Proposed output is 177 storefront rows and 105 daily country rows. The [read-only evidence](evidence/passport-apple-dry-run-2026-11-04.json) records Apple processing dates, segment checksums, selected totals, and before/after import keys. No production row was written.

For **3 November** the selected Apple revision (processed 4 November) has **104 impressions**, **80 product-page views**, **2 developer-page views**, and **36 first-time downloads**. The 36 downloads are Apple source types Web referrer 25, App Store browse 4, App referrer 4, and App Store search 3. The earlier diagnosis called 82 views “product-page views”; that was the sum of all page types and is corrected in the source report. Sales and Trends reported 52 app units for its own Pacific Time report day; it is a different measure and must not be forced to equal Analytics first-time downloads. No impression→download person funnel is inferred from these aggregates.

The importer now builds one complete app/date/report-source partition from the newest Apple processing revision and uses one database transaction per partition. The review-only [SQL](REPLACE_ANALYTICS_PARTITION.sql) provides serialized, idempotent, date-bounded replacement so rows removed by a revised Apple report disappear without deleting another app or date. Same-revision hash conflicts and older revisions fail closed. [Local SQL fixtures](LOCAL_REPLACE_PARTITION_TEST.sql) and [assertions](LOCAL_REPLACE_PARTITION_ASSERT.sql) exercised changed, removed, replayed, stale, and cross-app rows in an isolated PostgreSQL 16 database. JavaScript importer and contract tests pass. A header-only zero-row Apple report cannot identify a specific empty report date; this remains unavailable rather than an inferred zero.

The deployed `passport-ingest-aggregates` function is version 9 with JWT verification enabled. Schema 2 has transactional batch receipts and replay handling; the submitted 1.2 client still sends schema 1 and treats any HTTP 2xx as success. The collector can return HTTP 200 with `rejected > 0`; that client can delete rejected local counts. Opus must fix response parsing and retry tests in PASSPORT; Codex must not edit that app. The collector's property validator checks allowlisted names and token syntax, not the proposed detailed event-specific property vocabularies. The proposed detailed schema is separate and has not been deployed.

## Separate owner approval required

The archive's `00_READ_FIRST_COORDINATION.md` directs Codex to stop before production gates; the user's PASSPORT scope restriction says: “Do not deploy Kopa, modify production databases, change Apple configurations or run production-data backfills without separate authorization.” The following are **not authorized by this checkpoint**:

1. Apply the reviewed table/RLS/grants and `aso_replace_analytics_partition` RPC to production Supabase.
2. Deploy the importer and PASSPORT acquisition UI to the relevant Kopa/Vercel projects after baseline and preview checks.
3. Run a bounded PASSPORT Analytics backfill, then reconcile each imported app/date/source partition against Apple and test page views by page type.
4. Enable event-level collection, alter PASSPORT iOS, or ship version 1.3. Those need separate design/privacy and release decisions.

Deployment order after approval: verify current baseline and backup; apply SQL; verify service-role-only execute and RLS; deploy importer; dry-run again; import bounded complete dates; reconcile row totals and removal semantics; then enable the read-only UI. Roll back by reverting the deployment and restoring only the backed-up PASSPORT report partitions and mapping if needed. Existing POIS and other apps' partitions must remain byte-for-byte unchanged. Approval must identify the production project(s) and exact window at execution time; the SQL's 35-day bound may require a newer window if approval is delayed.
