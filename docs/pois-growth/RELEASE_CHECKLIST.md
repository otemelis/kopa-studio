# POIS Growth first-slice release check

This branch adds an owner-only, read-only POIS Growth page at `/apps/pois/growth`. It has not been deployed to production.

- [x] Source inventory and metric definitions checked against current production and TestFlight rows on 28 October 2026.
- [x] Production and TestFlight events are separate; one observed app version is selected at a time.
- [x] First opens are installation events, Sales report units are units, Apple Ads installs are attributed installs, and purchase callbacks are not verified charges.
- [x] Empty/partial ASC or Apple Ads rows display **Unavailable**; no CSV sample is shown as current data.
- [x] No POIS database writes, schema changes, client changes or raw identifiers in the page.
- [x] Unit tests, typecheck, lint and production build pass on the development branch.
- [ ] Verify owner and unauthorized access, dark/light appearance and mobile layout in a protected preview.
- [ ] Recheck source freshness and spot-check one value against SQL immediately before any production deployment.
- [ ] Obtain explicit approval before merging or deploying to `tools.kopa.studio`.

Remaining work: validate the first page in preview; add deeper funnel/cohort views only after production 1.1 session IDs and mature cohorts are observed. Verified paid lifecycle, Meta reporting and POIS ASC Analytics remain unavailable. The supplied Apple Ads CSV is historical reference only until a provenance-preserving import is reviewed.
