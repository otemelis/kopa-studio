Update · 16 October: successful owner-saved API data and both supplied console controls now reconcile. The existing local page displays the validated historical daily slice. See [API_RECONCILIATION.md](API_RECONCILIATION.md).

Latest correction: [EXPORTER_PRECISION_FIX.md](EXPORTER_PRECISION_FIX.md) records the owner-reported failure, proven precision defect, tested production correction and pending live reconciliation.

# Deployment update · 15 October 2026

The owner approved the scoped release. It is now deployed with all 304 baseline source files unchanged plus four approved additions. Production build and 23 tests pass; unauthenticated access redirects to login. Authenticated JSON data remains unvalidated because the in-app browser blocks response navigation. See [EXPORTER_DEPLOYMENT.md](EXPORTER_DEPLOYMENT.md) for evidence, usage and the exact next task. The proposal below is retained as rollout history, not a pending approval request.

# Working deployed credentials · 15 October 2026

**Verified:** `kopa-tools` has production/preview `APPLE_ADS_CLIENT_ID` and `APPLE_ADS_CLIENT_SECRET` stored as sensitive secrets. The separate `kopa.studio` project has no Apple Ads credential variables. Read-only Vercel metadata was inspected with the existing local CLI authentication; no plugin installation, environment updates, role changes or deployments occurred. Secret values were not returned or copied. Vercel's GET response explicitly reported `decrypted:false` for both; protected values were not bypassed.

The signed-in deployed owner page's **Test Apple Ads connection** action succeeded: OAuth succeeded and one accessible organization was returned. The inspected handler calls only the existing OAuth/ACL provider check and performs no database import. This confirms a live working runtime credential, not merely an old healthy database flag. It does not prove all API rights are read-only or validate current campaign performance. Do not invoke the old import buttons: their report handler writes campaign/search-term rows and recommendations.

## Narrow local patch awaiting production deployment approval

Added `GET /api/apple-ads/reports/export` to the existing owner-authenticated Tools app. No UI change or new credential is required. It uses the same working runtime provider, selects the owner's existing connection and known nondeleted campaigns, and performs bounded daily reporting reads. It returns aggregate report data with UTC period, provider version and query timestamp; it never returns tokens or credential values.

- Default last 28 complete UTC days; explicit windows must be 1–28 complete days inside that boundary.
- Existing owner check runs before DB/API reads. Connection is owner-scoped; campaign IDs come only from that connection, not caller input. Ambiguous connections or more than 10 campaigns fail closed.
- Database calls are SELECT only. No sync, upsert, campaign change, recommendation write or scheduling.
- Existing legacy v5 OAuth/report adapter is an explicit compatibility bridge, not a claimed v1 migration. Live report compatibility still needs validation after deployment; the new parser refuses missing counts/money, wrong campaign IDs, duplicate/out-of-window rows, pagination anomalies and inconsistent attribution.
- If any campaign fails, return HTTP 502 with no partial reports or credential-bearing error details. Omitted no-metric days stay missing; no synthetic zeros.
- Campaign coverage is the **existing stored mapping**, not a fresh account-wide inventory. New/unmapped campaigns cannot silently become covered.

Validation: 12 focused parser/handler tests pass; adding existing provider/reporting regressions gives **23 passing tests**. `npm run typecheck` passes. Tests use explicitly synthetic fixtures, never hosted writes. Nonzero attribution fixtures test arithmetic, not real performance. No production deployment/build is claimed.

## Exact approval and rollout

Approve deployment of **only the four files in `read-only-export.patch`** to the existing `kopa-tools` application, after preview/build verification against the currently deployed revision. Do not deploy the entire Kopa milestone branch or unrelated changes. Existing owner authentication and secret protection stay intact. No environment/schema/permission changes, ad actions or new recurring service are required. The code will make at most one provider report call per known campaign per owner request, plus normal OAuth refresh.

Read-only deployment metadata identifies the existing READY production deployment `dpl_AJcmhnfbhcso8GNp3CfWQ2rZ2J5G` but contains no Git source/commit provenance. This is an explicit rollout prerequisite, not permission to assume the current milestone branch matches production. After approval: verify the production source baseline/artifacts; apply only this patch to a matching isolated development checkout, build/preview, then deploy the reviewed route to the existing project. If the production baseline cannot be established without unrelated changes, stop before production and report that limitation. Call the signed-in owner export for 11 October first, reconcile against the official 13-impression control and preserve any revisions. Then fetch the last 28 complete days, retain raw aggregate report evidence privately, reconcile the supplied four-day export, and publish only validated local reporting data. Do not run existing sync endpoints.

Rollback: remove the new route/helper from the deployment; existing historical CSV page and production application are unchanged by that removal. No stored records were mutated by the exporter. Original sensitive secrets remain in Vercel.

If deployment is not approved, keep the working manual CSV path. An existing original credential/private-key file is another option, but the protected Vercel values cannot be exported; do not replace or weaken them merely for local reuse.

References: [Vercel Secret behavior](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types), [decrypted environment-variable read endpoint](https://vercel.com/docs/rest-api/projects/retrieve-the-decrypted-value-of-an-environment-variable-of-a-project-by-id).
