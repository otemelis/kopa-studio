# ASO cron reliability repair

Updated: 2026-10-20

## Production evidence before the repair

The latest database run (`c058bd8b-8e1f-4fc3-a193-b1845e523093`) started at 04:40:21 UTC and finished at 04:40:53 UTC on 20 October. The rankings cron processed 10 terms and stored 508 iTunes catalog app IDs. Its overall status was `partial`: Apple web search succeeded for 2 of 10 terms, failed for 8, and emitted 8 warnings. The first Apple web error was `browserContext.newPage: Target page, context or browser has been closed`; the next seven were `Apple web browser restart limit reached for this batch`.

The preceding run (`9906856a-8c83-4660-b054-e3632332bf68`) began at 00:36:41 UTC, recorded progress for only 1 of 10 terms, and remained `running` until the 04:40 invocation marked it failed as exceeding its six-minute lease. This is evidence of a stuck invocation; Vercel runtime logs for that historical interval were no longer available under the project's Hobby retention window, so the exact blocking Playwright call cannot be proven retroactively.

## Root causes found in the code

- Chromium was shared across all terms. A single process closure consumed the one batch-wide restart, so later terms failed without another browser attempt.
- `browser.newContext()` and `context.newPage()` had no outer watchdog. Navigation had a timeout, but an unresponsive Playwright transport could still leave the queued observation pending.
- Queue shutdown waited on the full queue tail without a bound, allowing a pending observation to prevent normal run finalization.
- The collector acquired the database lock and set its in-memory lock before entering `try/finally`. Failure while marking stale runs or creating the new run record could bypass lock release and leave a warm instance stuck.
- The six-minute database lease is only reclaimed by a later collector invocation. A serverless termination can therefore leave a run visibly `running` until the next scheduled call.

## Repair in this change

- Use one isolated Chromium process per keyword, closing it after that observation. A closed process can no longer poison later keywords.
- Retry only a browser-closure failure once for that keyword. Apple challenges, access denials, startup failures and ordinary timeouts remain unavailable observations; no evasion is attempted.
- Bound each web observation to 25 seconds, the complete Apple web queue to 210 seconds, and browser shutdown to one second. If the batch budget expires, later web observations are explicitly recorded as unavailable/deferred while independent iTunes collection continues.
- Bound browser launches based on the number of terms and one retry per term.
- Move stale-run cleanup and new run-record creation under the collector's `try/finally`; release the holder-scoped database lock on every caught path, including ambiguous lock-RPC responses.

## Daily keyword coverage

The live database has 231 active app-keyword records: 151 InnerType, 40 PASSPORT, and 40 POIS, with no duplicate keyword IDs shared across apps. The earlier ten-keyword cap could process only 50 records across the five daily ranking cron entries. The cap is now 48 per run, giving 240 scheduled slots per day and nine slots of headroom. The least-recently-collected ordering makes successive slots rotate through the pool. Each run remains bounded; if upstream response time exhausts the web-collection budget, those observations are explicitly failed/deferred and are picked up by a later slot rather than counted as successful.

The Apple web queue budget is 240 seconds within the route's 300-second platform limit, leaving 60 seconds for the independent iTunes/database work and finalization. A capacity regression test ties the five configured ranking jobs and the 231-record portfolio to the 240-slot daily target.

## Validation

Synthetic tests cover a ten-keyword batch, repeated browser closures, a hung Playwright call, batch deadline expiry, browser startup failure, database run-record failure, ambiguous lock-acquisition response and subsequent warm-instance recovery. These tests use fake browsers and a fake Supabase REST response; they do not create production rows.

The required distinction remains: `ok`/`partial`/`failed` describes collection execution; a web result is only an observation when the source returned identifiable results. A failed/deferred observation is never converted to an unranked position.

## Operational limit

This repair prevents a transient browser failure from cascading across the batch and bounds the browser queue. It cannot guarantee that Apple, Vercel, DNS or Supabase never fail. Those conditions should produce an explicitly partial/failed run, release the lock when the function can execute its finalizer, and be retried by a later scheduled run.

No database schema, production data, credentials, campaigns or App Store configuration were changed by this repair.
