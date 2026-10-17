# Pending owner approval: ongoing Apple Analytics

Read-only checks on 17 October returned complete empty report-request lists for POIS 6820665225, PASSPORT 6822753543 and LoveType 6786477464. Reviewed POST bodies: ANALYTICS_REQUESTS_PENDING_APPROVAL.json. Recheck before creation and reuse any matching ongoing request instead of creating a duplicate.

Roadmap rules 8–9 require approval for this Apple account configuration change. Only three ONGOING requests are proposed, using the existing admin credential for initial creation; no credential upgrade, app release, ad action, new Kopa scheduler or paid service. Later retrieval uses the existing reporting credential. Generated reports still require mapping/coverage/checksum/revision validation before use. This checkpoint made no POST requests.

Apple distinguishes [ongoing current reports from ONE_TIME_SNAPSHOT historical requests](https://developer.apple.com/documentation/appstoreconnectapi/post-v1-analyticsreportrequests). Historical snapshots are a separate approval; do not promise backfill until actual report dates are inspected. See reporting/portfolio/LOVETYPE_ANALYTICS.md for the existing historical request body and read/validation sequence, substituting the appropriate verified app ID. The current refresh intentionally stops on configuration drift.
