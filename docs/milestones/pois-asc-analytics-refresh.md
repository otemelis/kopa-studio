# POIS App Store Connect Analytics refresh

The existing owner-only `sync_analytics` action now locates POIS's already approved ONGOING request (`0a5174c1-f952-401f-abea-3f9fd6487a36`) and imports its Discovery and App Downloads reports. It does not create an Apple request. Downloads use only `Download Type = First-time download` and are stored under the separate `appstore_connect_first_time_downloads` source. Sales and Trends units stay under `appstore_connect_sales`; Apple Ads installs remain separate.

The importer verifies Apple segment size and MD5, checks app Apple ID, rejects malformed report rows, and selects the newest processing partition for each reporting date before aggregating segments. If Apple has no Downloads report or no matching row, the POIS page shows unavailable. Its count is labeled as observed report rows, because missing reporting dates cannot be assumed to mean zero.

## Local replay and reconciliation

Using the checksum-verified official Apple segments saved during the 29 October read-only audit, the new selection and parsers reproduced the independently checked 21–27 October 2026 UTC period:

| Scope | Impressions | Product-page views | First-time downloads |
| --- | ---: | ---: | ---: |
| All territories | 241 | 24 | 7 |
| Australia | 115 | 1 | 1 |

The seven first-time Analytics downloads also matched the independently fetched Sales PTI 1 total for that week. Sales PTI 3 included an additional redownload, so the two measures must not be substituted for each other. These historical totals validate the parser; they are not a claim that production has already been refreshed.

Checks: 69 API tests pass, 244 Tools tests pass, Next production build passes. Production database rows and the live site have not been changed by this branch. After approval, run the existing owner-only `sync_analytics` action, verify POIS request status, imported date/country/source totals against fresh official report instances, then inspect `/apps/pois/growth?country=AU&days=28`. Do not treat a partial Apple reporting window as a complete 28-day total.
