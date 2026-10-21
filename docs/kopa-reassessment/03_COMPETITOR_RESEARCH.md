# 03 — Competitor research and build-versus-buy boundary

Reviewed 2026-10-14. Public vendor documentation and current product pages were inspected. **No authenticated vendor product was operated and no claimed accuracy, uplift, availability for this account, or support quality was independently validated.** “Documented” below means the vendor describes it; Kopa relevance is our assessment.

## Capability matrix

| Area | AppTweak | AppFollow | Sensor Tower | Kopa disposition |
|---|---|---|---|---|
| Keyword research | Suggestions, demand/popularity, difficulty and modeled opportunity metrics [A2] | Research and keyword tracking [F1] | Discovery, traffic/difficulty/opportunity, intent/type grouping [S1] | Essential: relevant watchlist and explicit provenance; buy broad discovery |
| Rank history | App/keyword historical API, explicit collection/missingness contract [A1] | ASO endpoint with app/country/device/date/page; exact returned schema needs trial [F2] | Rank trends and keyword performance tracking documented [S1] | Essential: narrow multi-market series; do not reproduce global collection |
| Competitor intelligence | Listing changes, metadata timeline, live search [A3] | Competitor monitoring and ASO [F1] | Keyword gaps/shared terms and competitor comparisons [S1] | Track a few relevant rivals and material changes |
| Metadata/localization | Analysis and timeline in paid UI [A3] | Metadata/ASO analysis [F1,F3] | Keyword localization and competitor strategy [S2] | Own official metadata + drafts/change annotations; no automatic publication |
| Apple Ads | Campaign Manager, automation and AI advice documented [A4] | Search Ads-related ASO API exists; full bid/budget optimization not established here [F2] | Paid-search indicators/intelligence; authenticated campaign management parity not verified [S1,S2] | Official own-account reports first; defer optimization engine |
| Downloads/revenue | Console connections plus market/keyword estimates [A1,A3] | Console aggregation listed; subscription cohort/ROAS depth not verified [F1] | Market download/revenue estimates [S2] | Official owned-app facts; estimates isolated and optional |
| Experiments | Metadata/A-B timeline documented; causal measurement contract not inspected [A3] | A controlled experiment measurement engine was not verified | Controlled experimentation workflow was not verified | Build simple hypothesis/change/evidence log; use Apple PPO for randomized creative tests |
| AI | ASO/Ads/Reviews agents retrieve evidence and recommend, without automatic account changes [A4] | MCP/Toolkit provides ASO/feedback workflows and can include write tasks [F3] | MCP for licensed market datasets [S3] | Read-only typed evidence queries with exact windows and caveats |
| Integrations | REST API, MCP discovery and execution tooling [A5] | API v2, integrations, MCP [F2,F3,F4] | CSV plus subscription-gated API/MCP [S2,S3] | Scheduled direct API imports; MCP is access, not the scheduler |
| Daily UX | Keyword-to-performance drilldowns and decision suggestions | Review/ASO workflow with reusable analysis output | Four functional sections replaced a more fragmented tool [S1] | One portfolio + app context + short action list; limit top-level navigation |

## AppTweak: strongest documented rank candidate, not an automatic purchase

[A1 — App Keyword Ranking History](https://developers.apptweak.com/reference/keyword-metrics-by-app-history) documents raw `value`, `fetch_performed`, and `effective_value`. Raw observed rank must stay distinct from an absent observation. The effective value may fill gaps or use an unranked sentinel, so Kopa must not treat it as a measurement. Keyword installs are explicitly estimated. This is a useful import contract, not proof of native-session equivalence.

[A2 — Keyword Metrics](https://developers.apptweak.com/reference/keyword-metrics) distinguishes `volume` (vendor estimate), `search_popularity` (store-reported), and `difficulty` (vendor KPI). It documents a methodology change in August 2026 and history that is not rewritten. Store the metric/version transition; an unchanged field name does not mean an unchanged measurement.

[A3 — Current product/pricing matrix](https://www.apptweak.com/en/pricing) lists metadata timelines, competitor analysis and live keyword searches. At the inspected annual-billing setting, ASO Essential displays $79/month ($949 annually), 5 apps and 500 keywords; API Lite is a separate offer displayed at $166/month. **Do not assume a UI subscription includes API entitlements.** Taxes, billing commitment, credits and target-market coverage need a written quote. These prices are a dated public-page snapshot.

[A4 — AI agents](https://help.apptweak.com/en/articles/13885639-apptweak-ai-agents) describes evidence-based ASO, Ads and review advice that runs when asked, with no automatic changes. [Campaign Manager documentation](https://help.apptweak.com/en/articles/8052435-2026-new-on-apptweak) describes paid performance drilldowns and tap/view/total metric handling. Relevant lesson: pair a proposed action with the source evidence and keep the execution boundary explicit. Do not copy its entire campaign-management feature set.

[A5 — Building with AppTweak data](https://developers.apptweak.com/reference/build-with-apptweak-data) describes using MCP for endpoint discovery and direct API code for recurring retrieval. [API data pricing](https://developers.apptweak.com/reference/pricing-table) specifies base datapoint costs and historical marginal costs. Relevant: Kopa should own its scheduled ingestion and credit budget, rather than stream every report through an LLM.

**Unknown:** actual collection methodology, sponsorship parsing, native match quality in DE/other chosen markets, contractual right to retain/export data and pass it to an AI, and account-specific API credit allowances. A live, capped trial is necessary before adapter implementation.

## AppFollow: check existing entitlement before adding another subscription

[F1 — ASO tools](https://appfollow.io/aso) documents keyword optimization and competitor workflows. Its broader product focuses strongly on review/support operations. That is valuable for support-heavy teams but is not a reason for Kopa to build a ticketing suite.

[F2 — Keywords API v2](https://docs.api.appfollow.io/reference/keywords_api_v2_aso_keywords_get-1) specifies app external ID, country, device, date and page and a cost of **10 credits/request**. Its [Search Ads ASO reports reference](https://docs.api.appfollow.io/reference/keywords_api_v2_aso_keywords_get-1) links a related endpoint; this does not prove full account reporting or mutation automation. [API overview](https://support.appfollow.io/hc/en-us/articles/360020833017-API-Overview) states v1 is legacy and gives rate limits of 1,000 requests/hour/token and 10,000/hour/account. Plan gates and method-level costs apply.

[F3 — MCP & AI Toolkit](https://appfollow.io/mcp) documents app tracking, keyword position/metadata analysis, feedback themes and reusable report workflows. Its examples include review posting after approval; therefore do not assume the vendor connector is inherently read-only. Kopa needs its own allowlist and account scope regardless of available connector features.

[F4 — Common errors](https://docs.api.appfollow.io/reference/error-codes) and the overview warn that transport success alone is insufficient; semantic errors must be parsed. Current [pricing page](https://appfollow.io/pricing) was accessible but its plan table was not exposed in the retrieved content. **No current dollar price or included API quota is asserted.**

Historical Kopa evidence matters: [APPFOLLOW_API_AUDIT.md:160](/Users/otastemelis/Documents/kopa-studio/APPFOLLOW_API_AUDIT.md:160) records a July Japan request returning HTTP 200 with `keywords: []`, with no observed item schema or pagination. Earlier sections record a GB parameter rejection and an empty US response. These are previous-run records, not a fresh provider test and not proof that the vendor is generally unsuitable. They do mean there is no demonstrated working AppFollow import to “turn back on.” Start with one known tracked keyword/date and a support-confirmed entitlement; do not poll empty results repeatedly.

## Sensor Tower: useful market research, disproportionate to clone

[S1 — ASO Keywords, January 2026](https://sensortower.com/blog/app-store-optimization-tool) documents keyword discovery, topic lists, competitive gaps and historical performance. It lists rank, traffic, difficulty, opportunity and paid-search indicators. These derived indicators require their own definitions; they are not all first-party measurements. Its UI consolidation is relevant to Kopa's fragmented workflows.

[S2 — Growth and user acquisition](https://sensortower.com/solutions/growth-and-user-acquisition) documents localization, competitor strategy, CSV support and revenue/download estimates. Relevance: occasional market research and choosing rivals; reproducing market-wide modeled data is outside a solo internal tool.

[S3 — MCP integration](https://sensortower.com/mcp-server-demo) requires an active API subscription and exposes licensed datasets. Account-specific dataset access, ASO endpoint schema, market coverage, refresh cadence and price were not independently established. No evidence supports assuming that buying MCP access grants every ASO dataset or campaign write feature.

**Assessment:** use only if an existing subscription or a specific research decision justifies the cost. Not the default paid provider for a 90-series personal pilot without a competitive quote.

## Smaller and open-source alternatives

| Candidate / evidence | Relevant capability | Decision and unknowns |
|---|---|---|
| [Appfigures ASO tools](https://appfigures.com/products/aso-tools) and [agent integration documentation](https://help.appfigures.com/en/article/appfigures-for-ai-agents-1chf6wf/) | ASO plus developer analytics; REST/agent access; documentation separates public estimates from own private data and gates public data behind an add-on | Quote and sample alongside AppTweak. Confirm rank export/API rights and true all-in price; no current plan price asserted |
| [app-store-scraper](https://github.com/facundoolano/app-store-scraper) | Open-source app/search/review/suggestion methods | Code reuse for exploration only; no SLA, permission, organic-rank accuracy, or production suitability established |
| Apple's own consoles + CSV | First-party metrics and manual observations | Credible baseline before custom work. Keep as fallback and reconciliation reference |

## What Kopa should copy and what it should buy

1. **Essential to build:** app/market context; trustworthy source health; a curated keyword watchlist; comparable paid performance; hypothesis/change log; a weekly evidence-backed priority list.
2. **Later:** richer competitor changes, saved queries, controlled-test references, subscription cohorts where identity and attribution permit.
3. **Too expensive to reproduce:** global search collection, market-wide download/revenue estimation, calibrated difficulty models, broad ad intelligence and enterprise support tooling.
4. **Better integrated:** licensed organic ranks/history, optional broad keyword discovery, official Apple campaign/ASC data, existing transaction analytics.
5. **Unnecessary:** multi-tenant billing, agency seats, giant report builder, support ticket automation, autonomous bid optimizer, global app catalog crawler.

A vendor subscription with a weekly decision template may already satisfy most of the owner's needs. The roadmap includes a buy-versus-build checkpoint before expensive custom views. Kopa earns its existence by joining trustworthy owned-app facts with a small research watchlist and recorded decisions, not by matching vendor feature counts.
