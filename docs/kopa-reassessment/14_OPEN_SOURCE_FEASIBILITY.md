# 14 — Open-source feasibility and reuse decisions

Reviewed 15 October 2026. **Signal is selected; development implementation is authorized.** This is a bounded source review, not a security certification or proof of live ranking accuracy. Five candidate repositories were shallow-cloned into isolated scratch storage. PostHog was inspected through pinned source files; its recursive tree response was truncated. No candidate dependencies were installed, no upstream scripts ran, no candidate received app credentials, and no candidate source code was copied into Kopa.

## Decision matrix

| Candidate / snapshot | Actual source and fit | Decision | Maintenance / operation / license |
|---|---|---|---|
| ASO Studio, `dsm5e/aso-tracker` · `0c92ff4` · last commit Oct 2 | Native-style MZStore search parser; separate iTunes method. React/TypeScript, SQLite, Express; Apple Ads transport and charts are relevant references. | **Adapt narrowly after method validation.** Keep Kopa; no whole-app import. | MIT notice required if copied. Search throttling and scheduled collection still need an operator, permitted access and native comparison. Local API includes writers; never expose it with live credentials as a read-only service. |
| AppRankly · `509c714` · Oct 9 | Official ASC sales reports, React cohort UI. Its retention values are proxies, not observed returns. | **Borrow visual concepts; reject retention math.** | AGPL-3.0 is a material constraint before source reuse/network deployment. Node/React plus report processing and optional AI configuration; not a drop-in Next/Supabase component. |
| ASOpulse · `0b74be2` · Sep 4 | iTunes Search, limit 200; project/storefront identities, observations, sparklines, failed-keyword outcomes. | **Borrow collection-gap and market-isolation concepts.** Reject authoritative organic-rank interpretation. | AGPL-3.0-only. Provider cache/request spacing, scheduler, database and web operation. Do not transplant code without license review. |
| OpenASO · `7bf86b9` · Aug 16, v0.4.5 | macOS SwiftData; App Store web search with explicit iTunes fallback, Apple Ads web-session popularity workflow. | **Algorithm/contracts reference.** No Swift UI port or session-cookie reuse. | MIT. Native/macOS runtime mismatch; parsing and web-session expiry require maintenance. Tests exist for source fallback and research workflow; inspected, not executed. |
| ASO Copilot · `9e1026f` · Jul 29 | Next/Prisma/MCP, iTunes search and PostHog API daily active-person query. | **Integrate API concepts, independently implement scoped tools.** | MIT license file verified. Next/Postgres/Prisma and optional AI/provider dependencies. Query failures returning null need explicit health reasons; arbitrary SQL/MCP writes must not reach Kopa's future analyst. |
| PostHog · `a22e815` · pushed Oct 14 | Actual event-based funnel/path/retention engines and APIs. Good engine integration; poor fit as an embedded source-code fork. | **Prefer a bounded EU API integration trial**, after identity/privacy/budget gates. Keep small Kopa definitions and exports. | Root MIT excludes separately licensed `ee/` code. Self-hosted operation is unsupported and paid features are Cloud-only per current docs. No assumption of full cloud feature parity in FOSS. |

Full commit SHAs and reproducible links appear below. Commit dates indicate activity at review time, not a support guarantee. Candidate test files were read, not run; Kopa's own tests were executed separately.

## ASO Studio: ranking claim audited in code

`aso-keywords/server/itunes.ts` calls **`https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search`**, passing `term`, `media=software`, `clientApplication=Software`, a hard-coded iPhone/iOS user agent and numeric `X-Apple-Store-Front`. `parseMzSearch` finds a software bubble and takes its ordered numeric IDs. This differs from ordinary `itunes.apple.com/search`, but its positions are not automatically proven authoritative organic ranks.

The inspected parser has no explicit sponsored-result classifier. A missing software bubble becomes an empty result; a changed envelope can fail parsing. The request does not establish a 250-result pagination/completeness contract. Country normalization cannot prove arbitrary locale/device parity, and its fixed iPhone user agent does not validate iPad results. Tests cover parser/source distinctions, gaps, storefront headers and lookup batches; they do not substitute for a native session comparison. Current `searchAppStore` propagates failures; older comments mentioning iTunes fallback do not describe that current path.

`host-gate.ts` implements coalescing, an adaptive request gate starting at 24/minute (maximum 40), burst one, and a five-minute pause plus rate reduction after 403/429. Optional extra egress lanes exist; **Kopa should not use rotating egress to bypass source limits**. A public endpoint and an MIT client do not establish Apple's permission to collect/store/reuse its data. No native-search request or device comparison was performed in this spike. Therefore neither “a paid rank provider is necessary” nor “we can replace one for free” is established.

Next source experiment: a few owned app / exact term / country / locale / iPhone cases, with captured date, returned depth, sponsor classification, native result evidence and collection failures. Review permitted access/storage/AI rights before scheduled use. An iTunes fallback remains a separately named method and never splices into an organic series.

### Apple Ads and account security

`asa-ads/server/platform-api-client.ts` is a useful contract reference: Platform v1 base URL, account context, request IDs, response metadata, credential redaction, 10-second request timeout, four-attempt retry loop and page-size clamp to 1,000. Its `queryRows` stops at 20 pages and then reports the count it collected as total; that cap must become an explicit **incomplete** result in Kopa, not silent completeness. Its transport accepts GET/POST as “read-only”; verbs alone do not prevent a caller from invoking an unsafe POST path. Kopa needs an allowlist of exact read/report operations.

`asa-client.ts` signs ES256 OAuth assertions, caches/coalesces token exchange, and also supports PUT/DELETE and campaign operations. The dashboard server is intended for local operation; the inspected route setup does not establish Kopa-style owner authorization. Keep existing Kopa auth and server-side secret storage. Do not import the server, its CLI migration/cutover scripts, or its credential-bearing session model.

React `HeroChart`, `Sparkline` and `KeywordResultsDrawer` provide interaction references, not copied components. Ad metrics must remain native currency/timezone and selected attribution with complete pagination; a visually plausible chart does not validate a report.

## AppRankly: reject fabricated retention

`app/lib/AppleAppStoreStatsViewer.js` fetches official `/v1/apps` and `/v1/salesReports`. Sales proceeds are multiplied by units in the inspected parser, which is a useful comparison case for Kopa's official-report tests.

`app/frontend/src/components/RetentionCohortHeatmap.jsx` groups weekly install/uninstall values, supplies a fallback cohort size, clamps an install/uninstall ratio, and applies fixed D7/D14/D30/D60 multipliers and floors. These are **not identity-based return cohorts**. Another `retentionRate` field is 100 whenever installs are positive. Copying these calculations would reproduce the precise credibility problem this rebuild is intended to fix. Kopa's cohort grid uses observed app-scoped identities and return events; unknown or immature windows have no inferred rate.

## ASOpulse, OpenASO and Copilot

ASOpulse's `packages/providers/src/apple-search.ts` calls iTunes Search with `entity=software`, `limit=200`, a country cache, a 10-second timeout and minimum 3.1-second spacing. `packages/domain/src/ranking.ts` describes null as beyond 200 in some presentation/movement calculations: do not turn a missing rank into a numeric position. `RankSparkline.tsx` distinguishes failed observations and censored ranks; retain the idea of gaps, not synthetic boundary math. `packages/core/src/service.ts` scopes projects by storefront, persists observations and records individual keyword failures rather than treating every run as complete.

OpenASO's `AppStoreWebRankingProvider.swift` parses `apps.apple.com/{country}/{iphone|ipad}/search` and hydrates with lookup data. `ITunesSearchFallbackProvider.swift` and `PrimaryFallbackSearchRankingProvider.swift` make the fallback explicit. `KeywordResearchMetricsWorkflow.swift` records freshness/disposition, reconnect/error states and an honest `sharedCacheContextUnknown` provenance when cached popularity lacks account/app context. These are valuable data-contract patterns. A web-session popularity value is not query search volume or organic rank.

Copilot's `src/lib/stores/appstore.ts` is iTunes/hint based. `src/lib/posthogIntegration.ts` supports EU/US hosts and posts HogQL to `/api/projects/{id}/query/`, counting distinct `person_id` by day. It does not establish equivalence with Kopa's anonymous-install identity. A caught failure becomes null; Kopa must return a source-error reason instead. Keep credentials server-side, use minimal read scopes, validate project/app ownership and allowlist definitions before exposing any future MCP tool.

## PostHog: integrate the engine instead of cloning it

Pinned `products/product_analytics/backend/hogql_queries/funnels/funnel.py` distinguishes conversion windows, strict ordering and person/session aggregation. Retention query tests create actual people/events and check returned cohorts; paths distinguish person and session actor expressions. These are established engine responsibilities, not a dashboard widget to copy. Kopa's small fixture engine implements only the explicitly documented definitions required for review; it is not a warehouse, SDK, arbitrary SQL editor, identity-merging platform or replay system.

Recommended next trial: server-side **EU** adapter for versioned, allowlisted definitions, mapping `app + anonymous installation` without automatic person merges. Compare one InnerType ordered funnel and D7 cohort against manually reviewed, minimized event evidence and Kopa's contract tests. Use an existing approved project if available; no account, SDK, import or paid plan has been created. Query API and exported facts must retain the same identity, timezone, event definition, horizon and incomplete-partition states.

Current official documentation: EU capture/private API hosts differ from US, personal keys can access private data, and analytics/query endpoints have separate limits. The query endpoint is currently limited to 2,400/hour and an additional personal-key read budget; repeated interactive dashboards may require caching or a different vendor endpoint agreement. Do not assume unlimited free user-facing query traffic. [API overview](https://posthog.com/docs/api).

EU Cloud is offered in Frankfurt and a DPA is available. Regional hosting alone does not validate Kopa's lawful basis, consent, minimization, deletion or transfer/subprocessor arrangements. [Privacy controls](https://posthog.com/docs/privacy).

Pricing checked Oct 15: 1M analytics events/month, one free project and one-year free retention; paid plans list seven-year retention. Above-cap events may be dropped even when capture returns success. Model event volume, query cost/limits, allowed history and export recovery before choosing a plan. A spend cap that drops events must also mark coverage incomplete. No price or plan is a Kopa purchase commitment. [Pricing](https://posthog.com/pricing).

Self-hosting means owning infrastructure, upgrades, backups and loss recovery; the current docs say it is unsupported, has no tagged releases, and limits paid features to Cloud. Root MIT and `ee/LICENSE` still require checking each reused feature. This is not the low-maintenance default for this small team. [Self-hosting](https://posthog.com/docs/self-host).

## Concrete savings and what is actually validated

1. **Recharts reused now**, through its normal package license, for responsive line charts, tooltips, inverted rank axes, annotation lines, brush selection and keyboard navigation. Kopa owns metric semantics and source state. This avoids a custom chart interaction engine; tests and browser checks validate Kopa behavior, not upstream ranking accuracy.
2. **PostHog integration boundary selected**, avoiding a speculative warehouse/identity/replay rebuild. API and engine feasibility were verified in primary documentation and code. Real account entitlement, accuracy parity, volume cost and privacy setup remain gates; no claimed time saving is measured in days.
3. **ASO Studio narrows the rank-source spike** to a concrete endpoint/parser and failure contract. Its code disproves the idea that its ranking claim is just ordinary iTunes Search, but does not prove organic precision or durable permitted collection. This saves blind scraper research; live source acceptance is still required.

## Reproducible source index

### dsm5e/aso-tracker · `0c92ff4374122ec17fc5036078a42e923165cfd5`

- [LICENSE](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/LICENSE)
- [aso-keywords/server/itunes.ts](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/aso-keywords/server/itunes.ts)
- [aso-keywords/server/host-gate.ts](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/aso-keywords/server/host-gate.ts)
- [aso-keywords/server/rank-source.test.ts](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/aso-keywords/server/rank-source.test.ts)
- [asa-ads/server/platform-api-client.ts](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/asa-ads/server/platform-api-client.ts)
- [asa-ads/server/platform-api-client.test.ts](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/asa-ads/server/platform-api-client.test.ts)
- [asa-ads/server/asa-client.ts](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/asa-ads/server/asa-client.ts)
- [asa-ads/server/index.ts](https://github.com/dsm5e/aso-tracker/blob/0c92ff4374122ec17fc5036078a42e923165cfd5/asa-ads/server/index.ts)

### zmsp/AppRankly · `509c714d17afdbdaa78a9d917e818e3d58811a55`

- [LICENSE](https://github.com/zmsp/AppRankly/blob/509c714d17afdbdaa78a9d917e818e3d58811a55/LICENSE)
- [app/lib/AppleAppStoreStatsViewer.js](https://github.com/zmsp/AppRankly/blob/509c714d17afdbdaa78a9d917e818e3d58811a55/app/lib/AppleAppStoreStatsViewer.js)
- [app/frontend/src/components/RetentionCohortHeatmap.jsx](https://github.com/zmsp/AppRankly/blob/509c714d17afdbdaa78a9d917e818e3d58811a55/app/frontend/src/components/RetentionCohortHeatmap.jsx)

### ayushhagarwal/asopulse · `0b74be217cabbe8a2bd34011c20691f5ac56f011`

- [LICENSE](https://github.com/ayushhagarwal/asopulse/blob/0b74be217cabbe8a2bd34011c20691f5ac56f011/LICENSE)
- [packages/providers/src/apple-search.ts](https://github.com/ayushhagarwal/asopulse/blob/0b74be217cabbe8a2bd34011c20691f5ac56f011/packages/providers/src/apple-search.ts)
- [packages/domain/src/ranking.ts](https://github.com/ayushhagarwal/asopulse/blob/0b74be217cabbe8a2bd34011c20691f5ac56f011/packages/domain/src/ranking.ts)
- [packages/core/src/service.ts](https://github.com/ayushhagarwal/asopulse/blob/0b74be217cabbe8a2bd34011c20691f5ac56f011/packages/core/src/service.ts)
- [apps/web/src/features/watchlist/RankSparkline.tsx](https://github.com/ayushhagarwal/asopulse/blob/0b74be217cabbe8a2bd34011c20691f5ac56f011/apps/web/src/features/watchlist/RankSparkline.tsx)

### hubab1/OpenASO · `7bf86b9c4f386119b6c6bfa031c26d6e2cb6e054`

- [LICENSE](https://github.com/hubab1/OpenASO/blob/7bf86b9c4f386119b6c6bfa031c26d6e2cb6e054/LICENSE)
- [OpenASO/Services/SearchRanking/AppStoreWebRankingProvider.swift](https://github.com/hubab1/OpenASO/blob/7bf86b9c4f386119b6c6bfa031c26d6e2cb6e054/OpenASO/Services/SearchRanking/AppStoreWebRankingProvider.swift)
- [OpenASO/Services/SearchRanking/ITunesSearchFallbackProvider.swift](https://github.com/hubab1/OpenASO/blob/7bf86b9c4f386119b6c6bfa031c26d6e2cb6e054/OpenASO/Services/SearchRanking/ITunesSearchFallbackProvider.swift)
- [OpenASO/Services/AppleAds/KeywordResearchMetricsWorkflow.swift](https://github.com/hubab1/OpenASO/blob/7bf86b9c4f386119b6c6bfa031c26d6e2cb6e054/OpenASO/Services/AppleAds/KeywordResearchMetricsWorkflow.swift)

### Aero25x/ASO-Copilot · `9e1026fe5c654196d2de1e00675ddb0212b493ab`

- [LICENSE](https://github.com/Aero25x/ASO-Copilot/blob/9e1026fe5c654196d2de1e00675ddb0212b493ab/LICENSE)
- [src/lib/stores/appstore.ts](https://github.com/Aero25x/ASO-Copilot/blob/9e1026fe5c654196d2de1e00675ddb0212b493ab/src/lib/stores/appstore.ts)
- [src/lib/posthogIntegration.ts](https://github.com/Aero25x/ASO-Copilot/blob/9e1026fe5c654196d2de1e00675ddb0212b493ab/src/lib/posthogIntegration.ts)

### PostHog/posthog · `a22e8155fe8df55649ae488f331addf3fe5a1efa`

- [LICENSE](https://github.com/PostHog/posthog/blob/a22e8155fe8df55649ae488f331addf3fe5a1efa/LICENSE)
- [ee/LICENSE](https://github.com/PostHog/posthog/blob/a22e8155fe8df55649ae488f331addf3fe5a1efa/ee/LICENSE)
- [products/product_analytics/backend/hogql_queries/funnels/funnel.py](https://github.com/PostHog/posthog/blob/a22e8155fe8df55649ae488f331addf3fe5a1efa/products/product_analytics/backend/hogql_queries/funnels/funnel.py)
- [products/product_analytics/backend/hogql_queries/retention/test/test_retention_query_runner.py](https://github.com/PostHog/posthog/blob/a22e8155fe8df55649ae488f331addf3fe5a1efa/products/product_analytics/backend/hogql_queries/retention/test/test_retention_query_runner.py)
- [products/product_analytics/backend/hogql_queries/paths/paths_query_runner.py](https://github.com/PostHog/posthog/blob/a22e8155fe8df55649ae488f331addf3fe5a1efa/products/product_analytics/backend/hogql_queries/paths/paths_query_runner.py)
