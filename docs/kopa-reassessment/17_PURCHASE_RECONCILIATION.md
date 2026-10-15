# 17 — Purchase discrepancy: demo confusion and legacy row truncation

Verified 15 October 2026. Owner scope: **28 days, all markets**. Work is on `codex/signal-product-analytics`; no production deployment, record changes or paid integration occurred.

The screenshot showing **24 purchase successes is generated demo data**. The screenshot showing **1 purchase success is reproduced exactly by the legacy reader's truncated source response**. Neither screenshot establishes the number of actual paid Apple transactions.

The earlier explanation that the current dashboard uses actual data was too broad for the multiple open versions. It applied to the actual InnerType snapshot at port 4339, not the design demo. Generated metrics have no evidentiary value for real purchases. The new labels make that distinction explicit within panels and browser tabs.

## Three different surfaces

| Surface | Source | Purchase-success value | Meaning |
|---|---|---:|---|
| Archived design gallery, port 4337 | Static captures of generated fixtures | 24 in the supplied image | Synthetic example; no Supabase query |
| Explicit interactive demo, port 4338 with `data=sample` | `buildSampleSnapshot` / `productFixture` | 24 in the reproduced fixture scope | Synthetic example; no payment evidence |
| Actual InnerType review, port 4339 | Isolated read-only PostgreSQL restore of actual Supabase telemetry | 4 in the default 17 Sep–14 Oct UTC client-event window | Recorded client success events, **not verified paid transactions** |
| Old reader in supplied screenshot | Latest 1,000 source rows from a larger receipt-time period | 1 | Incomplete event-frequency report |
| App Store Connect | Owner reports closer alignment with legacy | Not independently verified here | Requires the exact Apple report/export and metric definition |

The fixture generator reproduces the screenshot's entire ordered funnel exactly: **96 → 96 → 72 → 48 → 48 → 24 → 24**. A regression test verifies that these are generated fixtures and that the panel explicitly says demo/synthetic. Those counts were not inferred from actual identities.

## Reproducing the legacy screenshot

The existing legacy reader requests a large `.limit(50_000)` without pagination. A successful response can still be capped by the project's REST row limit. Supabase documents its default maximum of 1,000 rows and the need to paginate. [Official Supabase select documentation](https://supabase.com/docs/reference/javascript/select).

A GET-only source check froze the same telemetry cutoff as the actual snapshot:

- Receipt start: **2026-09-17 06:40:58 UTC**.
- Receipt cutoff: **2026-10-15 06:40:58 UTC**.
- App: `innertype`; no market/country restriction.
- Requested limit: **50,000**.
- Actual response: **`Content-Range: 0-999/4694`** — 1,000 returned out of 4,694 matching rows.
- Returned newest records cover only **3 October 11:41 UTC through 15 October 01:19 UTC**. Earlier matching records are omitted.

Every displayed count in the old screenshot matches that incomplete response:

| Signal | Screenshot / capped 1,000 rows | Complete same receipt window, 4,694 rows | Actual Signal default client-date window, 4,773 rows |
|---|---:|---:|---:|
| First-open events | 21 | 58 | 60 |
| Combined `session_start` + `app_opened` signals | 104 | 307 | 309 |
| Assessment starts | 28 | 118 | 120 |
| Assessment completions | 19 | 96 | 98 |
| Result views | 23 | 114 | 115 |
| Paywall views | 6 | 19 | 19 |
| Price rendered | 6 | 19 | 19 |
| Purchase taps | 1 | 4 | 4 |
| Purchase-success events | 1 | 4 | 4 |
| Purchase failures | 0 | 0 | 0 |

This reproduces the legacy count defect; it does **not** show that the four events are four paid purchases. The exact current scope of the owner-operated old deployment was not extracted from its full URL. The bounded reconstruction nevertheless matches all ten screenshot counts and directly demonstrates the API cap.

The complete receipt window and actual Signal's default client-event window are different time definitions. Legacy uses a rolling received-at timestamp; Signal's default is 17 September 00:00 through 15 October 00:00 UTC client-event time, at the fixed receipt cutoff. Their totals must not be forced to agree. The four purchase events happen to lie in both windows. The identity/coverage gates remain in effect.

## Actual success-event evidence

The complete bounded source contains these four `purchase_success` callbacks:

| Client time · UTC | Receipt time · UTC |
|---|---|
| 20 September 13:38:40 | 20 September 13:38:56 |
| 22 September 18:11:31 | 22 September 18:11:47 |
| 30 September 01:30:13 | 30 September 01:30:19 |
| 5 October 22:46:20 | 5 October 22:46:35 |

Only the October 5 record survives the legacy newest-1,000 slice. The four records also appear as four recorded sessions in the actual selected client-event window. No person or transaction identity has been invented or joined.

**The telemetry lacks Apple transaction IDs and StoreKit sandbox/production classification.** Its `environment=prod` field is an app analytics tag; it is not proof of a real charged StoreKit transaction. Client callbacks cannot establish paid-unit counts, proceeds, refunds or purchase uniqueness. Sandbox and beta purchase flows exist separately from charged sales; that is a possible source of differences, **not a classification of any of these four records**. [Apple sandbox testing documentation](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox).

The owner's App Store Connect observation remains unresolved at the transaction level. We must compare the exact Apple report/metric, product, dates/timezone and environment before reconciling money. Even aggregate agreement alone would not prove a one-to-one transaction join. No client event was removed, relabeled as sandbox or adjusted to fit an Apple total.

## Development corrections

1. **Legacy source pagination:** event reads now use ascending database ID keysets, bounded receipt times and exact expected counts. Catalog reads paginate as well. A short server-capped page is not treated as completion. Errors, missing counts, premature termination and oversized windows fail rather than returning partial metrics. The old production deployment was not changed.
2. **Demo identification:** sticky demo source banner, an explicit generated-metrics explanation, per-panel DEMO badges, and a distinct browser title. The archived gallery has a sticky warning, a presentation watermark and a clearly named link to the actual snapshot. Historical JPEG files are unchanged; no evidence image was rewritten.
3. **Actual-source clarity:** the actual tab title identifies the InnerType snapshot. The header exposes app-reported purchase events with an unverified-charge label. Data Quality shows independent event totals and the success-event UTC dates. The purchase funnel distinguishes raw success events from ordered funnel membership. Verified Apple transactions remain `null`, not zero or a fabricated count.
4. **Existing boundaries preserved:** fixtures are still explicit development/demo only. The real endpoint rejects sample requests and never substitutes fixtures after source failure. Production authentication and the production-only source guards remain unchanged.

## Verification

- Live GET-only reproduction: `source-check.json` records the row cap, all ten matched counts and four full-period callbacks.
- The corrected paging helper read **4,694 distinct rows across five GET requests**, and its full row set matched the restored archive privately. No raw row identities were retained in delivered evidence. See `pagination-verification.json`.
- Independent SQL versus actual API checks pass for eight scopes, including purchase-event date groups, source frequencies and no raw-identity serialization. See `real-api-reconciliation.json`.
- New regression cases cover 1,000-row and 500-row caps, partial/missing/failed reads, the exact demo screenshot funnel, and raw success events that do not qualify for a closed funnel.
- **186 tests / 38 files passed**, typecheck and production build passed; lint has zero errors and one pre-existing login navigation warning.
- Actual source UI and archived gallery labels were inspected in the browser. New source-evidence screenshots are included in `evidence/purchase-reconciliation/screenshots/`.

This resolves the demonstrable demo/source confusion and the legacy pagination defect in development. It does not declare Apple transaction reconciliation complete or the real-data milestone's user-identity gates fulfilled. No production migration, deployment or App Store operation occurred.
