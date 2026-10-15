# LoveType Analytics: minimal setup, approval required

No account configuration was changed. The last read-only check on 15 October 2026 returned no Analytics report requests for LoveType, app ID `6786477464`. Sales refreshes are available now; Analytics remains unavailable until approved setup and validated report coverage.

After your explicit approval, an account **Admin** must perform the initial request creation. Continue using the existing reporting key for subsequent reads; a Sales and Reports role is sufficient and needs no Admin upgrade. [Apple roles and initial setup](https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-reports-api).

## Historical report

After your explicit approval, an Admin can submit the following to `POST https://api.appstoreconnect.apple.com/v1/analyticsReportRequests`:

```json
{
  "data": {
    "type": "analyticsReportRequests",
    "attributes": { "accessType": "ONE_TIME_SNAPSHOT" },
    "relationships": {
      "app": { "data": { "type": "apps", "id": "6786477464" } }
    }
  }
}
```

This requests available history. After generation, verify whether the report content actually covers the requested historical dates; backfill is not assumed or promised.

## Ongoing reports

With separate approval, submit the same request with `"accessType": "ONGOING"`. Apple describes initial generation as approximately 24–48 hours; ongoing reports then generate daily, weekly and monthly. This creates Apple reporting configuration, not a Kopa ingestion service. [Official request endpoint](https://developer.apple.com/documentation/appstoreconnectapi/post-v1-analyticsreportrequests).

## Validate before using the data

1. Use GET requests to list the new request's reports, instances and every segment. Prefer **Discovery and Engagement Standard**, **App Downloads Standard** and **App Store Purchases Standard**.
2. Verify checksums, segment sizes, actual event-date coverage and report-specific completion delays. Keep all segments of the latest processing revision for each report/event date; do not add overlapping revisions.
3. Reconcile downloads, purchase units and proceeds to official Sales controls, retaining UTC/Pacific date differences and original currencies. Do not sum unique paying-user fields across rows.
4. After setup, review the new report mapping in the existing extractor before enabling LoveType Analytics in refreshes. The current refresh stops if it detects a newly created LoveType request, so it cannot misrepresent new reporting as still unavailable. Validate history, then publish the generated CSV and its matching hash manifest.

These are documented steps only. Neither POST request has been made, no key or permissions changed, and no scheduled collector was created.

Exact read sequence: `GET /v1/apps/6786477464/analyticsReportRequests?limit=200`; follow `links.next`, then `GET /v1/analyticsReportRequests/{requestId}/reports?limit=200`, `GET /v1/analyticsReports/{reportId}/instances?filter[granularity]=DAILY&limit=200`, and `GET /v1/analyticsReportInstances/{instanceId}/segments?limit=200`. Download every signed segment URL without forwarding the API authorization header. Verify the approved request ID, accessType and stoppedDueToInactivity flag. Record missing historical coverage explicitly. Download ongoing reports regularly to avoid inactivity; do not create duplicate requests if an appropriate request already exists.
