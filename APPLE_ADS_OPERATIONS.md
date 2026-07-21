# Apple Ads operations

Run structure syncs and reports as durable jobs, never inside a page request. Log only status, durations, counts, error categories and rate-limit waits—never private keys, client secrets, full tokens or attribution tokens. Mark data stale/partial rather than fabricating a fresh result. Before each session, read `APPLE_ADS_LAB_STATUS.md`, inspect the implementation, run the relevant checks, update the status document and keep automation Level 0 until the completed milestones support a reviewed write boundary.

The `appleAdsLog` helper now emits JSON operational events and redacts bearer tokens and common secret labels before output.
