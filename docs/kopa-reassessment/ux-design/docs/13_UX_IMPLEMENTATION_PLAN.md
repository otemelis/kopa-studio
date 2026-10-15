# 13 — Design-first implementation plan

Status: UX0/UX1 review candidate delivered; owner approval pending. The selective rebuild recommendation remains. This phase authorizes documents and an isolated sample prototype only. It does not authorize production screens, backend changes, production data mutation, deployment, vendor purchase or advertising operations.

## Revised order

The old late M6 “owner decision loop” is insufficient as a standalone UX milestone. Replace that sequencing with **UX0 → UX1 → explicit owner approval → M0/M1 and incremental source work + UX2 → UX3**. Source validation and interface contract design may then proceed together. Live screens still require validated sources; design approval is not proof that data is trustworthy.

| Gate | Concrete output | Depends on | Exit evidence |
|---|---|---|---|
| UX0 — actual workflow audit | Current Kopa diagnosis, public vendor references, reviewed data constraints | Read-only app/repository access | Document 10 distinguishes actual views, documented vendors and unknowns |
| UX1 — design exploration | Two directions; Overview, Keywords, Ads; linked selection, compare, drawer, source states | UX0 | Owner explicitly chooses direction and flagship workflow; acceptance changes recorded |
| M0 — preserve and secure | Safe copy/restore, immutable history, dependency and authorization checks | Separate implementation authorization | Original M0 restore and security acceptance; no destructive cleanup |
| M1 — source proof | Account mapping, supported rank context, report definitions and capped entitlements | Separate access/purchase authorization where required | Actual non-empty source samples, coverage and rights; no fixture substitution |
| UX2a — frontend foundation | Existing Next/React app primitives, scope/URL/query contracts, component catalogue | UX1 approval + safe isolated checkout | Approved appearance at 1280/1440px; keyboard and visual regression checks |
| M2 + UX2b — flagship rank slice | Recoverable import and typed observations; Keywords chart/table/drawer | M0/M1, validated provider + M5 identity contract | Real provider sample reconciles through DB, chart, drawer and export |
| M3 + UX2c — Overview | Correct ASC partition/report/money semantics; app/portfolio daily history | M2, ASC validation | Official report parity, common complete windows, currencies handled deliberately |
| M4 + UX2d — Apple Ads | Read-only daily facts, attribution/currency/timezone, campaign-to-term drilldowns | M1/M2, eligible account/report contract | Official export reconciliation; provisional and suppressed states preserved |
| M5 continuation + UX2e | Cadence validation, matched competitors, immutable watchlist/history | Licensed source and capped budget | Promised cadence and 14-day source validation evidence |
| M6 revised — decision loop parity | Connected journal and Sources across the migrated slices | Relevant validated slice, not all possible integrations | Portfolio → evidence → hypothesis → evaluation without lost context |
| M7 — bounded explanations | Contextual evidence-backed explanations | Validated typed queries, explicit AI configuration | Claims trace to observations; unsupported causal claims rejected |
| UX3 — owner usability gate | Same real tasks in Kopa and AppFollow/Apple workflow | Real-data flagship, stable relevant Ads/ASC slice | Owner task results and parity review before retiring old paths |

M5's source/identity prerequisites are pulled forward for the first rank vertical slice; its operational cadence validation continues afterward. If rank procurement fails, do not call legacy iTunes positions organic rank. Keep the approved design as a prototype, ship only source-validated report slices, or choose the existing vendor workflow.

## First production slice after approval

1. Reuse Next.js, TypeScript, React and Supabase. Work in an isolated checkout with explicit fixture and real-data routes. Adopt the chosen visual tokens and accessible primitives. Do not import this monolithic prototype script as production architecture.
2. Add shared typed scope: immutable app/query identity, storefront, requested/supported locale and device, requested/actual complete range, observation method/provider version, currency/timezone and attribution. Return coverage and unsupported filters with the query result rather than constructing them from frontend guesses.
3. Trial Recharts against Visx using the exact approved rank interactions and large realistic samples. Select from measured behavior, accessibility effort, maintainability and bundle cost. Document the decision; neither library is installed by this phase.
4. Implement pure analytical selectors, date/comparison math and exports independently of drawing code. Store status separately from numeric values. Add component tests for selection, tooltips, gap segments, period overlays, keyboard range selection and Back/Forward.
5. Deliver Keywords with a validated provider slice end to end. Preserve immutable historic query identities and method boundaries. Keep the previous route available behind a reversible read-only feature flag until acceptance passes.
6. Add Overview and Ads one source at a time. Each joins the same scope and drawer conventions. A pending backend contract displays an explicit unavailable state; never expose fixtures as live facts.
7. Add journal persistence and provenance-linked events only after read-only source parity. AI is last; the owner should already be able to answer the question from the evidence.

## Release-level analytical contracts

| Boundary | Must survive ingestion → API → UI → export |
|---|---|
| Rank | Observed / absent-with-depth / failed / untracked / stale; provider/method and exact context |
| Comparison | Inclusive date meaning, correct prior window, full coverage, no interpolation, no silent cross-method averages |
| Acquisition | First-time downloads distinct from total/redownloads; newest complete report instance per date |
| Money | Per-unit vs total proceeds corrected; native currencies split unless explicit conversion |
| Ads | Genuine daily rows, account timezone, distinct tap/view/total, country dimensions supplied by source, rolling revisions |
| Journal | Criteria saved before evaluation, controlled PPO distinct from observation; changes do not prove causes |
| Navigation | URL/Back/Forward/refresh and saved views retain app, market, dates, selected series and drilldown |

## UX3 owner comparison protocol — not yet conducted

Use the same app, storefront, device and complete dates in each tool where supported. Counterbalance which tool is used first. Record task completion, elapsed time, clicks/page hops, scope resets, wrong interpretations, and a short owner ease rating. Do not compare unavailable data as if it were present in both systems.

| Task | Correct completion evidence |
|---|---|
| Find strongest confirmed 28-day improvements and declines | Select valid series; report comparable movement and coverage; no missing-as-zero interpretation |
| Compare two keywords' stability | Read daily shape and descriptive volatility; distinguish a sparse series from stable behavior |
| Inspect a decline near a metadata update | Open dated annotation and explain coincidence without causal assertion |
| Find last complete week's campaign/term spend vs prior week | Correct complete windows, attribution, billing currency/timezone and suppressed coverage |
| Export the selected analysis | File matches filters, selection, dates, methods and statuses; explain stale/failed/absent correctly |

Proposed gate: complete all five tasks without a critical interpretation error; no repeated loss of scope; owner chooses Kopa for the daily history task; median time/page hops improve or the remaining tradeoff is explicitly accepted. These are proposed acceptance thresholds, not measured results. If the interface loses, refine the interaction rather than rationalizing the visual style.

## Concrete approval request

Review the six main screens plus Keywords comparison/drawer, missing history, method discontinuity and Ads delay/ambiguity. Approve (or amend): **Fieldwork vs Signal; chart/table placement; comparison default; density; drawer and experiment-note workflow**. A visual approval covers the design direction. It does not independently authorize source purchases, production migration or deployment.

The previous 20–30 working-day broad V1 estimate excludes this expanded design and usability scope and is superseded pending approval and source trials. Re-estimate each accepted vertical slice after the component/library spike. No calendar promise follows from prototype completion.
