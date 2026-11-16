# Validation and acceptance gates

## Phase 1 checks completed

- Fresh `origin/main` was fetched at `e9f27797`, and an isolated handover branch/worktree was used; the old `nextjs-migration` checkout and its untracked files were not modified.
- Both Vercel project IDs/deployments and environment **names** were inspected without decrypting values. Supabase `cron.job`, selected role privileges, ranking catalog, recent run history and source-date freshness were inspected read-only. No provider fetch or production data write was made for this handover.
- Repo schedule has 12 × 48 = 576 ranking attempts/day, plus one maintenance, one PASSPORT ASC, one Tools Apple demand invocation. Live keyword count was 527 distinct active IDs on 16 November. `aso_sync_runs` showed 13 cron-triggered root runs and 591 processed items on each of 14–15 November, with partial source warnings; this supports activity, not complete web coverage.
- From the isolated handover worktree, root `npm ci --ignore-scripts` and Tools `npm ci --ignore-scripts` completed. Root `node --test api/aso/_lib/*.test.mjs`: **73 passed**. `npm run test:reporting`: **20 passed**. Tools `npm run typecheck` and `npm run build`: **passed**. Tools `npm test`: **284 passed, 4 skipped** across 62 passing files. No live credentials were supplied to these checks.
- Root `npm run test:aso`: **10 passed, 1 failed**. `scripts/aso/ranking-capacity.test.mjs` still expects five daily ranking slots; the checked-in `vercel.json` declares twelve. Treat this as a stale test assertion to correct in a separate code change, not evidence that twelve slots are disabled. The Tools install reported eight dependency advisories (seven moderate, one high); they were not automatically fixed or assessed for exploitability during this documentation-only phase.

## Run locally on the receiving Mac, without credentials

```sh
cd "$HOME/Developer/kopa-studio"
npm ci
npm run test:aso
npm run test:reporting
cd apps/tools
npm ci
npm run typecheck
npm test
npm run build
```

The known `test:aso` failure above is expected on the audited Git SHA until its five-slot assertion is updated. Record any *additional* failure separately. The receiving Mac should run the tests on its own runtime rather than assume these old-Mac results transfer unchanged.

Do not execute live provider scripts during this no-write check. If tests need unavailable tools, document the failure rather than adding production credentials to make a test pass. `npm run build` is a local build and does not deploy.

## Later worker-specific acceptance

| Worker | Minimum proof before cutting its Vercel schedule |
| --- | --- |
| Rankings | Same tracked country/term set, source-specific ordered app IDs and actual observation depth; 527 unique keywords have a daily attempt or explicit unavailable state; no synthetic positions; duplicate and interrupted runs do not duplicate stored results; full browser challenge/partial behavior tested. |
| Maintenance | App/competitor metadata checksum, reviews, Sales units and ASC analytics definitions reconcile to current outputs; a repeated report and an Apple processing-date revision are safe; warnings do not hide missing dates. |
| PASSPORT ASC | Ten-day bounded window, report-instance pagination, revision guard and source-date coverage match Apple; no duplicate partition or downgraded revision; POIS metrics unaffected. |
| Apple demand | Latest published Apple week and genre/country match; all pending groups eventually clear or remain marked unavailable; repeat run keeps one `(keyword,genre,week)` observation. |
| Apple Ads future worker | Official campaign and daily/search-term totals reconcile by UTC date, country and currency with source reports; source attribution remains separate from ASC downloads and app purchases. This is a new scheduling decision, not a current cutover. |

For every cutover, capture before/after SQL counts and checksums for the exact source/date scope; inspect `aso_sync_runs`, `aso_sync_errors`, `apple_ads_sync_runs` where applicable; inspect Vercel and `launchd` logs; verify Kopa's source freshness and unavailable states; and observe one natural Mac run after the manual run. Do not assert success from a route's HTTP 200 alone. Confirm exclusive writer behavior by deliberately overlapping two **isolated test** invocations, never live Vercel plus Mac writers.

The prior PASSPORT schema-2 Edge deployment is a separate product-ingest path. Check open PR #33 before treating the repo as a complete copy of live Supabase. Do not run its migration again; a read-only `to_regclass('passport_analytics.running_daily_counts')` and function check can establish presence.
