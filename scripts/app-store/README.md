# Existing official Apple report refresh

From the repository root: `npm run reports:refresh`. This reuses the validated extractor and the independent SQL/Python CSV calculations; no new ingestion engine or scheduler exists. Requires Python 3 (not `-O`), the existing bundled Node runtime, network access, and the existing Apple reader .p8 at its current local path. `ASC_PRIVATE_KEY_PATH` can point to that existing key. Never put a private key in this repository.

Raw downloads, failed runs and diagnostic logs stay ignored under `scripts/app-store/runs/` (owner-only directories). A successful run validates checksums/date coverage/metrics/weekly controls before publishing a hash-named CSV and atomically replacing `reporting/portfolio/current.json`. The independent attempt marker reports running, success or failure. On failure the previous data and success timestamp remain unchanged. Reload the canonical overview after running. Do not run simultaneous refreshes; the existing file lock protects publication.

`npm run test:reporting` verifies the original accepted report's exact amounts, unavailable states, periods, currencies and freshness/failure behavior. No need to re-download official data merely to run regression tests. Historical validated source evidence from the successful 15 October run was retained in the originating chat's private work directory; no raw purchase reports are committed.

LoveType's Sales reporting is usable. Its Analytics report request does not exist; creating it is an Apple account-configuration approval gate. The refresh deliberately stops if LoveType's reporting setup changes until its mapping is reviewed. No fallback to POIS, product events or fixtures is possible.
