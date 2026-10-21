# 11 — Design system and analytical grammar

> **Owner-approved implementation amendment — 15 October 2026.** B · Signal is selected; development work is authorized on `codex/signal-product-analytics`. The earlier Fieldwork recommendation/direction-choice gate below is historical and superseded. Six core destinations now include first-class Product Analytics. Light / Dark / System are mandatory. The canonical implementation is `apps/tools`, behind `KOPA_SIGNAL_UI=1`; fixtures require development plus `KOPA_SIGNAL_FIXTURES=1` and `data=sample`. See [14 OSS feasibility](14_OPEN_SOURCE_FEASIBILITY.md), [15 Product Analytics](15_SIGNAL_PRODUCT_ANALYTICS_SPEC.md) and [Signal verification](SIGNAL_VERIFICATION.md). Production cutover still requires source parity, restore evidence and owner task acceptance; no costly or destructive action is authorized by this amendment.


Status: Signal selected; actual Next development components and Light/Dark/System implemented. Owner operating acceptance remains pending. The original two-direction token comparison below is historical; implemented Signal tokens follow at the end.

## Foundations

| Token / rule | A · Fieldwork | B · Signal |
|---|---|---|
| Page / surface | `#f7f8f6` / `#ffffff` | `#f2f4f8` / `#ffffff` |
| Primary / secondary text | `#202b2a` / `#617068` | `#252d40` / `#626d80` |
| Border / quiet fill | `#e1e6e2` / `#f0f3ef` | `#dfe4ed` / `#eef1f7` |
| Interactive accent | `#126c5a` | `#4a55a2` |
| Semantic positive / negative | `#176d53` / `#a34b36` | Same semantic meaning |
| Warning / focus | `#8a6526` / `#215bce` | Same semantic meaning |
| Rail / panel radius | 190px / 9px | 152px / 5px |
| Primary composition | Full-width history above watchlist | Split table/history above 1150px |

Use system sans-serif with Inter as an optional installed preference; no remote font request. The Fieldwork wordmark uses the system serif. Headings 28/16/13px (Signal 24/16/13); body 13px; dense data 11–12px; supporting labels 10–11px. Numeric text uses tabular figures. The small supporting text deserves owner review on the actual laptop; a comfortable-density option belongs in the production slice if it impedes reading.

Spacing uses a 4px rhythm: 8px control gaps, 12–16px local groups, 20–24px panel separation and 32px main gutters. Borders separate areas; shadows are reserved for overlays. No ornamental gradients, glass, neon or animated charts. Optional drawer reveal lasts 160ms and respects reduced-motion settings.

## Reusable component contract

| Component | Required behavior |
|---|---|
| Workspace rail | Five stable destinations; compact accessible labels; current-page state |
| Scope bar | App/portfolio, country, requested locale/device, requested dates, named comparator; no duplicate local scope controls |
| Reliability strip | Last complete comparable date, timezone, provisional-tail treatment; link to Sources |
| Compact metric | Definition, value, comparator and meaningful sparkline; no value where source is unavailable |
| History frame | Large plot, scoped legend, actual date labels, one unit per axis, linked table, date-range selection, annotations |
| Watchlist table | Search, rank/intent filters, sorting, pins, grouping, bulk plot, bounded plotted selection, scope export |
| Evidence drawer | Source-specific observations, scope, method, coverage, related changes, notes and experiment entry |
| Period dialog | Independent current/comparator bounds, validation, actual dates visible after applying |
| Local view / note | Explicit local storage, no account sync implied; fixtures never written to production |
| State panel | Clear loading/empty/error/permission message, retained context and one relevant next step |

## Chart grammar

1. Rank #1 sits at the top. A smaller number is a better observed rank. Positive movement = previous observed mean minus current observed mean. This is not a significance test.
2. Current observations use solid segments; prior-period observations use a lighter dashed stroke and actual comparator dates in tooltips. Legacy search positions use a separate dashed method segment. No method boundary or missing observation is connected.
3. Stable series colors, explicit keyword names and circle/diamond/triangle legend symbols identify terms. Endpoint markers repeat these shapes; rich tooltips retain explicit names. Never encode the meaning solely in hue.
4. Failed collection uses ×, absent within measured top 100 uses ▽, and untracked/stale observations remain gaps. Absence contributes to collection coverage, never to numerical rank means. An absent result is not rank 101.
5. Rank filters are exactly 1, 2–5, 6–10, 11–20, 21–50 and 51–100. They filter the latest actual status in the selected range; no discovered-keyword universe is implied.
6. Means and population standard deviations use only observed vendor ranks in the selected scope. First/last positions show their actual observation dates. Both periods' collection counts remain visible. No cross-method improvement is calculated.
7. Compare equal windows by default. Custom windows retain their dates; unequal periods overlay by elapsed day with an explicit label. A shorter comparator has no invented later observations. Full-window summaries remain distinct from the plotted overlap.
8. Tooltip aligns the date across selected series, shows missing state, provider/method, market/device and previous observation date. Keyboard arrows and the slider provide a pointer-independent alternative.
9. Pointer dragging or the Select range dialog changes the analysis window used by summaries, table statistics and exports. A visible banner clears it. The larger requested window remains the chart's context.
10. Dated metadata, release and experiment events open evidence. Neither vertical alignment nor “Explain this change” asserts causality.
11. Ads chart modes show spend EUR, taps, attributed downloads, CPA EUR or impressions separately. CPA is sum(spend) / sum(attributed downloads), not an average of daily ratios. Native billing currency stays EUR even when the selected storefront is US.
12. Provisional days are gaps in the delay scenario; only mature dates enter totals and a same-length prior comparator. If all selected days are provisional, show an explicit no-mature-data panel.

## Keyboard, focus and responsive behavior

Native selects, checkboxes, buttons and table controls support Tab/Enter/Space. Search updates the scoped table. Shift-click headers adds a secondary sorting key. Chart arrows/slider scrub observations. Date dialogs provide a keyboard alternative to dragging. Escape closes overlays. Dialogs cycle focus within their controls and return it to the opener where it remains in the document. Command-K opens destination shortcuts while preserving app/market/date context.

At laptop widths Fieldwork retains a wide chart. The actual Signal workbench stacks below 1100px. At 760px the rail becomes icon-only with accessible names, metrics use two columns and scope controls wrap. At 390px tables scroll inside panels; the page itself must not overflow. Drawers fit the viewport. Dense desktop analysis is prioritized; narrow screens support inspection and notes rather than pretending to fit a full analytical table into a phone.

Core text tokens are checked for AA contrast in the verification record. Focus rings, text/symbol states and native table alternatives are present. Full assistive-technology evaluation, zoom/reflow at 200–400%, target sizing under real touch use and long localized labels remain production acceptance checks; this prototype is not a WCAG conformance certification.

## Production chart-library evaluation

The buildless prototype uses a small SVG renderer to make design review independent of installations or backend access. It is disposable design scaffolding.

Recharts is the initial production candidate because its public API includes responsive containers, tooltips, brushes and reference annotations. A scoped trial must still prove source-boundary gaps, stable identities, inverted rank axis and keyboard interaction. [Recharts official API](https://recharts.github.io/en-US/api/).

Visx is the alternative when custom brushing and annotation grammar cannot be implemented cleanly with the chart abstraction. Its primitive composition would require more application-owned accessibility and interaction work; that is an implementation assessment, not a benchmark. [Visx official project](https://github.com/airbnb/visx).

Before selecting either: test 4 selected series × 365 dates, 20 comparison series and a 2,000-row virtualized watchlist on the owner's laptop. Measure p95 hover response, range-update latency, scroll stability and bundle contribution. Suggested budgets: hover under 50ms; scope/table update under 150ms after data is loaded. No such performance measurement has been performed in this phase. Avoid choosing a library from demo appearance alone.

## Implemented Signal theme tokens

The canonical tokens live in `apps/tools/src/app/signal.css`. Independent palettes are checked by contrast regression tests: body/muted/accent/status text targets at least 4.5:1 on canvas, surface, rail and soft surface; each chart series targets at least 3:1 on its surface. Shapes, labels and line styles accompany color. These token tests do not replace full screen-reader or every rendered-state testing.

| Semantic token | Light | Dark |
|---|---|---|
| Canvas | #f5f6fa | #121824 |
| Surface | #ffffff | #1a2331 |
| Rail | #eff1f6 | #151e2c |
| Soft | #edf0f6 | #232e40 |
| Text / muted | #252e42 / #606d82 | #e6ecf6 / #a6b3c9 |
| Accent / selected | #4d59a7 / #e8ecfb | #b0baff / #2c3655 |
| Positive / negative / warning | #216e57 / #a04738 / #805f21 | #86d5af / #f0a18b / #e6c477 |
| Series 1–4 | #5163b3 / #128273 / #b35b42 / #8660ad | #a9b7ff / #72d1ba / #edac85 / #c8a1ec |
| Tooltip / ink | #263346 / #f5f7fc | #e5eaf4 / #202c40 |

Use the shared Next components, not the archived buildless prototype, for further implementation. Date brush has keyboard and date-input alternatives; native modal dialogs provide focus containment and Escape dismissal. Retained legacy CSS must remain scoped out of Signal tables and actions.
