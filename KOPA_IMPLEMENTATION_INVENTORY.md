# Kopa Tools implementation inventory

Status: authoritative audit inventory
Audit date: 2026-07-28
Evidence: repository at `0b9b3b0d`, production deployment inspection, and read-only production database queries

This inventory records what exists, what has actually been verified, and what the active product roadmap should do with it. `Verified` means code tests, production records, or deployment state were directly inspected; it does not mean every authenticated screen has received end-to-end acceptance testing.

Decision values are limited to `KEEP`, `COMPLETE_NOW`, `FIX_FIRST`, `MERGE`, `DEFER`, `REMOVE_AFTER_MIGRATION`, `OBSOLETE`, and `NEEDS_PRODUCT_DECISION`.

## Core ASO

| Area | Planned | Implemented | Verified | Production status | Blocker or gap | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Apps | Owned-app catalogue and Apple lookup | Read/list/create, app detail, primary storefront creation | Code and 1 production app | Usable | Owner write flow lacks current production acceptance record | KEEP |
| Keyword tracking | Per-app terms, market, priority, status, bulk operations | Create/edit/delete, search/filter/sort, saved views and bulk priority/pause | Code, tests, 99 production assignments in 10 markets | Usable | Repository hard cap is 200; no pagination | KEEP |
| Ranking history | Daily owned and competitor ranks with movement | Collector snapshots, current rank table, 35-day history view | 3,596 production snapshots; latest 2026-07-28 | Data usable; presentation weaker than AppFollow | `/rankings` is not in ASO child navigation and lacks the target comparison table/drawer | COMPLETE_NOW |
| Competitor tracking | Catalogue, snapshots, contested terms, change feed | Create/read, snapshots, filters, battlefield and contested terms | Code and 3 production competitors | Usable | Competitor subtitle is deliberately unavailable; authenticated comparison still pending | KEEP |
| Localizations / Markets | Market readiness and storefront coverage | Derived market rows combine activity signals with separate verified-or-unknown metadata, screenshot and app-language evidence | Code, tests, production inputs, and signed-in GB acceptance | Honest but incomplete | GB has no localization evidence and correctly remains Unknown; only US has an exact-country metadata snapshot | KEEP |
| Metadata snapshots | Public listing history | Collector checksum snapshots | Code and 1 production snapshot | Collecting | Only primary-country owned metadata is collected; subtitle remains existing DB value | KEEP |
| Metadata change events | Detected/manual change timeline | Schema and collector diff logic | Code; 0 production rows | Foundation only | No automatic measurement windows or first-class metadata workflow | COMPLETE_NOW |
| Insights | Deterministic ASO rules and lifecycle | 13 rule families, active/dismiss/snooze/complete | Code and 9 production rows | Usable but noisy | Legacy dedupe keys do not include a uniform evidence window/action contract | MERGE |
| Experiments / Change Log | Log changes and measure outcomes | Create/edit/filter; one production record; optional measurement fields | Code and production row | Partially usable | No automatic before/indexing/after windows; product change log and statistical experiment concepts share one table | COMPLETE_NOW |
| Review intelligence | Reviews, rule classification and trends | Collection, topic/rating filters, classifications | Code inspected | Usable if rows exist | Not central to the reset; production row counts not audited in this milestone | KEEP |
| Public App Store scraper | Metadata, ranks, competitors, reviews, insights | Cron/manual collector with DB lease and idempotent daily keys | Code and repeated successful production runs | Working | Maximum 50 terms/run; freshness is a rotating sweep | KEEP |
| Data collection controls | Queue and collection history | `aso_jobs`, worker claim RPC, wake path, run/error history | 9/9 production jobs completed; latest 54/54 | Working | Only broad `collection` job type exists | KEEP |
| Legacy hidden console | Rollback/reference UI | Still present in root static site | Repository presence | Compatibility only | Duplicates forward Tools workflows and keeps older browser access patterns | REMOVE_AFTER_MIGRATION |

## App Store Connect

| Area | Planned | Implemented | Verified | Production status | Blocker or gap | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication | Server-only JWT/private-key access | Retained root integration; Tools proxies with `CRON_SECRET` | Code and existing production rows | Working | Credentials intentionally split across deployments | KEEP |
| App mapping | ASC resource ID mapped to Kopa app | Additive `appstore_connect_id` field | Migration and repository code | Present | Exact production mapping value not printed during audit | KEEP |
| Report requests | Ongoing analytics request lifecycle | Request/status table and source status UI | Code and tables exist | Usable | Owner acceptance and error-state walkthrough remain unverified | KEEP |
| Discovery & Engagement parsing | Tab-delimited Apple analytics segments | Versioned parser handles tab format and retained comma fixtures; stores raw rows, headers, counts, issues and explicit result state | Code/tests, 78 production storefront facts, and signed-in `discovery-v2` acceptance | Working and verified for one production report | Broader cross-source completeness remains separate work | KEEP |
| Storefront metrics | Impressions/page views by market/source | 28-day summaries, trend/source cards, recommendations | Code and live rows through 2026-07-27 | Usable | Metric presentation can mix sparse markets and window halves without a completeness score | FIX_FIRST |
| Download/sales data | Downloads/proceeds by day and storefront | Sales import, date normalization, currency preservation | Code and 74 daily rows | Usable | `downloads` is null on Discovery rows by design; UI must not read it as zero | KEEP |
| Error handling | Honest waiting/partial/error state | Diagnostic responses, sync summaries and blockers | Code inspected | Partially usable | Technical errors remain spread across Dashboard, Sources, Jobs and Health | MERGE |
| Data freshness | Source timestamps and status | Latest request/run timestamps and 28-day windows | Code and live timestamps | Incomplete | No uniform freshness/completeness contract across all product recommendations | FIX_FIRST |

## Apple Ads

| Area | Planned | Implemented | Verified | Production status | Blocker or gap | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| OAuth | API v5 client credentials | Token cache and ACL discovery | Tests, live connection history | Working | None for read-only mode | KEEP |
| Organization mapping | Save selected Apple Ads organization | Owner-only connection record | Code and live imports | Working | Owner-only model, no tenant boundary | KEEP |
| App mapping | Adam ID to `aso_apps` | Mapping route/repository/table | Code; campaigns resolve to app | Working | Mapping UI is technical administration | MERGE |
| Campaign sync | Read campaigns and store raw payloads | Paginated import plus queued run | 2 live campaigns | Working | Campaign worker covers only `campaigns`; later steps use page requests | FIX_FIRST |
| Ad-group sync | Read ad groups | Structure service and storage | 5 live rows | Working | Runs synchronously in an owner page request, contrary to operations doc | FIX_FIRST |
| Keyword sync | Read targeting keywords | Structure service and storage | 33 live rows | Working | No tombstone pass for source rows that disappear unless Apple returns them deleted | KEEP |
| Negative-keyword sync | Read negatives | Structure service and storage | 33 live rows | Working | Same structure-run durability gap | KEEP |
| Search Match mapping | Use API v5 `automatedKeywordsOptIn` | Boolean/string/null mapping, raw-payload fallback, real fixture test | Code/tests/live rows | Mostly correct | German “Core Exact” has Search Match true; naming and intended traffic boundary conflict and need owner review | KEEP |
| Campaign reporting import | Seven-day campaign metrics | Parser, explicit idempotent lookup/update | 8 live daily rows | Working | Stored country is `all`, so campaign market is not carried into the metric row | FIX_FIRST |
| Search-term import | Query-level report rows | Parser, importer, source keyword/match source/raw payload | 6 live rows | Working | Ad-group and keyword IDs are null in live rows; scope must be reconstructed cautiously | FIX_FIRST |
| Keyword intelligence | Structure findings and coverage | Duplicate, negative, match-type and status checks | Tests and live structure | Usable with caveats | Duplicate scope lacks organization/app/traffic boundary; negatives are compared globally in one read model | FIX_FIRST |
| Search-term recommendations | Exact/negative suggestions | Deterministic scoring and persistence | Code/tests; 0 live recommendations | Inaccurate for current evidence | Token-overlap heuristic cannot recognize `lovense`, `lovense remote`, or `y not` as clearly irrelevant; freshness also expires after 48 hours; only exact-add/negative-exact persist | FIX_FIRST |
| Broad-keyword diagnosis | Review source broad keyword from poor queries | Not implemented | Live source keyword `relationship test` observed | Missing | No aggregation from bad queries to source keyword/ad group | COMPLETE_NOW |
| Insufficient conversion evidence | Withhold conversion judgment at low taps | Low-volume evidence stage exists | Four live taps, zero installs | Not expressed as a user-facing conclusion | Engine can say “learning,” but cannot state “four taps are insufficient to judge store conversion” | COMPLETE_NOW |
| Research Planner | Draft-only paused campaign plan | Local planner and tests | Code/tests | Usable as a draft utility | Adds a separate technical surface before the core decision workflow is strong | DEFER |
| Guardrails | Deterministic future write constraints | Pure guardrail engine and tests | Code/tests | Foundation only | No reviewed write boundary; no need while Automation Level 0 remains | DEFER |
| Write actions | Mutate bids/budgets/keywords/campaigns | Not implemented | Provider interface inspected | Correctly absent | Explicitly out of scope | DEFER |
| Attribution | Server-to-server install intake and status | Kopa schema/bearer endpoint/repository/pages plus a separately documented shared analytics `installs`/Edge Function path | Code; 0 Kopa attribution events | Two foundations, neither reconciled here | Canonical identity/path, app integration, volume, retention and decision use are unresolved | DEFER |
| Automation levels | Level 0 read/import/recommend | No mutation methods or write routes | Code inspected | Correct | Maintain current boundary | KEEP |

## Platform

| Area | Planned | Implemented | Verified | Production status | Blocker or gap | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Primary navigation | Product workspaces | Dashboard, Product Analytics, Apps, ASO, Apple Ads, Actions, Data & Integrations | Code and deployment routes | Engineering-oriented | Too many implementation concepts; Rankings omitted as child; attribution was exposed before readiness and is now hidden in the repository pending deployment | FIX_FIRST |
| Global context | App/market/period everywhere | Query-param context bar and context-preserving links; Recommendations enforce app/market in ASO, Apple Ads and Discovery reads | Code, tests, and signed-in InnerType/GB acceptance | Partial but verified for Recommendations | Other repositories still ignore one or more selected context values; period remains fixed in some assessments | FIX_FIRST |
| Dashboard | Portfolio metrics, blockers, action count | Summary cards, blockers, operations disclosure | Code | Usable as health overview | Does not answer “what changed since last visit” or show three concrete next actions | MERGE |
| Today page | Decision-first default | Not implemented | — | Missing | Depends on trustworthy scoped events and recommendations | COMPLETE_NOW |
| Rankings product page | AppFollow replacement | Separate current keyword and history pages | Code/live rank data | Fragmented | Needs one decision-oriented table and details | MERGE |
| Markets product page | International comparison | `/localizations` plus ASO overview readiness summary | Code/live inputs and signed-in GB acceptance | Trustworthy evidence states; still fragmented | Merge the two market views only after remaining global context enforcement | MERGE |
| Apple Ads workspace | Diagnosis-first acquisition view | Overview, structure, reporting, keyword intelligence, planner | Code/live inputs | Fragmented | Technical setup and source pages lead over diagnosis | MERGE |
| Recommendation persistence | Auditable stored recommendations | `aso_insights`; Apple snapshots/recommendations | Migrations/code/live counts | Split | Two schemas, status models and dedupe approaches | MERGE |
| Recommendation feedback | Accept/reject/snooze/complete | ASO has lifecycle; Apple Ads rows are display-only | Code | Inconsistent | Unified feed cannot manage Apple Ads lifecycle | FIX_FIRST |
| Data quality | Health checks and status pages | Dashboard blockers, ASC sources, Jobs, Apple Ads Health | Code/live data | Duplicated | Same issue can surface in several places without a single trust contract | MERGE |
| Export review pack | Zip export endpoint/service | Implemented | Code inspected | Manual utility | Keep out of primary flow | KEEP |
| Authentication | SSR session plus allowlist | Protected pages/routes, owner role seam | Tests/docs/deployment redirect | Working | Authenticated owner and unauthorized account acceptance remain undocumented | COMPLETE_NOW |
| Multi-tenant readiness | Organizations, invitations, scoped credentials | Only nullable seams | Code/schema | Not implemented | Not required for owner-only product | DEFER |
| Testing | Unit, typecheck, build, E2E | 17 test files / 50 tests | Typecheck, all 50 tests and production build passed in this milestone | Good unit baseline | No authenticated browser E2E; lint config missing | FIX_FIRST |
| Production deployment | Independent Tools app | `tools.kopa.studio` | Vercel deployment `dpl_EUwCX3SAYoCms1bdfqm1GSAUo9Ee` is Ready | Working | Deployment created 2026-07-28 00:21 CEST; repository HEAD is later, so exact source parity is not proven | FIX_FIRST |
| Technical compatibility routes | Preserve old URLs during consolidation | All old routes remain | Code/deployment route list | Working | Duplicates primary concepts | REMOVE_AFTER_MIGRATION |

## Current Apple Ads evidence check

Observed from the production database on 2026-07-28:

| Evidence | Observed | Required product conclusion | Current engine |
| --- | --- | --- | --- |
| `lovense` | 203 impressions, 0 taps, sourced from broad `relationship test` | Exclude as negative exact | No recommendation |
| `lovense remote` | 68 impressions, 0 taps, sourced from broad `relationship test` | Exclude as negative exact | No recommendation |
| `y not` | 30 impressions, 2 taps, 0 installs, €1.1494, Search Match/AUTO | Exclude as negative exact | No recommendation |
| `relationship test` broad | Source of two clearly irrelevant query families | Pause or review broad target | No rule or recommendation type for source-keyword review |
| `personality test` | Exact and broad target coverage; no search-term row in the current import | Continue learning, do not change from current evidence | No explicit current recommendation |
| Campaign total | 388 impressions, 4 taps, 0 installs, €1.9745 across 2026-07-24–27 | Conversion is unknown; four taps are insufficient | No user-facing sufficiency conclusion |

Why the engine fails:

1. Relevance begins at 35 and is raised by taps; it has no semantic/product-fit classifier or curated irrelevant-term boundary.
2. A negative exact requires relevance below 25, spend above zero, and confidence at least 60. Zero-spend irrelevant impressions can never qualify.
3. Only `ADD_EXACT_KEYWORD` and `ADD_NEGATIVE_EXACT` are persisted.
4. There is no aggregation rule that blames a broad source keyword for multiple irrelevant queries.
5. Search-term evidence becomes stale after 48 hours, while the UI does not distinguish “historically decisive” from “currently fresh.”
6. The low-volume model stages evidence but does not emit a separate store-conversion conclusion.

## Attribution architecture conflict to preserve and resolve later

`shared-analytics-migration.md` documents a shared analytics attribution Edge Function writing `installs` by `(app_id, anonymous_id)`. Kopa Tools separately implements `/api/apple-ads/attribution` and `apple_ads_attribution` by `(aso_apps.id, installation_key)`. No code in this repository proves that these identities or records are joined.

Do not delete either foundation during the deferral. Before resuming, choose one canonical intake and identity contract, document migration/compatibility behavior, and prevent the app from sending the same install through two competing paths.
