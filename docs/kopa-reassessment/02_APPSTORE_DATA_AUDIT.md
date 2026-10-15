# 02 — App Store data and scraping audit

Date: 2026-10-14. Evidence baseline: `189d42b6`. **Conclusion:** retain lightweight public catalog lookup and possibly sampled review intake. Replace the current source of “organic rank.” It cannot be made into authoritative storefront organic rank merely by improving retries or increasing the result limit.

## Every collection mechanism found

| Mechanism | Endpoint and implementation | Current use |
|---|---|---|
| Public app details | `https://itunes.apple.com/lookup?id=…&country=…&entity=software`; [api/aso/_lib/providers.js:86](/Users/otastemelis/Documents/kopa-studio/api/aso/_lib/providers.js:86) | Daily owned/competitor metadata refresh; primary country only |
| Duplicate app lookup | Same public lookup, separate parser/ID extraction; [apps/tools/src/services/apple-lookup-service.ts:3](/Users/otastemelis/Documents/kopa-studio/apps/tools/src/services/apple-lookup-service.ts:3) | Adding apps and competitors in Tools; no shared throttler |
| Keyword discovery/results | `https://itunes.apple.com/search?term=…&country=…&entity=software&limit=100`; [api/aso/_lib/providers.js:94](/Users/otastemelis/Documents/kopa-studio/api/aso/_lib/providers.js:94) | All tracked keyword “rank” snapshots |
| Reviews | `https://itunes.apple.com/{country}/rss/customerreviews/page={n}/id={id}/sortby=mostrecent/json`; [api/aso/_lib/providers.js:136](/Users/otastemelis/Documents/kopa-studio/api/aso/_lib/providers.js:136) | Two pages for each owned app's primary country; rule-based English topic matching |
| ASC app registry | `GET /v1/apps?limit=200`; [api/aso/_lib/appstore-connect.js:100](/Users/otastemelis/Documents/kopa-studio/api/aso/_lib/appstore-connect.js:100) | Maps by bundle ID, not public scraping |
| ASC Summary Sales | `GET /v1/salesReports` without an explicit report date; [api/aso/_lib/appstore-sales.js:24](/Users/otastemelis/Documents/kopa-studio/api/aso/_lib/appstore-sales.js:24) | Most recent available daily summary, no historical backfill |
| ASC Discovery | requests → reports → daily instances → segment URLs; [api/aso/_lib/appstore-analytics.js:196](/Users/otastemelis/Documents/kopa-studio/api/aso/_lib/appstore-analytics.js:196) | Four recent instances, report name matched exactly |
| AppFollow probe script | `GET https://api.appfollow.io/api/v2/aso/keywords`; [apps/tools/scripts/appfollow-keywords-audit.mjs:1](/Users/otastemelis/Documents/kopa-studio/apps/tools/scripts/appfollow-keywords-audit.mjs:1) | Manual audit script only; not a running provider or scheduled integration |
| Apple Ads | OAuth and v5 account/structure/report calls | Paid performance; not organic storefront ranks. Detailed in document 04 |

No headless App Store browser scraper, authenticated device search observer, proxy pool, CAPTCHA bypass, third-party rank sync, or alternate HTML search parser was found in the tracked application. Static App Store URLs in website pages are outbound links, not collection mechanisms. Shared product events are a separate first-party telemetry source.

## Complete keyword journey

1. Owner creates app/keyword links through Tools or legacy console. Keywords are shared by term/country, with a nullable language field; current unique key omits language.
2. Tools queues `aso_jobs` and may wake the public-site collector with `CRON_SECRET`; root Vercel cron invokes the same handler. The stored app/country job scope is not applied to `runCollection`.
3. Collector loads apps, keyword dictionary, links and competitors. It selects 50 least-recently-collected linked keywords. It does not exclude paused links at collection selection.
4. `searchApps(term,country,100)` calls iTunes. Country is sent; keyword language is not. No device class, OS, store session, requested exact locale, IP location, personalization context, or sponsored-placement query is sent.
5. `body.results` is filtered to objects with `trackId`; filtered rows are numbered starting at one. There is no schema validation, duplicate-ID rejection, result-count validation, or sponsored-result classification. Missing `results` silently becomes an empty array.
6. Collector computes a non-cryptographic checksum, saves the first **25** mapped results and the length of the full returned list. It finds owned/competitor IDs in the in-memory list and writes rank/found/depth plus derived fields.
7. Daily upsert keys overwrite observations from the same day. There is no append-only attempt record or full raw response. `captured_at` records current write time, even if the six-hour process cache supplied the response.
8. Keyword repositories choose the latest stored observations and expose current rank and changes. Some views omit collection status, depth and source method entirely. `/rankings` calls null “Not ranked.”
9. Legacy insight rules consume these positions as visibility evidence; paid/organic comparisons therefore inherit the same limitation.

Trace anchors: [apps/tools/src/app/api/keywords/route.ts:13](/Users/otastemelis/Documents/kopa-studio/apps/tools/src/app/api/keywords/route.ts:13), [apps/tools/src/app/api/jobs/route.ts:17](/Users/otastemelis/Documents/kopa-studio/apps/tools/src/app/api/jobs/route.ts:17), [api/aso/collect.js:267](/Users/otastemelis/Documents/kopa-studio/api/aso/collect.js:267), [api/aso/collect.js:287](/Users/otastemelis/Documents/kopa-studio/api/aso/collect.js:287), [api/aso/collect.js:291](/Users/otastemelis/Documents/kopa-studio/api/aso/collect.js:291), [api/aso/collect.js:307](/Users/otastemelis/Documents/kopa-studio/api/aso/collect.js:307), [apps/tools/src/repositories/keyword-repository.ts:49](/Users/otastemelis/Documents/kopa-studio/apps/tools/src/repositories/keyword-repository.ts:49), [apps/tools/src/app/rankings/page.tsx:11](/Users/otastemelis/Documents/kopa-studio/apps/tools/src/app/rankings/page.tsx:11).

## Measurement validity

### Search ordering is not proven organic ranking

The source comment itself acknowledges non-equivalence (`providers.js:5–8`). Apple's public [Search API documentation](https://performance-partners.apple.com/search-api) specifies catalog search, country, a 1–200 result limit, limited language parameter options, approximate 20 calls/minute guidance, and caching. It does not promise equivalence to a personalized native App Store search session. Calling the saved position a “storefront snapshot” still does not describe its actual method accurately.

This audit did not measure how often iTunes ordering agrees with devices. There is no basis for asserting “closely related,” a correlation percentage, true demand, or install impact. Legacy observations should remain available as **iTunes Search position**, with a discontinuity when a new provider starts.

### Sponsored placements

There is no paid/organic slot classification. An ad is neither positively detected nor explicitly removed. iTunes results cannot establish where ads, CPP variants, stories, or multiple native placements appear. An organic rank provider must document the ranking unit and exclusion of sponsored placements. Never subtract one mechanically to “remove an ad.” Apple Ads impression-share rank is paid visibility rank, not an alternative organic rank.

### Market, language and identifiers

- Country is a two-letter parameter; UI notes/readiness flags are not proof of actual localized collection.
- `keyword.language` can express exact locale after recent changes, but search ignores it. Same term/country across languages is one mutable database identity.
- Public metadata's `languageCodesISO2A` describes app-supported languages, not the language of the returned listing. Current code correctly avoids inferring exact listing locale from it.
- `trackId` is normalized to a string. Matching uses exact string equality. The newer app-ID parser accepts any long digit sequence in an input string; the older parser requires a numeric ID or recognized App Store URL. Unify parser and validate requested/returned IDs. Bundle ID, numeric App Store ID, ASC resource ID and internal UUID remain distinct.
- Primary-country competitor snapshots omit country; a country change can make a series appear to continue across markets.

### Depth and history

The current call requests 100 results; provider supports up to 200. There is no pagination. “Not found” means absent from the returned sample, not known to rank 101+, and a short returned sample does not establish the full matching universe. Only 25 results are retained, so positions beyond 25 cannot generally be reconstructed or independently audited afterward.

Same-day runs overwrite both result and rank rows. Full request parameters, HTTP status, response checksum/body, response time, cache age, parser version and run-to-observation linkage are absent from rank facts. Raw rank history is therefore incomplete as an observation archive even when daily rows exist. Seven-/30-day change uses the nearest observation on or before the cutoff, with no maximum gap; labels can imply a time interval that was not actually observed.

### Failure, stale data and silent corruption

| Situation | Existing behavior | Required contract |
|---|---|---|
| HTTP/network/JSON failure | Retries some errors; item error stored at run level; old rank remains | Record failed attempt for that query, preserve last successful sample with its age |
| HTTP 200 unexpected schema | `[]`, then successful unranked snapshot | `schema_error`, quarantine, no rank write |
| Valid empty search | Successful unranked observation without distinct validation | `valid_empty` only after response-contract and source checks |
| Target absent | `rank=null`, found=false | `not_found_within_depth`, explicit depth and method |
| Cache hit | New capture timestamp | Keep original observed time and separate ingested time |
| Partial scope | Run can be partial or even overall ok; coverage incomplete | Expected-vs-complete query/market coverage and per-source watermark |
| Upstream shape drift | No search parser version or drift alarm | Known-shape validation, invalid-item ratio, suspicious depth/empty-rate alert |

A deterministic offline probe returned `[]` for `{unexpected:'schema'}`. This confirms a code path, not that Apple currently sends that body. Discovery parser diagnostics are stronger and worth reusing, but report-instance selection is still wrong (F02).

## Throttling, runtime and restrictions

`MIN_INTERVAL_MS=3200`, six-hour in-memory cache and up to three retries are useful small-scale precautions. They apply per process, not account/IP fleet. Retries do not rejoin the shared start-time gate. No AbortSignal/request deadline or durable Retry-After budget exists. Adding a second Tools lookup path bypasses that queue.

At 50 cold search requests, spacing alone is approximately 157 seconds. App/competitor lookup and up to two review pages per app, all database writes, ASC downloads and insight evaluation consume the same 300-second invocation. This is a capacity calculation, not a measured production duration. With 300 queries and one 50-query run/day, ideal full refresh takes six days before failures; calling that daily rank tracking would be misleading.

Apple's approximate Search API call guidance is not a guaranteed SLA or authorization for every reuse. Asset/promotion terms and current platform terms need source-specific review. No contractual permission for automated native search observation was established. Do not deploy undocumented endpoints, proxy rotation, CAPTCHA circumvention, or protection bypasses. Open-source scraper licenses do not grant rights to upstream data.

## Source classification

Ratings describe fitness for the stated purpose, not universal quality.

| Source | Reliability / accuracy | Freshness / geography | Cost | Risk / maintenance / compliance |
|---|---|---|---|---|
| iTunes lookup | Useful public identity/catalog fields; limited locale/metadata | On request; country parameter; no guaranteed freshness | No per-call fee identified; runtime cost | Low technical complexity, no SLA; observe content terms |
| iTunes keyword positions | Repeatable request shape, unvalidated native rank accuracy | Cached up to six hours/process, bounded results, no language control in code | Low direct cost | **Unsuitable primary organic rank source**; silent schema failure and semantics risk |
| Customer-review RSS | Useful recent sample; not complete review history | Two pages/primary market; gaps possible | Low direct cost | Public feed support/terms uncertain; English classifier weak internationally |
| ASC reports | Strong provenance for owned apps; privacy/definitions still matter | Report-specific delays, territories, partial/corrected dates | No separate per-call fee established; account/infra costs | Stable documented interfaces; correct partition replacement essential |
| Apple Ads official | Strong paid campaign provenance, attribution caveats | Reporting lag, supported markets and scoped accounts | API fee not established; advertising spend separate | Versioned APIs, roles, rate limits, privacy-suppressed terms |
| Licensed rank provider | Vendor-observed rank, method-dependent; test against devices | Contracted market/device/locale/frequency | Subscription plus API credits | Lower collector maintenance; storage/export/AI rights and coverage must be confirmed |
| Manual native observation | Closest to the observed session, not universal ground truth | Small timestamped market/session samples | Owner time | Good validation; poor unattended multi-app scale |
| Open-source scraper | Implementation convenience, no data-quality guarantee | Endpoint/maintainer dependent | Engineering/operations | Not a sustainable default without permitted access and validated method |

## Sustainable rank strategy

1. Start with 3 apps × 2 priority storefronts × 15 relevant terms = **90 app/market/term series** (planning scope, not current inventory). Share an upstream query across apps only if device, locale, country and provider method are identical. Agree the app list before spending.
2. Trial one licensed source with documented organic rank and observation status; AppTweak has the clearest inspected historical rank contract. Compare Appfigures and any existing AppFollow entitlement before buying. No provider is selected or purchased in this audit.
3. Require a non-empty sample for real owned app IDs in target markets; validate organic-vs-ad handling, historical depth, timestamps, pagination, absent/failed states and final cost.
4. For 14 days compare a small fixed panel against manually observed native sessions. Record device/OS, storefront, language, timestamp and session caveats. Investigate differences; do not claim one universal rank or demand exact equality across sessions.
5. Store provider raw values and `fetch_performed` where available. AppTweak's documented `effective_value` may interpolate or use 501; **never import it as an observed rank**. Convert explicit observed-not-found to a censored state, not numeric 501.
6. Daily priority observations; lower-priority terms two or three times/week if budget requires. Report the actual cadence per series. On vendor outage retain age-labeled history, record missingness and pause decisions; do not silently splice in iTunes positions.
7. Keep metadata lookup as a separate adapter. Prefer official ASC metadata for owned apps, licensed metadata for competitors and small manual checks where appropriate.

If no affordable permitted source passes the trial, use vendor CSV snapshots/manual observations and ship portfolio/paid/experiment workflows first. Do not build an evasive scraping business to support a personal tool.

## Explicitly unobtainable or unproven measures

No reliable exact organic installs per iOS keyword; no exact search counts inferred from popularity; no complete competitor spend/revenue from public metadata; no all-user personalized organic rank; no complete review universe from two RSS pages; no retrospective native rank reconstruction from current search; no causal uplift from a simple before/after rank chart. Official ASC “App Store search” can include paid discovery, so it is not automatically an organic-only channel.
