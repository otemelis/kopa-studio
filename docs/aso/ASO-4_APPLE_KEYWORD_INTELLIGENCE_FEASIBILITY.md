# ASO-4 — Apple-powered keyword intelligence feasibility and proof

**Verified:** 17 October 2026, 19:37 UTC  
**Branch:** `codex/kopa-milestones-2026-10-15`  
**Effect:** local adapter/tests plus read-only Apple Ads API queries. No campaigns, bids, budgets, metadata, database or production state changed.

## Decision

**The Apple endpoints are reachable, but the evidence is not sufficient to build a production ASO intelligence engine yet.** Apple returns genuine relative search popularity for some terms and histories, but coverage is sparse and inconsistent across the POIS/PASSPORT candidate set. POIS currently has no matching popularity observations in US, DE or GB for the tested Health & Fitness and adjacent Lifestyle scopes. App-scoped suggestions were unavailable for POIS and PASSPORT; InnerType proxy suggestions produced few useful new candidates. Phrase Suggestions were either unavailable in SUGGESTION mode or poorly matched in SEARCH mode.

This is a **NO-GO for persistence and automated opportunity scoring now**, not a rejection of the Apple source. Keep the existing ASO-4 persistence milestone queued behind this validation gate. Continue only with a bounded manual research report workflow until Apple coverage/relevance improves or a licensed provider passes rights and accuracy checks. Organic ranking remains unavailable.

## Verified API access and query behavior

Using the existing read-only account context `23026890` (ACL role `API Read Only`), OAuth and the added calls returned the results below. Requests were bounded and read-only. Live evidence is in owner-only local files with mode `0600`: `/private/tmp/kopa-aso4-apple-live.json` (SHA-256 `9e9a34c23e4bee578bbe51b92ff3050087e1dc60d3cb36131e294248307385a7`) and `/private/tmp/kopa-aso4-apple-followup.json` (SHA-256 `8a822c7facc5e300181a34a7e9a8646396746f9e76ca83d3ac0297c8345fea0c`). These are reproducibility artifacts, not committed fixtures.

### Phrase Suggestions

`POST /v1/suggestions/phrases/query` supports `queryType=SEARCH` with exact `phrase IN` or partial `phrase LIKE`, and `queryType=SUGGESTION` scoped to a promoted app. The request contract is now implemented and covered by tests.

| Test | Live result | Relevance |
| --- | --- | --- |
| Exact POIS/PASSPORT candidate set | HTTP 200, 0 rows | No Apple phrase observations for those exact candidates in this response. |
| SEARCH `LIKE "post orgasm"` | 13 rows | Poor: included Postino, Postos, PostalAnnex+, Sierra Trading Post and similar substring matches. |
| SEARCH `LIKE "orgasmic"` | 0 rows | No matching phrase rows. |
| SEARCH `LIKE "passport"` | 2 rows, both popularity 40 | “Passport and Visa Service” and “Passport Canada”; branded/service phrases, not app-intent recommendations. |
| SEARCH `LIKE "passport renewal"` | Same 2 broad passport rows | The multiword input did not yield a focused renewal phrase. |
| SEARCH `LIKE "travel document"` | 8 rows | Mostly travel-stop, hotel and travel-service phrases; low product relevance. |
| Exact control using two returned phrases | 2 exact matches | Confirms exact SEARCH is functional. |
| SUGGESTION for InnerType, POIS, PASSPORT | App not found/access denied errors | The API account cannot retrieve phrase discovery for these promoted objects. No campaign was created to test eligibility. |

Phrase rows have a popularity field but the endpoint does not take a country/region filter in the documented request. Do not treat those values as geographically scoped ASO demand.

### Search Term Popularity

The report evaluated exact and partial candidate terms in US, DE and GB, across `HEALTH_FITNESS`/`TRAVEL` and adjacent `LIFESTYLE`/`PRODUCTIVITY_UTILITIES`, including two weekly periods (`2025-07-13` and `2026-10-04`). Search-term filters were tested with `EQUALS`, `CONTAINS`, `STARTS_WITH`, and `IN`.

| Scope/query | Result | Interpretation |
| --- | --- | --- |
| POIS/sexual-health terms, US/DE/GB, Health & Fitness; adjacent Lifestyle | 200 responses, 0 rows for all tested operators and exact candidate lists | No matching rows in this sample; this is unavailable coverage, not zero searches. |
| PASSPORT exact `passport`, US/Travel | `EQUALS` returns 2025-07-13 and 2026-10-04 rows | Confirms the query and historical retrieval work. Recent week: `rankInGenre=321`, `searchPopularityInGenre=59`, overall popularity `50`, tier `3`. These are Apple relative measures, not volumes or this app's rank. |
| PASSPORT `CONTAINS passport`, US/Travel | 9 rows across the two sampled weeks | Includes useful broad interest terms but also irrelevant “passport parking”; candidate-level relevance filtering is required. |
| PASSPORT `STARTS_WITH passport`, US/Travel | 4 rows across the two weeks | Returns `passport` and `passport parking`, demonstrating that prefix match is not intent filtering. |
| PASSPORT in DE/Travel | 0 rows for English `passport`; follow-up German `reisepass`/`passfoto` queries also 0 | Candidate language and market coverage remain limited; no demand-zero claim. |
| PASSPORT in GB/Travel | `CONTAINS passport` returned two mobile-passport-control terms; exact and prefix returned none | Search-term coverage differs by market and lexical form. The rows are not specific to passport-management apps. |
| Pagination | Offset 0 and 20 each returned 20 rows, no duplicate terms in four US genres | Basic pagination works; it does not establish full-catalog completeness. |
| `IN` filter | Single `passport` and two terms (`passport`, `passport parking`) returned the expected one and two rows | Earlier empty multi-term requests were not caused by `IN` pagination; exact query candidate/coverage and period/genre scope explain the observed empties. |

Apple documents 65 weeks of weekly popularity history and 15 months of monthly history. The tested old/new weeks returned the same known passport term; the requested POIS terms remained empty in both sampled periods. That verifies a history path, not complete history for every term. Popularity fields are relative within genre/country or overall country; they are not absolute query volumes, app download attribution, app ranking, or evidence that a candidate converts.

### Evaluation set and prototype POIS research report

The evaluation set included POIS: `POIS`, `post orgasmic illness`, `postorgasmic illness syndrome`, `post-orgasmic illness syndrome`, `post orgasm syndrome`, `orgasm illness`, `post ejaculation illness`, `post orgasm symptoms`, `post orgasm fatigue`, `post orgasm flu`, `male health`, and `sexual health`. PASSPORT: `passport renewal`, `passport photo`, `passport application`, `passport tracker`, `passport expiry reminder`, `passport expiration reminder`, `passport scanner`, `passport photo app`, `travel document`, `passport app`, `visa and passport`, and `passport renewal appointment`. These are researcher-proposed queries, not Apple-confirmed metadata or search-volume terms. German follow-up candidates were `reisepass`, `passfoto`, and `postorgasmisches syndrom`; they returned no rows in the sampled DE week.

| POIS candidate | Apple popularity | Apple suggestions | Relevance assessment | Metadata opportunity |
| --- | --- | --- | --- | --- |
| `post orgasmic illness` | Unavailable: no row in US/DE/GB sampled genres/weeks | InnerType proxy seed returned same term only, score 5 | High semantic relevance; very low suggestion score and not app-scoped to POIS | Preserve exact condition language in app metadata if it truthfully matches the submitted product. Validate wording against the actual approved listing before changing anything. |
| `postorgasmic illness syndrome` / `post-orgasmic illness syndrome` | Unavailable | No distinct suggestion | High relevance, but Apple supplied no independent demand evidence | Test spelling/spacing variants as candidate metadata terms; no ranking or volume claim. |
| `post orgasm symptoms` / `post orgasm fatigue` / `post orgasm flu` | Unavailable | No distinct suggestion | Plausible intent variants, but medical/health language needs product and policy review | Candidate-only; prioritize only if current product claims and listing can substantiate it. |
| `male health` / `sexual health` | Unavailable in the tested query set | No relevant app-specific suggestions | Broad/ambiguous; weak differentiation | Low priority until Apple evidence or actual acquisition data provides a reason to test. |

The POIS and PASSPORT app-scoped suggestion requests were rejected as unknown/access denied. To diagnose seed relevance without changing account access, keyword suggestions were tested using published InnerType as a proxy: 196 unseeded rows were led by social/networking apps and were weakly relevant; POIS seeds returned only `post orgasmic illness` at score 5, while passport seeds returned only `passport renewal` at score 5. US, DE and GB returned the same candidate/score. Those proxy scores are **not** POIS/PASSPORT app-specific evidence and cannot be interpreted as market differences.

No verified current POIS App Store title, subtitle or keyword-field snapshot was available in this read-only proof. Therefore the metadata opportunities above are hypotheses only; do not edit listing metadata from this report. Actual organic positions and keyword competition are **unknown**. The submitted POIS app is not shown in Apple Ads suggestions as an eligible promoted object in this account.

### Paid Apple Ads signals — separate from organic ASO

Read-only `/v1/reports/apps/searchterms/query` was tested against the existing InnerType campaign for `2026-09-19`–`2026-10-16`, with ORTZ daily aggregation. It returned 9 report rows. All were `searchTermSource=TARGETED`; eight had null `searchTermText`, and the one non-null value was not a POIS query. This window therefore supplied no usable observed-query set for POIS research. Only rows whose Apple source marks them as actual `SEARCH` and which expose a search term should be treated as observed paid search terms. Targeted-keyword performance is useful paid reporting but is not organic demand or organic rank.

`/v1/insights/apps/impression-share/query` returned 9 rows in GB for InnerType over four weeks, and 0 rows in US and DE. Example GB values on 2026-10-04: `personality` had 59% impression share, `personality database` 45%, and `personality test` 50%; Apple’s displayed impression-share rank was 1 or 2 for these paid terms. These are Apple Ads auction impressions and paid impression-share ranks, not organic positions. Apple suppresses terms below 10 impressions and buckets shares above 90%; observed US/DE empties cannot be interpreted as no paid or organic demand.

## Optional organic-rank providers

No provider API was called and no credits were spent. Public documentation establishes technical APIs but not Kopa's right to retain and expose third-party rank data as a product.

| Provider | Technical capability / cost model | Licensing and unresolved points | Decision |
| --- | --- | --- | --- |
| AppFollow | Official ASO keyword API can return keyword/rank history by app, market, device and date; request consumes credits (public endpoint documentation lists 10 credits per request). API token and account plan/role required. | Current terms restrict collecting Service contents for commercial use in the customer's own name without express written consent. The current plan's credits, daily coverage, rank method, history window, and Kopa caching/display rights need a written vendor answer. | Optional validation only until written data-use and retention permission plus a capped quote are secured. |
| AppTweak | Official API documents app keyword rankings and history across 100+ countries. History is credit-based: rank costs 10 credits for the first date plus 1 credit for each additional available date per app/keyword; up to five keywords per history request. | Public self-serve terms grant internal-business use and a non-transferable license for the customer's own benefit/internal purpose. This does not establish rights to expose their data in Kopa as an ASO product. Plan price, exact country/device sampling method, coverage and cache/retention rights need contract confirmation. | Technically stronger candidate for a small benchmark, but not an independent-owned data source; proceed only after rights/cost approval. |

AppFollow API endpoint and AppTweak's documented market data may support optional benchmarking, but neither provides an independent in-house-owned ranking method. No unauthorized App Store scraping, reverse engineering, or automated store searches were attempted.

## Implementation and validation

Added narrow read-only client calls for Phrase Suggestions SEARCH/SUGGESTION, Search Term Popularity filter operators, existing-campaign search-term reports and Impression Share. Added mocked contract tests and gated live evaluation tests. The live tests contact Apple only when `KOPA_APPLE_ADS_V1_ASO4_LIVE_EVAL=1`; evidence is written under `/private/tmp` with owner-only permissions. No bearer tokens or signing keys are persisted in evidence.

Validation run: focused Apple Ads unit/live test suite **passed** (7 passed, 2 skipped when live mode is off); the two bounded live evaluations passed; `npm run typecheck` passed. The live query was read-only. Exact commands and evidence hashes are in the local test output and this document; no Supabase migration or dashboard is warranted at this gate.

## Next decision and preserved roadmap

1. **ASO-4 feasibility proof: complete with a NO-GO for a production engine.** Keep this report and the live test as proof; do not silently promote Apple empty rows to zero.
2. **ASO-4b / previously planned persistence milestone: queued, not started.** Keep its append-only Apple popularity/suggestion data contract and additive Supabase design intact. Revisit only when app-scoped useful rows or another source passes rights and quality gates.
3. **ASO-5 evidence-based intelligence: queued.** Do not score opportunities until POIS-specific source rows, a verified listing metadata snapshot, and independent ASC acquisition measures can be joined without implying keyword attribution.
4. **ASO-3 App Store Connect refresh remains on the roadmap.** Approved ONGOING requests for POIS, PASSPORT and LoveType were still awaiting generated instances at the prior 17 October check, inside Apple's first-generation window. After that window, rerun the existing read-only App Store Connect report-generation/refresh path, validate generated instances against official report definitions, and update the current source-of-truth snapshot. No second extractor is needed.
5. Keep ASO-2's **NO-GO** on unauthorized organic ranking intact. A later licensed-provider trial requires explicit capped cost and written in-house retention/display rights.

### Official sources

- Apple [Phrase Suggestions](https://developer.apple.com/documentation/apple-ads-platform-api/query-phrase-suggestions), [Suggestions endpoints](https://developer.apple.com/documentation/apple-ads-platform-api/suggestions-endpoints).
- Apple [Search Term Popularity](https://developer.apple.com/documentation/apple-ads-platform-api/query-app-search-term-popularity-data), [history window](https://developer.apple.com/documentation/apple-ads-platform-api/searchtermpopularitytimerange), and [Insights endpoints](https://developer.apple.com/documentation/apple-ads-platform-api/insights-endpoints).
- Apple [Impression Share query](https://developer.apple.com/documentation/apple-ads-platform-api/query-app-impression-share-data) and [App Store search-term reports](https://developer.apple.com/documentation/apple-ads-platform-api/app-store-reports-endpoints).
- AppFollow [ASO API documentation](https://docs.appfollow.io/reference/get_api-v2-aso-keywords) and [Terms](https://get.appfollow.io/terms).
- AppTweak [keyword ranking history API](https://developers.apptweak.com/reference/keyword-metrics-by-app-history), [API pricing/credits](https://developers.apptweak.com/reference/pricing-table), and [self-serve terms](https://www.apptweak.com/en/legal/terms-of-services).
