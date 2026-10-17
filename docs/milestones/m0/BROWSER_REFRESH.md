# App Store refresh without chat or file handoff

Open http://127.0.0.1:4340/ and press **Refresh App Store data**. The already-running local Kopa server invokes the existing scripts/app-store/refresh.py, which calls official App Store Connect APIs using the existing local key. No export files or chat interaction are needed. The page shows progress, retains the previous validated snapshot during the run, and reloads after successful validation/publication. If a job fails it displays failure while retaining the old snapshot. Refresh also remains available when a snapshot cannot load.

This is an owner-operated local refresh, not a hosted/scheduled job or refresh-on-open. The local server and existing local key must remain available. Restart with the existing `npm run portfolio` setup and private reader file paths if necessary. No credentials were uploaded to Vercel or the browser. No paid service or scheduler was introduced. The Apple Ads navigation link now opens the already approved hosted direct API page rather than the old local saved export.

## Verification on 17 October 2026

A real browser click started the fixed existing extractor at13:59:04 UTC and published successfully at14:00:33 UTC. The common complete reporting window remains16 September–13 October because the existing conservative Analytics completion-lag rule is unchanged. Fresh extraction does not make incomplete days complete.

The dataset has2,184 rows/78 series; independent SQL checks and 12 app/week control groups across three weekly reports pass (see browser-refresh-validation.json). New snapshot SHA-256 cb5715c4ae57aabb58ee64d5704bd5a9fb4b03e160d88b742f6b93763ba703c3. All102 captured numeric values in7/28-day views match the source exactly, preserving counts, native-currency cents and comparable deltas. Separate live product telemetry remains independently sourced. No cross-source customer attribution is added.

Twenty existing reporting regressions, three refresh-control tests and isolated HTTP tests pass. Tests cover one job at a time, duplicate409, completion/failure state, sanitized errors and rejection of foreign origins, forged Host, non-loopback callers and missing action headers. Existing pipeline publication safeguards remain responsible for validating hashes/SQL/weekly controls before atomic manifest replacement.

LoveType, POIS and PASSPORT ongoing Analytics requests still have no daily report instances in this successful run. Their Analytics cells stay blank/unavailable; no synthetic fallback or invented zeros. Sales remains independently available.

## Small implementation boundary

A fixed POST /api/app-store/refresh starts the existing script; GET returns only job state/times. It accepts only the actual127.0.0.1 server Host, loopback peer, same-origin Origin and an explicit action header. No request-supplied command, file path or credentials are accepted. The existing Python file lock also protects against a separately started CLI refresh. Logs remain private under scripts/app-store/runs; the local static server only serves reporting/portfolio. No CORS or permissions were broadened.

Only the verified local server was briefly restarted to load this route; its existing private SQL file paths were preserved. The hosted service, production database, App Store configuration and releases were unchanged. Existing Signal layout/themes are retained; only the refresh action and its status were added.

Next: validate new official Analytics instances when Apple generates them. Unattended/background or hosted ASC refresh remains separate, and must not be claimed as delivered by this local button.
