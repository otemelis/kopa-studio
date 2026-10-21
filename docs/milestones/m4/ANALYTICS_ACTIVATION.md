# Apple Analytics activation · 17 October 2026

Owner-approved creation completed. Exactly three POSTs returned HTTP 201; each app's complete request list was read before creation to avoid duplicates and read afterward using the existing reporting key. All requests have accessType ONGOING and stoppedDueToInactivity=false.

| App | Request ID | State | Access |
|---|---|---|---|
| POIS | `0a5174c1-f952-401f-abea-3f9fd6487a36` | ONGOING / active | Existing reader verified |
| PASSPORT | `1a1002c3-3a07-4d10-afca-6352b89790d5` | ONGOING / active | Existing reader verified |
| LoveType | `a602f763-4566-411c-9a6d-dd433363d545` | ONGOING / active | Existing reader verified |

Each generated catalog is readable. App Downloads Standard, App Store Purchases Standard and App Store Discovery and Engagement Standard were checked for every app: all nine have zero daily instances at this verification. This means metrics are unavailable pending generation and validation, not zero activity. The catalogs list available report types, not evidence that the apps emit every listed behavior.

The existing refresh now recognizes exactly these approved active IDs; unknown/duplicate/inactive requests, historical request types and unexpected pagination fail closed. Sales extraction and independent reconciliation remain unchanged. New Analytics fields stay blank with data quality unavailable_analytics_pending_validation until generated report dates, segments, checksums, revisions and definitions are validated. Historical accepted snapshots keep their original request-state evidence.

No ONE_TIME_SNAPSHOT was requested. No key/role changes, new Kopa scheduler, app shipping, ad actions or paid integration. The one-off activation script remains private working material, separate from the GET-only reporting refresh.

Validation: 17 reporting regression tests pass, including pending Analytics never becoming zero. Python checks reject corruption and all five bad configuration cases for each approved app. Full post-activation refresh verification is recorded separately in ANALYTICS_POST_ACTIVATION_REFRESH.json.

Next: read the approved requests for actual daily instances when Apple generates them, extend the existing report mapping, and independently reconcile coverage before using any new Analytics figures. This read/implementation step is already authorized and needs no further configuration approval. Historical snapshot creation and app releases remain separately gated. PASSPORT device testing stays deferred until next week.
