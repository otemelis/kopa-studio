# 05 — Product specification: Kopa Growth Desk

Proposed internal name; no naming or application changes were made. Date: 2026-10-14.

**Product job:** help one publisher decide what to investigate, change, or wait for across owned iOS apps. A useful session ends with a decision and evidence, not a tour of dashboards. Start with POIS, InnerType and LoveType only after confirming their actual identifiers and priority markets.

## UX directive amendment — 14–15 October 2026

Trends before totals; questions before widgets; explanations before actions. Documents [10](10_UX_REVIEW.md), [11](11_UX_DESIGN_SYSTEM.md), [12](12_UX_SCREEN_SPEC.md) and [13](13_UX_IMPLEMENTATION_PLAN.md) supplement this technical product scope. The flagship Keywords workflow uses a large source-aware history chart linked to a watchlist and evidence drawer, with first-class period comparison. Owner visual/interaction approval precedes production rebuilding. The isolated prototype is sample data only.

## Scope and success

V1 covers owned-app acquisition, licensed keyword observations, official Apple Ads reporting, a small competitor set and an experiment/change journal. Subscription value can initially be a clearly labeled official aggregate where available; attributed ROAS is later. No public SaaS accounts, teams, billing, campaign mutation or metadata publication.

Evaluate with a 14-day owner pilot:

- Every selected app/market has an honest source coverage state and one comparable complete reporting window.
- The owner can answer the seven questions in the brief without manually combining CSVs for routine checks.
- Each weekly recommendation links to source facts, period, definition and caveats. “Insufficient evidence” is an acceptable and useful result.
- The owner records at least one real investigation/decision when evidence warrants it; do not invent actions to satisfy a quota.
- Record time spent and decisions made before/after the pilot. A suggested target is a routine review under 10 minutes, but this is a product target, not a measured outcome.
- If existing vendor/Apple views plus a weekly note are sufficient, stop building custom views that add no decision value.

## Information architecture

Five working areas: **Overview, Keywords, Apple Ads, Experiments, Sources**. App detail reuses the same views under a persistent app/country/time context. A small “Ask about this evidence” entry is available after read-only tools work; it is not a sixth generic chat product.

Use consistent 7/28/90-day selectors. Default comparisons end at the latest common complete date, not today. Show provisional recent data separately. Preserve the user's timezone for display and the source timezone for measurement. “All countries” must never be relabeled as one market.

### 1. Overview / App performance

**User story:** “Show how each app is performing, whether the data is usable, and the next thing worth checking.”

One row/card per app: first-time downloads and comparable trend; Apple Ads spend and tap CPA in native currency; developer proceeds or subscription metric only when definition and source are established; most meaningful change; source coverage. Unknown value is “Unavailable,” not zero. Avoid summing currencies across the portfolio; use grouped subtotals or an explicitly converted view later.

Three action slots maximum by default: investigate / consider action / wait. Each item explains the trigger, exposes the evidence and supports opening an experiment or acknowledging a data issue. A low-volume app should get a concise waiting state, not alarming percent changes from a one-event baseline.

Drilldown reveals market and source detail. An unavailable source does not hide healthy sources, and one healthy source does not make the entire app green.

**Acceptance:** a failed ASC import leaves prior data visible with its age and a failure state; a zero-activity valid report looks different; no metric from an incomplete partition enters the default comparative trend.

### 2. Keyword Intelligence

**User story:** “Which relevant queries are improving or deteriorating, and which should I research next?”

Table columns: keyword, app/market, intent, priority, observed rank or censored status, comparable movement, last observed timestamp, source/method/quality and paid coverage. Popularity is optional and labeled official relative score or vendor estimate. Difficulty is vendor-defined, never presented as an Apple metric.

Primary Keywords view: a large gapped historical ranking chart linked to multi-row watchlist selection, stable series, crosshair tooltips, date-range filtering and equivalent-period comparison. A contextual detail drawer retains scope. Keyword detail: gapped rank chart with depth/censored points, observation history, tracked competitors, metadata/release annotations, paid search evidence and notes. Historical iTunes positions use a separate series or explicit method boundary. Do not interpolate rank gaps as measured values. Show comparison dates if they differ from the requested interval.

Operations: CSV import preview/deduplication, export, filter, intent tags, app-specific priority, archive/pause tracking. Editing term/country/locale creates a new immutable query identity; old observations remain. Import intent is publisher-reviewed, optionally AI-suggested later. Phrase relevance differs by app; no universal personality-test taxonomy.

Competitor panel compares only matched observation contexts/times and a selected small competitor set. Missing rival rank is not automatically a win. Paid keyword coverage shows scope/status/match type and cannot be a global exact-text negative flag detached from its ad group.

**Acceptance:** users can distinguish observed #24, observed absent within depth 100, collection failed, never collected and stale history; every exported rank includes method, market, observed time, depth and state.

### 3. Apple Ads

**User story:** “Where is spend going, what results have matured, and what deserves investigation?”

Start with spend, impressions, taps, tap-through installs/new downloads/redownloads, tap CPA and budget pacing. View-through/total metrics remain separately selectable. Date, timezone, country, currency, placement and attribution definition are always available. Drill campaign → group → keyword/search term; preserve keyword versus actual query distinction.

Practical queues: unexpected spend change, spend without mature results, irrelevant search-term candidates, sustained relevant queries worth exact-match investigation, and delivery/budget constraints. These are **candidates for review**, not automatic pauses or budget increases. Show absolute counts, selected threshold, maturity, suppression/coverage and a data-quality gate.

Budget pacing compares compatible month-to-date spend with the relevant approved/current budget history. It is an estimate of pace, not a guaranteed cap. Until budget history and current balance are known, show “Pacing unavailable.”

Optional later value view: attributed cohort revenue/ROAS only with verified attribution coverage, window, refunds/currency treatment and explicit distinction from incrementality. No rank-derived install or revenue models in V1.

**Acceptance:** a multi-country campaign cannot generate country-specific spend recommendations from an unsegmented total; missing report pages block completeness; provisional and mature windows are visibly separate; different currencies never sum silently.

### 4. Experiments and change journal

**User story:** “What did I change, what would count as success, and what did the evidence teach me?”

Required fields: hypothesis; app/market and exact metadata locale where relevant; intervention type; primary metric definition and baseline; planned change; start/end/evaluation dates; success criterion; evidence source/coverage; confounders; result; interpretation; next action. Link release, metadata version, PPO test/treatment or approved paid change identifiers.

Explicit design type:

| Type | Permitted conclusion |
|---|---|
| Apple randomized PPO/other verified controlled test | Treatment result under its allocation and platform definitions; preserve uncertainty and population |
| Observational before/after | Association with a timed intervention, not causal proof |
| Exploration/low-volume learning | What was learned and what remains unknown; no forced winner |

States: draft → planned → running → awaiting mature data → reviewed (positive/negative/inconclusive) → follow-up or reverted. Preserve historical edits and evaluation snapshots. One primary metric prevents selecting a favorable outcome after seeing results. Missing days and source revisions can invalidate an evaluation; status should return to awaiting evidence when necessary.

**Acceptance:** saving a hypothesis never changes Apple Ads/ASC; a multi-source/multi-country row count cannot satisfy a minimum-days test; comparison uses distinct complete dates and predeclared metric definitions.

### 5. Sources and operations

**User story:** “Can I trust this result, and what exactly needs repair?”

Per source/app/market: configured state, last attempt/success, latest event date, expected/complete partitions, parser version, credentials expiry state, rate/credit budget and last actionable failure. “Connected” is not “current.” Job detail shows attempts, scope, checkpoint, lease, records accepted/rejected and links to sanitized raw evidence. A manual retry reuses idempotency scope and does not overwrite a complete partition with a partial retry.

Setup requests only necessary access, with precise steps and source-specific roles. Never display secret values. Keep manual source reconciliation available without turning setup into an enterprise permissions product.

**Acceptance:** expired credentials, valid empty, privacy-suppressed, source pending, unsupported market and parser drift are distinct states with a clear next action.

## AI analyst response contract

A recommendation contains: app/market, question/claim, observed change and absolute metrics, source IDs, exact comparison windows/timezones, metric definitions, completeness/freshness, confidence and its reason, limitations/alternative explanations, proposed next step, and an impact range only if quantitatively supported. Separate deterministic calculation from interpretation.

Examples of allowed reasoning:

- “Germany visibility fell” requires comparable observed organic rank series. If there are only legacy iTunes positions, say the proxy moved and request validation.
- “Metadata update helped” remains an observational association unless a controlled design supports causation.
- “Wasted spend” must consider relevant matured tap cohorts, suppressions and product intent; zero recent installs is not enough.
- “Increase budget” remains a review candidate if downstream value or marginal economics is unknown; do not claim a profitable ROAS.

All figures are computed by typed queries, not LLM arithmetic over raw files. Answers link to evidence IDs and disclose unavailable sources. Treat app descriptions, reviews and competitor text as untrusted content, never tool instructions. Exclude raw customer identifiers from general growth summaries.

## Non-goals

No global scraping fleet, competitor revenue reconstruction, enterprise BI builder, multi-tenant RBAC, support inbox, automatic campaign writes, automatic metadata submission, generic AI advice, LTV engine or custom causal inference platform. Reuse existing transaction instrumentation rather than changing native app behavior for a dashboard. Do not add hypothetical charts merely because a source can return another metric.
