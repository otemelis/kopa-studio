# M8: initial read-only change log

Locally implemented on 17 October 2026. Open http://127.0.0.1:4340/change-log.json while the existing portfolio server is running (`npm run portfolio`). The existing static JSON delivery is reused; no server implementation or UI changed.

Five curated entries record PASSPORT collector deployment, its internal TestFlight build registration, and the three approved ongoing Apple Analytics request activations. Each entry has app, scope, measurement caveat and an evidence key. Internal TestFlight is not a public release. No campaign/metadata history or causal effect is asserted. This is incomplete historical project context, not a live provider feed.

The deployment timestamp is from retained Supabase metadata; the build timestamp is Apple's uploadedDate normalized to UTC (not a device installation time). Apple request creation times are unknown: occurred_at_utc stays null and response_observed_at_utc records the successful response observation. Do not use those observation times as exact creation times. generated_at_utc is the retained-source verification time, not a provider refresh.

## Reproduce

From the Kopa development checkout:

```sh
node scripts/change-log/check.mjs
node --test scripts/change-log/check.test.mjs
node scripts/product-analytics/http.test.mjs
```

The offline validator binds each entry's app, scope and time to sanitized evidence by SHA-256. Four regression tests reject duplicate IDs, release-scope relabeling, invented times, altered evidence and extra sensitive/causal fields. The HTTP regression checks JSON delivery, no-store, no SQL fallback metrics, and inaccessible private/evidence paths. Existing localhost:4340 returned bytes identical to the checked-in JSON; see verification.json. Raw provider responses remain private; sanitized evidence retains their hashes for local audit. Hashes establish integrity, not a provider signature or completeness guarantee.

## Boundaries and next step

This completes only the first independent M8 slice; experiments, recommendations and trend annotations are not implemented. No deployment, provider configuration, production data, app shipping or advertising changed. Next: validate Apple's first generated daily Analytics instances using the existing refresh, then genuine PASSPORT device delivery/retry tests next week. Both gates remain pending; M7 stays dormant with no channel spend.
