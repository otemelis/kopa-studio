# M3 · Live read-only product view

Open `http://127.0.0.1:4341/product.html`. This is the existing minimal Signal portfolio shell plus one source-specific read page. App/environment/date selection persists; 7/28 **complete** days, real source timestamps, daily installation trend, ordered 24-hour journey, mature D1/D7 and matched posture usage. Themes retain the accepted foundation. PASSPORT has no source rows yet and no identities; production is not inferred from TestFlight.

## Run

From repository root, with existing `apps/tools` dependencies available:

```sh
KOPA_READER_CONFIG=/absolute/private/reader.json \
KOPA_READER_CA=/absolute/private/supabase-ca.crt npm run product
```

The private JSON is a standard `pg` configuration (host, port, database, user, password), kept outside git/static directories with mode 600. CA is the official certificate linked by Supabase Database Settings. TLS verification stays enabled. Server binds only 127.0.0.1:4341; it is not a deployed public service. Portfolio remains available at `/` on the same server. No new authentication system, queue, cache, ingestion or framework.

Approved access SQL is recorded separately. The role has column SELECT grants, read-only default and 5-second statement timeout; two separately approved role-specific RLS read policies allow actual rows. No BYPASSRLS, browser role grant, write permission, or REST exposure. The server checks the policy exists, executes a repeatable-read read-only transaction, returns aggregates only and fails closed on errors. Credentials and installation histories never enter the browser response.

## Verification

`verification.json` records independent Python iteration over the retained real read-only POIS source snapshot, compared with live SQL: all cards, 28 daily buckets, ordered funnel, retention numerators/eligible denominators and matched usage. Independent connector SQL confirms period total 324 and 3 active installations. Environment-wide source count 460 includes today's incomplete events, deliberately excluded from the report.

- `node --test scripts/product-analytics/model.test.mjs`: 4 pass.
- `python3 scripts/product-analytics/run-sql-tests.py`: actual SQL against disposable local Postgres; ordered/mature funnel, wrong session, pre-entry paywall, D1/D7, empty inputs and production separation pass. Fixtures only in this explicit test; no live writes.
- `node scripts/product-analytics/http.test.mjs`: isolated local server fails closed without credentials; private path not served.
- Existing 11 reporting tests and publication failure test pass.
- Browser verified POIS TestFlight, POIS production-not-observed, PASSPORT no-data, both themes and persistent filters. No real payment assertion is made.

The frozen-window independent check is reproducible with `python3 scripts/product-analytics/reconcile-snapshot.py /private/retained-source.json /output/validation.json` while the local server runs and its current complete window remains 17 Sep–14 Oct. It deliberately asserts that exact baseline window; update the evidence window explicitly for later runs. The retained snapshot stays private and uncommitted.

Definitions are visible on the page and in `queries.mjs`. Daily zero means no received events, not proof of complete collection. POIS installation IDs are not people; session IDs identify posture sessions. Retention begins at the earliest recorded explicit first launch; absent or truncated telemetry can bias it. Trial and non-trial client observations are separate, not verified transactions. PASSPORT remains aggregate-only, device-local-day, with replay duplication and upload-time channel/version caveats.

Owner review checkpoint: the working M3 business capability is ready to review. PASSPORT's replay-contract/deployment gate remains separate; no app or collector was released. Next authorized implementation is M4's compact launch coverage, preserving independent Apple and product measurements.
