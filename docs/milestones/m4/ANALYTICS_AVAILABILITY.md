# Analytics availability in the existing refresh · 17 October 2026

The three approved ongoing requests still have no daily instances for discovery, downloads or purchases. Live checks at 12:42 UTC confirm all nine report types are awaiting_generation. This is a provider-generation state, not zero app activity. Metrics remain blank pending validation.

`npm run reports:refresh` now includes this read-only availability phase, reusing existing credentials, catalogs, pagination and retrieval logs. It saves per-app/report instance lists plus analytics-availability.json in the private run directory. Successful full refresh publication includes these separately timestamped states as analytics_availability in current.json. No new scheduler, service, permission, UI surface or metric is introduced.

- awaiting_generation: official successful empty instance list; instance count 0 describes report files only.
- available_pending_validation: instance IDs and processing dates are captured, but no metric or complete historical coverage is inferred.
- query_failed/catalog_unavailable: absence of a usable query/catalog is explicit, with null instance count rather than zero.

Availability failures in the optional instance phase do not replace verified Sales bytes. Unexpected account/request configurations still require review. Source schemas, event-date coverage, raw checksums and revisions must be validated before any newly generated reports enter metric calculations; this change does not claim that step is complete.

Validation: live catalog/instance phase executed against Apple; 20 reporting tests pass. Isolated publication test uses the real validated CSV and confirms failed optional Analytics reads preserve exact Sales bytes and null availability. Existing corruption/configuration tests also pass. No repeated full Sales download or freshness timestamp advancement was needed: the displayed Sales snapshot remains 16 September–13 October, last successful refresh 12:38:30 UTC, hash cd72a0c84418fcb8ee4f395dd9e9a121eaec021e29f90ba8344304303ca4b870.

Next: run the existing refresh after Apple has generated daily instances, inspect captured source data and integrate validated report coverage into the existing calculations. No additional approval is needed for that read/local implementation. No historical snapshot has been requested. PASSPORT device tests remain deferred until next week.
