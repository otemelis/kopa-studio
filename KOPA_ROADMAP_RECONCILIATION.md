# Kopa Tools roadmap reconciliation

Status: authoritative reconciliation
Date: 2026-07-28
Active direction: [KOPA_ACTIVE_ROADMAP.md](KOPA_ACTIVE_ROADMAP.md)

Legacy roadmap and status files remain for history. They are not the active implementation sequence.

## Executive reconciliation

The old roadmap stopped at three different boundaries:

1. **ASO UI/UX:** Milestone 2 stopped before the focused experiment/Change Log flow and source/result links; Milestone 3 stopped before a metadata timeline aligned with visibility and conversion.
2. **Platform consolidation:** Phase 6 stopped at deploy, signed-in verification, live sync validation, and eventual compatibility-route cleanup.
3. **Apple Ads Lab:** Milestone 13 stopped after search-term import/recommendation code, with the next task to sync real delivery data and validate the recommendations.

The key Apple Ads blocker is now resolved: live campaigns, daily delivery and search terms exist. The validation result is negative—the recommendation engine produces zero live Apple Ads recommendations and cannot derive the required actions.

The roadmap therefore resets to product usefulness, beginning with trust and decision correctness rather than attribution, more pages, or write automation.

## What is now resolved

| Former blocker | Current evidence | Reconciliation |
| --- | --- | --- |
| No Apple Ads campaign/delivery data | 2 campaigns, 8 daily rows, 6 search-term rows | Blocker now resolved |
| No search-term evidence | `lovense`, `lovense remote`, and `y not` are stored with source/metrics | Blocker now resolved |
| App Store Connect storefront data empty | 78 storefront facts and 74 daily rows | Blocker now resolved, parser trust still needs work |
| Collection queue unproven | 9 completed production jobs; latest run 54/54 | Completed and verified |
| Search Match field uncertain | API v5 field mapping, fixture and live values exist | Completed and verified, one structure-intent discrepancy remains |
| Tools production deployment uncertain | Current Vercel production deployment is Ready | Deployment resolved; repository/deployment parity remains |

## Old roadmap reconciliation

### ASO migration plan

| Old milestone | Actual state | Classification | Decision |
| --- | --- | --- | --- |
| Discovery and audit | Repository and legacy collector mapped | Completed and verified | KEEP as history |
| Foundation | Next.js, auth, repositories, services, validation and deployment exist | Completed and verified | KEEP |
| Read-only parity | Core pages exist; several comparisons and owner acceptance checks remain | Completed but not verified | FIX_FIRST where trust affects product |
| Collection controls | Durable public-store queue works; Apple Ads structure/report jobs are inconsistent | Partially implemented | KEEP public queue; FIX_FIRST ads durability |
| Parallel verification and cutover | Tools is live; legacy remains; signed-in acceptance and route cleanup incomplete | Partially implemented | COMPLETE_NOW verification, REMOVE_AFTER_MIGRATION legacy |
| Apple Ads deferred in this plan | Later implemented by separate roadmap | Obsolete | OBSOLETE |

### ASO UI/UX milestones

| Old milestone | Actual state | Classification | Decision |
| --- | --- | --- | --- |
| 1 Keyword Operations | Search/filter/sort, saved views, bulk work exist | Completed and verified in code/live volume | KEEP |
| 2 Action-Oriented Core Views | Portfolio/insight work exists; focused Change Log/source-result workflow incomplete | Partially implemented | MERGE into Today, Recommendations and Changes |
| 3 Evidence and Change Intelligence | Competitor/review work exists; metadata timeline is missing | Partially implemented | COMPLETE_NOW in Metadata Change Monitoring |
| 4 Trust and Operating Rhythm | Marked complete, but global trust is not actually complete | Completed but not verified | FIX_FIRST under Trust and Data Correctness |
| 5 Validation | Local/authenticated checks were recorded, but current production/source parity and full owner acceptance are not proven | Completed but not verified | COMPLETE_NOW as acceptance work |

### ASO Product UX Plan

| Old priority | Actual state | Classification | Decision |
| --- | --- | --- | --- |
| Working Context and Keyword Operations | Implemented | Completed and verified | KEEP |
| Insight Triage | Implemented in legacy feed | Completed but not strategically sufficient | MERGE |
| Decision-First Briefing | Weekly briefing concepts exist, but current Dashboard does not answer “what changed/next” | Partially implemented | MERGE into Today |
| Evidence Workspaces | Competitor/review/experiment surfaces exist | Partially implemented | KEEP useful data, MERGE pages |
| Operational Detail | Jobs/health disclosure exists | Partially implemented | MERGE into Settings |

### Platform consolidation roadmap/status

| Old phase/work | Actual state | Classification | Decision |
| --- | --- | --- | --- |
| Six-workspace navigation | Implemented | Completed and verified in code | Superseded by product navigation |
| Global context bar | Implemented as query parameters | Partially implemented | FIX_FIRST repository scoping |
| Compatibility routes | Preserved | Completed | REMOVE_AFTER_MIGRATION |
| Apple Ads workspace pages | Implemented | Completed but fragmented | MERGE |
| Live delivery/recommendation validation | Live data now present; recommendation result is wrong/empty | Blocker now resolved | FIX_FIRST |
| Phase 6 cleanup | Not completed | Partially implemented | DEFER route deletion until replacements |

### Apple Ads Lab phased plan

| Old milestone | Actual state | Classification | Decision |
| --- | --- | --- | --- |
| 0 Audit/API verification | Complete | Completed and verified | KEEP as history |
| 1 Connection/mapping | Complete and live | Completed and verified | KEEP; move UI to Settings |
| 2 Structure sync | Complete and live | Completed but architecture differs from durable-job plan | FIX_FIRST durability |
| 3 Reporting ingestion/freshness | Complete with live rows | Completed but not fully trustworthy | FIX_FIRST scope/completeness |
| 4 Intelligence pages/ASO joins | Implemented | Completed but fragmented | MERGE |
| 5 Low-volume model | Implemented/tested | Completed but insufficient as a product conclusion | FIX_FIRST |
| 6 AI interpretation | Schema boundary only; planned jobs absent | Partially implemented | DEFER |
| 7 Deterministic recommendations | Implemented, but zero live outputs and wrong relevance behavior | Blocker now resolved | FIX_FIRST |
| 8 Draft Research Planner | Implemented/tested | Completed but not high-value now | DEFER |
| 9+ Approval copilot/write boundary | Not implemented | Still blocked and not strategically useful now | DEFER |
| 13 Search-term recommendation evidence | Code complete; live validation failed product acceptance | Completed but not verified | FIX_FIRST |

### Attribution

| Work item | Actual state | Classification | Decision |
| --- | --- | --- | --- |
| Additive schema | Applied; 0 rows | Completed and verified as foundation | KEEP |
| Bearer ingestion endpoint | Implemented | Completed but not end-to-end verified | KEEP |
| Status/read page | Implemented and empty | Completed but not strategically useful | DEFER |
| App-side AdServices/backend forwarding | Not implemented | Still blocked | DEFER |
| Product-event join and attribution decisions | Not implemented | Needs product decision later | NEEDS_PRODUCT_DECISION |
| Shared analytics vs Kopa attribution path | Two separate intake/identity foundations are documented | Needs product decision | NEEDS_PRODUCT_DECISION before any app work |
| Primary navigation exposure | Was present despite zero events | No longer strategically useful | Removed from primary navigation; keep direct route |

## Features by active decision

### KEEP

- Public-store collector and durable collection queue.
- Apps, keywords, competitors, ranks and review data.
- App Store Connect sales and Discovery foundations.
- Read-only Apple Ads connection, mapping, structure, reporting and search-term facts.
- Raw payload preservation and additive schemas.
- Change Log and recommendation evidence foundations.
- Automation Level 0.

### COMPLETE_NOW

- First Apple Ads evidence-to-action correctness slice.
- Signed-in owner/unauthorized acceptance record.
- Product-grade Rankings view.
- Automatic metadata measurement windows.
- Explicit insufficient-evidence conclusions.

### FIX_FIRST

- Market/locale/date/evidence scoping.
- App Store Connect parser completeness and partial-state contract.
- Apple Ads source keyword/ad-group resolution.
- Search-term relevance and broad-source diagnosis.
- Recommendation dedupe/lifecycle consistency.
- Production/source parity.

### MERGE

- Keywords and Rankings.
- Localizations, storefront analytics and market readiness.
- Apple Ads overview/structure/reporting/search-term pages.
- ASO, Discovery and Apple Ads recommendation feeds.
- Experiments and metadata change events.
- Sources, Jobs and Health technical pages.

### DEFER

- Attribution implementation beyond its preserved foundation.
- Apple Ads mutations, bid/budget automation and approval copilot.
- Research Planner expansion.
- AI analyst jobs.
- Multi-tenancy, billing, invites and public SaaS onboarding.
- AppFollow API import.

### REMOVE_AFTER_MIGRATION

- Legacy hidden ASO console.
- Duplicate compatibility pages/routes after replacement verification.
- Empty attribution/reporting surfaces from normal navigation.

### OBSOLETE

- “Apple Ads is not implemented” claims in old ASO handoff material.
- “No live Apple Ads delivery data” as a roadmap blocker.
- “Storefront metrics are empty” as a current-state assumption.
- Continuing old milestone numbering as the active sequence.

### NEEDS_PRODUCT_DECISION

- Whether `relationship test` should be paused entirely or retained with added negatives after reviewing intent.
- Whether the German “Core Exact” ad group should actually have Search Match enabled.
- Whether Change Log remains backed by `aso_experiments` or gets a separate event model.
- Whether attribution would change a future acquisition decision.
- Which attribution intake and installation identity is canonical: shared analytics `installs`/Edge Function or Kopa `apple_ads_attribution`.
- When compatibility routes can be deleted after owner acceptance.

## Attribution decision: DEFERRED

Attribution is preserved, not continued. See the prerequisites in `KOPA_CURRENT_STATE.md`. It must not return to active work merely because its next old milestone was unfinished.

## Duplicate pages to merge

| Current pages | Eventual product destination |
| --- | --- |
| `/keywords`, `/rankings` | Rankings |
| `/localizations`, ASO readiness sections, ASC storefront summaries | Markets |
| `/apple-ads-lab`, `/structure`, `/reporting`, `/keyword-intelligence` | Apple Ads |
| `/insights`, `/apple-ads-lab/recommendations`, Discovery cards | Recommendations |
| `/experiments`, metadata events | Changes |
| `/app-store-connect`, `/collection`, `/apple-ads-lab/data-quality`, connection/mapping controls | Settings |

## First concrete vertical slice

Build the **UK Apple Ads evidence-to-action assessment** inside Milestone 1:

1. Scope to InnerType + GB + the observed report window.
2. Classify product fit deterministically with explicit test fixtures for the six current search-term rows.
3. Produce three negative-exact proposals.
4. Aggregate irrelevant traffic to broad `relationship test` and produce a pause/review decision.
5. Keep `personality test` in learning.
6. Produce a separate campaign conversion statement: unknown, four taps are insufficient.
7. Store the evidence window and reason, but make no Apple Ads change.

Acceptance is the exact six-action result required by the reset brief, not merely a rendered card.
