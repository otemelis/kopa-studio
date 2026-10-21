# Kopa Studio — UX Redesign Directive

**Date:** 2026-10-14
**Purpose:** Supplement, not replace, the forensic audit and eight-part implementation package produced for Kopa Studio.
**Requested outcome:** A genuinely premium, modern, high-clarity analysis interface that the owner chooses over AppFollow for daily trend investigation.

## 1. Decision and rationale

The existing reassessment recommends a selective technical rebuild, retaining Next.js, TypeScript, Supabase, app identities and history while correcting ingestion and metric semantics. Accept that direction as the technical baseline. **Change one prioritization:** design the new owner experience from the beginning, in parallel with validating and rebuilding the data sources. The current roadmap's M6 UX work is too late and too underspecified for the owner's central pain point.

This is **not** an instruction to replace the framework or migrate production data simply to achieve new visuals. Rebuild the presentation, interaction and analytical experience while preserving reusable backend infrastructure. The older console and current screens may be retired after parity and safe cutover.

## 2. Main product principle

**Trends before totals. Questions before widgets. Explanations before actions.**

A useful session should let the owner: (1) notice a meaningful movement; (2) inspect the exact time period and source; (3) understand which apps, markets, and keywords contributed; (4) compare against previous periods or competitors; (5) document a decision or experiment — all without repeated navigation or rebuilding filters.

Benchmark: The owner currently goes to AppFollow instead of Kopa to inspect trends. Kopa must win an A/B usability comparison against that workflow, not just look aesthetically pleasing.

## 3. Visual direction

- Create a restrained, premium *data workstation*, not a generic SaaS dashboard or an admin template.
- Editorial typography, strong hierarchy, quiet neutral surfaces, generous but disciplined whitespace, and exceptionally legible tables/charts.
- Choose a deliberate accent system for interactive elements and separate semantically meaningful positive/negative/neutral/unknown states. A higher organic ranking means a **smaller numeric rank**, not a worse outcome.
- Prefer a sophisticated, high-quality light mode first; optionally deliver an equally intentional dark mode. Do not assume dark dashboards automatically look modern.
- Use color sparingly; never depend on color alone for ranking direction or source health. No decorative gradients, glassmorphism, enormous cards, neon, or uncontrolled animations.
- Smooth, short transitions where they aid context; no performance-heavy ornamental motion.
- Design for a primarily desktop analysis workflow, with serious 13-inch laptop and narrow-screen support. Dense analytical interfaces are acceptable when carefully composed.
- Follow accessibility expectations (WCAG AA contrast for core text, visible focus, keyboard navigation, proper chart/table labels, accessible alternatives to color).
- Make loading, empty, partial, failed, stale, and legitimate zero states first-class visual designs.

## 4. Information architecture and global context

Keep five top-level destinations: **Overview, Keywords, Apple Ads, Experiments, Sources**. Add a small, persistent global context bar with:

- Selected app or portfolio, market/country and requested locale/device where relevant.
- Date range (7 / 28 / 90 days, custom), plus clearly named comparison period.
- Visible data freshness and last complete comparable date. Pending/provisional days must not be silently mixed with completed days.
- A consistent share/export or saved-view affordance, preserving analytical filters and selected series.
- Breadcrumb or location context without consuming too much vertical space.

Use durable URL-based state for filters, chart selection, and drilldowns where practical; browser Back should behave predictably. Saved views should eventually support names such as “POIS — Germany — 28 days — posture keywords.”

## 5. Priority screen designs

### Screen A — Overview / App performance

Purpose: answer “What changed across my apps, and where should I look?”

Composition:
1. Compact portfolio/app selector and reporting window.
2. A handful of defensible headline metrics with period comparison and small sparklines: first-time downloads, ad spend, tap CPA, and a clearly defined monetary outcome if available. Respect source definitions and currency.
3. A large, useful, time-series trend area; avoid reducing the main chart to a tiny decorative card.
4. App comparison rows with mini trends, market/source status, and one meaningful movement each.
5. Up to three evidence-backed next investigations; do not generate a noisy permanent list of alerts.

Offer a quick pivot from a changed series to its relevant keywords, campaign, market, or event history.

### Screen B — Keyword Intelligence (flagship experience)

Purpose: make organic ranking trends easier to inspect than AppFollow.

Recommended default layout on desktop:
- Filter/context controls across the top.
- **Large interactive historical ranking chart as the visual hero** (not hidden behind a detail page).
- **Keyword table tightly linked to the chart** underneath or beside it: keyword, current rank, 7/28-day movement, compact sparkline, rank band, provider/source, coverage, and optional provider-labeled popularity/difficulty.
- Detail drawer when selecting a keyword: trend, specific observations, competitor positions, metadata/release annotations, related paid search evidence, and notes, without leaving the page.

Required interactions:
- Select one or several keywords from the table and plot their exact comparable series; quick unselect/reset.
- Hover/scrub to align a crosshair and tooltip across all visible series and show the observation date, positions, status and source/method.
- Toggle a keyword on/off from legend or table; highlight its line and row on hover. Keep series identities and accessible distinctions stable.
- Rank axis follows common ASO expectation: #1 near the top; moving upward on the screen means better rank. Do not connect unobserved gaps as measured values.
- Show rank bands (1, 2–5, 6–10, 11–20, 21–50, 51–100) as optional filters or unobtrusive background aids; never suggest precision absent from a provider.
- Make period-over-period comparison first-class: prior 28 days vs current 28 days, or custom range A vs range B. Expose average observed rank, position at boundaries, volatility, and coverage when legitimate. Comparisons must use equivalent supported observation contexts.
- Annotate App Store metadata versions/releases and logged experiments as vertical events on charts. Clicking reveals exactly what changed. Do not infer causality.
- Offer competitor overlays for a limited selection of tracked competitors within matched storefront/device/date/method contexts.
- Clearly distinguish “Observed #24”, “Absent within top 100”, “Collection failed”, “Not yet tracked”, “Stale”, “Legacy iTunes Search position”, and “Official/vendor model” where relevant.
- Table operations: fast search, multi-column sorting, pin/favorite, bulk selection, grouping by intent, saved filter views, CSV export of selected scope, and keyboard interactions.
- Avoid claiming that all ranked keywords are available unless a licensed provider actually supplies broad discovery. Label a tracked-keyword watchlist honestly.

### Screen C — Apple Ads

Purpose: identify spending changes and acquisition opportunities quickly.

- Headline performance trend: spend, impressions, taps, attributed downloads and tap CPA with consistent selected attribution type and mature-period window.
- Select related series in focused chart modes. Do not place incompatible metrics on a misleading combined axis without deliberate labeling.
- Segment and drill down campaign → ad group → targeting keyword or reported search term; make the distinction explicit.
- Searchable, sortable performance table with inline trends, useful period-over-period changes, and a concise evidence/quality indicator.
- Contextual overlays for campaign/bid/budget changes and experiments when supported.
- Separate attributed tap/view/total definitions and native currencies; clearly signal unavailable data, threshold/suppression, reporting lag and attribution revisions.
- Investigation queue for abnormal spend or weak performance, but **no live write actions in the first release**.

### Screen D — Experiments

- Visually understandable timeline of planned, running, awaiting-data, reviewed and inconclusive interventions.
- Experiment detail connects its hypothesis, change, primary metric and evaluation window directly to chart annotations and validated source facts.
- Distinguish controlled Apple PPO experiments from observational before/after notes.
- Prefer lightweight capture forms integrated into analysis views; “start experiment from this chart” should prefill app, market, period, metric and source context while requiring the owner to confirm success criteria.

### Screen E — Sources

- Operational health should be reliable and findable, but not dominate the daily analytics navigation.
- Compact, readable matrix of source × app/market status, last complete date, data delay, error and next recovery action.
- Allow deeper job diagnostics without making the interface look like a system administrator console by default.

## 6. Patterns and components to design deliberately

1. **Cross-filtering:** selecting a chart range filters the associated keyword/campaign table; provide a visible clear/reset action.
2. **Comparison mode:** overlay comparable periods or split them side by side; show actual dates and definitions.
3. **Selection persistence:** avoid resetting app/market/range on every navigation; keep browser navigation usable.
4. **Compact sparklines:** meaningful mini trends in data rows, not decorative waves.
5. **Rich, precise tooltips:** observed date, value, comparator, sample status, source, scope and caveat.
6. **Contextual detail drawer:** deep analysis without page hopping.
7. **Event overlay:** metadata releases, app releases, manually recorded experiments and paid operational changes only when evidenced.
8. **Honest uncertainty:** status and coverage integrated into charts; missing does not equal zero; segmented discontinuities never imply continuous measurement.
9. **AI entry point:** “Explain this change” acts on current app, chart range, selected series and source evidence. Never start with a blank generic chat as the primary experience.
10. **Exports:** actual selected range, filtered rows, source/method, observation statuses, completeness, metric definitions, locale/device, attribution and currency.

## 7. Design and implementation strategy

### Phase UX0 — Audit actual workflows

- Run existing Kopa locally in an authorized, safe environment; capture authenticated screenshots or recordings of the current overview, keyword/rank tracking, Apple Ads, experiment and Sources flows. If authentication or data is unavailable, mark this limitation explicitly; never imply visual evaluation occurred.
- Read the completed architecture/data audits as constraints.
- Research and analyze **current** public AppFollow and AppTweak keyword/analytics screenshots, help documentation and interaction patterns. Distinguish documented from actually tested vendor interactions.
- Write a short UX defect diagnosis: confusing flow, excess navigation, no trend visibility, bad filtering/context, low chart quality, broken metric semantics, unnecessary components.

### Phase UX1 — Design exploration BEFORE coding a production replacement

- Produce two coherent alternative interface directions (not random dashboard variations), then recommend one.
- Define desktop information hierarchy, navigation, typography, spacing, visual language, color tokens, chart grammar and interaction patterns.
- Deliver tangible high-fidelity mockups/prototypes of **Overview, Keywords and Apple Ads**, with emphasis on Keywords. Include at least one keyword detail drawer and period comparison state.
- Show real edge cases: missing observation, historical-source discontinuity, empty account, reporting delay and ambiguous paid data.
- Use **clearly labeled fixture/sample data strictly inside the isolated prototype** if necessary; do not seed synthetic performance into production.
- Obtain owner approval of UX direction and flagship workflows before broad implementation.

### Phase UX2 — Vertical-slice implementation

- Implement the selected system in the existing Next/React application with reusable accessible UI/chart primitives and typed source-aware query APIs.
- Prefer proven, maintainable data-viz primitives (e.g., Recharts, Visx, or another evaluated React library); test interactions and large series under realistic sample sizes before choosing.
- Build Keywords + real rank data as the flagship slice once provider data is validated. Other views can use visually accurate mockups while backend contracts are pending, but must never present fixtures as live facts.
- Migrate Overview and Ads incrementally. Retain legacy paths until source/chart parity and acceptance.
- Design system and chart interactions must be reused consistently, not copied as independent pages.

### Phase UX3 — Owner usability gate

Conduct short real-task checks with the owner:

- Find the keywords with the most significant confirmed improvements and declines over 28 days.
- Compare two keywords and explain which ranking behavior is stable vs volatile.
- Open a ranking decline and identify whether it coincided with a metadata change, without inferring causality.
- Identify which campaign/term incurred spend in the last complete week and how it compared with the prior complete week.
- Export the selected view and explain stale/absent/failed data correctly.

Measure whether the tasks are faster/easier than the current AppFollow + Apple workflow. Track confusion, clicks/page hops and mistakes, not merely aesthetic opinion.

## 8. Non-negotiable acceptance criteria

- The design is visibly and functionally new, not a Tailwind reskin of current forms and table pages.
- At least one visually large, useful time-series chart is central on the flagship Keywords view.
- Chart and table selections are linked, with working tooltips, compare mode, date/country/app filters and source-aware gaps.
- Users can go from portfolio movement → keyword/campaign explanation → experiment note without losing context.
- Source completeness, currency, attribution, time zone and rank method are visible at the decision point without drowning the interface in badges.
- Chart math, comparator windows and rank-axis direction have targeted unit/component tests.
- Screens render reliably on common 13-inch laptop and desktop viewports; keyboard, contrast, and focus states are validated.
- Loading/error/empty/provisional/no-permission cases are designed and tested.
- Exports preserve the same scope/semantics as the visualized data.
- No new external write permission, production migration, vendor purchase or deployment is implied by the UX exploration task.

## 9. Expected deliverables for Codex's next phase

Create within the repo under `docs/kopa-reassessment/`:

- `10_UX_REVIEW.md` — evidence-based critique of the existing screen structure and current vendor reference workflows.
- `11_UX_DESIGN_SYSTEM.md` — visual tokens, components, chart grammar, responsive behavior, accessibility and interaction contract.
- `12_UX_SCREEN_SPEC.md` — key screens, drilldowns, prototypes, states, keyboard behaviors and acceptance criteria.
- `13_UX_IMPLEMENTATION_PLAN.md` — ordered frontend vertical slices aligned with backend M0–M7; avoid an all-at-once production frontend migration.

Additionally, produce a navigable and visually reviewable prototype (isolated route, branch, or separate presentation) for the flagship Keywords experience plus Overview and Apple Ads. Before any major production coding or migration, show its screenshots, limitations and concrete open UX decisions to the owner for approval.

## 10. Instruction to Codex Sol 6.1

**Review all existing Kopa reassessment documents and this directive. The prior technical audit remains valid, but product UX quality is now a release-level priority. Your next task is a design-first, code-aware UX review and prototype, not backend implementation. Study the current app and competitor UX, identify the actual trend-analysis jobs, produce a coherent high-fidelity design with linked chart/table interactions, and show it for owner review before rewriting production screens. Preserve source integrity and don't change ads, metadata, credentials, production data, or deployed app behavior.**

The central design question you must answer is: **“Why would the owner open Kopa instead of AppFollow to inspect an ASO trend?”**
