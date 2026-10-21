# 12 — Screen and interaction specification

> **Owner-approved implementation amendment — 15 October 2026.** B · Signal is selected; development work is authorized on `codex/signal-product-analytics`. The earlier Fieldwork recommendation/direction-choice gate below is historical and superseded. Six core destinations now include first-class Product Analytics. Light / Dark / System are mandatory. The canonical implementation is `apps/tools`, behind `KOPA_SIGNAL_UI=1`; fixtures require development plus `KOPA_SIGNAL_FIXTURES=1` and `data=sample`. See [14 OSS feasibility](14_OPEN_SOURCE_FEASIBILITY.md), [15 Product Analytics](15_SIGNAL_PRODUCT_ANALYTICS_SPEC.md) and [Signal verification](SIGNAL_VERIFICATION.md). Production cutover still requires source parity, restore evidence and owner task acceptance; no costly or destructive action is authorized by this amendment.


Design exploration: 14–15 October 2026. Review candidate; no production replacement authorized. All prototype performance values, competitors, source connections and provider observations are synthetic. App names identify realistic contexts, not evidence of those apps' actual performance.

## Review entry points

Open [the review gallery](ux-design/review.html), then compare the same workflow in both directions:

| Screen | A · Fieldwork | B · Signal |
|---|---|---|
| Overview | [Interactive](ux-design/prototype/index.html?screen=overview&app=all&direction=fieldwork) · [capture](ux-design/screenshots/fieldwork-overview.jpg) | [Interactive](ux-design/prototype/index.html?screen=overview&app=all&direction=signal) · [capture](ux-design/screenshots/signal-overview.jpg) |
| Keywords | [Interactive](ux-design/prototype/index.html?screen=keywords&direction=fieldwork) · [capture](ux-design/screenshots/fieldwork-keywords.jpg) | [Interactive](ux-design/prototype/index.html?screen=keywords&direction=signal) · [capture](ux-design/screenshots/signal-keywords.jpg) |
| Apple Ads | [Interactive](ux-design/prototype/index.html?screen=ads&direction=fieldwork) · [capture](ux-design/screenshots/fieldwork-ads.jpg) | [Interactive](ux-design/prototype/index.html?screen=ads&direction=signal) · [capture](ux-design/screenshots/signal-ads.jpg) |

[Keyword drawer](ux-design/prototype/index.html?screen=keywords&drawer=keyword:k0) · [capture](ux-design/screenshots/fieldwork-keyword-drawer.jpg). [Aligned tooltip capture](ux-design/screenshots/aligned-tooltip.jpg). [Selected-range capture](ux-design/screenshots/selected-range.jpg). [Sample exported CSV](ux-design/sample-export.csv).

The prototype is buildless and works without a backend. Open `review.html` in a normal browser, retaining its neighboring folders. If local-file restrictions prevent loading scripts, serve this directory with `python3 -m http.server 4327 --bind 127.0.0.1` and visit `http://127.0.0.1:4327/review.html`. Local storage belongs to that browser/origin; moving from file URLs to localhost does not sync saved views.

## Shared scope and interaction model

URL parameters retain screen, direction, app, market, requested device, date window, comparison, plotted keyword IDs, table filters, selected chart range and drawer/drilldown state. Navigation keeps analytical context and clears a screen-specific text search. Device segmentation is enabled for Keywords; it is visibly disabled for report fixtures that do not supply that dimension, retaining the requested keyword device for return navigation. Sources are one click away. Latest complete date is a source fact, distinct from the selected end date.

Default requested window is 14 September–11 October 2026 inclusive; prior 28 days is 17 August–13 September. The first two prior days are legacy method observations and do not enter the vendor-rank mean; both period coverage counts disclose that. No universal rank accuracy or significance score is implied.

Custom comparator inputs retain exact dates. Unequal windows use elapsed-day overlay; no stretching or extrapolation. Selecting a chart range changes the table's statistics, summaries and export scope, with an explicit clear action. Requested wider context stays on the chart.

Saved views persist a named URL-state snapshot in browser storage. Notes and experiment drafts also stay local. CSV downloads contain the filtered, plotted scope with exact date bounds, method/status/depth, requested locale/device, coverage and comparator metadata. Report exports add attribution, native EUR and Europe/Berlin. Server-side sharing and account-level saved views are future implementation work.

## Overview

Question: **What changed across my apps, and where should I look?**

Compact first-time downloads, native-currency ad spend, tap CPA and developer proceeds precede a large daily trend. Each has a definition and prior-period reference. Chart modes keep counts and money on separate axes. App rows provide daily sparklines, movement and source status. Opening an app pivots to its Keywords watchlist with market and dates retained. Three bounded investigation cards pivot to keywords, paid acquisition or the change timeline.

The sample proceeds series is an explicit daily report fixture, not a production revenue claim. Portfolio money is summed only because all fixtures use EUR. Production must split incompatible currencies or require an explicit conversion policy. Real ranking or acquisition data cannot be inferred from this view's synthetic relationships.

## Keywords — flagship

Question: **Which histories changed, how stable are they, and can I trust the comparison?**

Default A: context → four compact statistics for the first selected keyword → large history chart → linked watchlist. B shares the chart row with the watchlist. Selection is capped at four plotted keywords; identities stay stable across filters. Checkboxes and legend buttons plot/unplot, bulk control chooses the first four visible terms, and Reset restores the initial pair. Hovering a table row highlights its line. Chart paths also highlight their row and open its drawer when clicked.

Search, rank-band and intent filters constrain the watchlist. Pins sort first and can filter to favorites. Grouping separates intent groups. Headers sort; Shift-click adds a secondary field. Latest sorts by the selected end-date rank; Mean Δ sorts period-average movement. Inline sparklines use the actual daily points and preserve gaps. Absence, failure and stale states cannot be sorted as zero rank.

The large plot supports crosshair tooltips across all selected series, keyboard arrows, a date slider, pointer brushing and the keyboard-accessible Select range dialog. Comparator observations carry their actual dates. Rank #1 is at the top, not bottom. Failed/untracked dates break lines; absent-in-depth is labeled rather than plotted as an invented numerical position. Legacy iTunes positions are visually separate and excluded from vendor means.

Competitor enables one clearly labeled synthetic competitor with matched market/device/date/method. This is a presentation demonstration, not provider integration or broad keyword discovery. Popularity/difficulty and keyword-install estimates are intentionally omitted until a licensed provider supplies defensible definitions.

Keyword drawer: first/last evidence, comparable mean and coverage, recent individual observations, explicit method, metadata changes and local note. Competitor explanation and paid-evidence caveats prevent accidental joins. A real paid keyword relationship is not invented from similar words. Start experiment carries the current scope and requires a title, hypothesis, success criterion and evaluation end. Controlled PPO is a planning type only; no Apple experiment is started.

## Apple Ads

Question: **Where did spend change, and what outcome is attributable?**

Chart modes are spend EUR, taps, attributed downloads, CPA EUR and impressions. Tap, view and total attribution are separately selected and labeled. Campaign → ad group → targeting keyword drilldowns retain app/market/dates; reported terms are a distinct sibling view. Table rows include spend trends, period change, attributed downloads and ratio-of-totals CPA. Legend toggles constrain chart series and report exports. Search and spend sorting operate on the current level.

The fixture uses native billing EUR in either country; selecting US does not convert to USD. Timezone is Europe/Berlin for reports. Provisional days are not in mature totals. Attributed downloads and CPA become Unavailable when attribution is ambiguous while spend remains visible. Search-term fixtures represent 93% of the synthetic parent; missing/suppressed terms are not zero. Child count fixtures are rounded illustrative values and are not a reconciliation benchmark.

No bid, budget, campaign, recommendation or metadata write exists in this prototype. Experiment notes record intent only. Live operational changes require separately evidenced history before becoming annotations.

## Experiments and Sources

Experiments provides a dated local journal. Default annotations are reviewed/awaiting-data examples; new notes are Planned. A note includes hypothesis, success criterion, evaluation date and captured scope. The final production system must add running, reviewed and inconclusive lifecycle transitions with evidence links; this prototype does not simulate a completed causal evaluation.

Sources provides a compact source/scope/last-complete/delay/next-action matrix and an observation glossary. Diagnostics are a secondary drawer. All connection states here are fixtures and must not be read as current production connection health.

“Explain this change” is a deterministic evidence preview scoped to the current series and range. It displays known observations and uncertainty; no LLM or external AI request occurs. Production may add an evidence-bounded explanation service after the source contracts pass.

## Edge-state review

| State | Open sample | Acceptance behavior |
|---|---|---|
| Missing observations | [Open](ux-design/prototype/index.html?screen=keywords&scenario=missing) | Failure, absent and untracked remain gaps; mean and coverage differ |
| Method discontinuity | [Open](ux-design/prototype/index.html?screen=keywords&scenario=legacy) | Pre-28 September legacy segment separated; no cross-method mean |
| Stale history | [Open](ux-design/prototype/index.html?screen=keywords&scenario=stale) | Last actual date 6 October; no carried-forward rank |
| Empty account | [Open](ux-design/prototype/index.html?screen=keywords&scenario=empty) | Clear first step, no fake chart |
| Reporting delay | [Open](ux-design/prototype/index.html?screen=ads&scenario=delay) | 9–11 October excluded; complete window ends 8 October; comparator recomputed |
| Ambiguous paid attribution | [Open](ux-design/prototype/index.html?screen=ads&scenario=ambiguous) | Spend available; attributed outcomes and CPA unavailable |
| Collection failed | [Open](ux-design/prototype/index.html?screen=keywords&scenario=failed) | Retain context; show failure and source next step |
| No permission | [Open](ux-design/prototype/index.html?screen=keywords&scenario=denied) | Access explanation without fabricated data |
| Loading | [Open](ux-design/prototype/index.html?screen=keywords&scenario=loading) | Reserved chart area; explicit loading state |
| Legitimate zero | [Open](ux-design/prototype/index.html?screen=overview&scenario=zero) | Explicit zero reports; CPA unavailable for zero denominator |

## Verification and limits

See [UX_VERIFICATION.md](UX_VERIFICATION.md) for exact observed checks and limitations. Eleven analytical unit tests passed; actual browser checks covered all six main screens, linked selections, market changes, keyboard scrubbing, date-range selection, custom comparison, event drawer, saved-view creation, Ads drilldowns and edge states. The CSV was downloaded and inspected, not merely inferred from source code.

Common laptop and narrow layouts were inspected; screenshots are review evidence, not measured performance or owner task success. The in-app browser Back command did not demonstrate a restored custom-period state during this run. URL encoding and a `popstate` renderer are implemented, but browser Back acceptance remains open for a normal browser and must pass before production parity. Pointer dragging, full screen-reader use, exhaustive sorting combinations, real provider contexts, currency reconciliation, large data volumes and production routing remain unverified. Range selection was verified through its accessible date dialog.

## Product Analytics — accepted implementation extension

Own top-level destination, four tabs: journey paths with clickable transitions; configurable ordered funnels with conversion horizon; exact-day retention and selectable cohorts; searchable schema-aware event counts. Every view retains app/market/date/comparison context, source state, local saved view and export. Installation/session identity is explicit. Purchase intent stays separate from proceeds. Both theme treatments and laptop behavior are mandatory; see document 15 for exact data definitions and incomplete features.
