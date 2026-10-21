# 13 — Signal implementation and owner acceptance

Status 15 October 2026: **B · Signal selected; development implementation authorized.** The previous Fieldwork choice request is superseded. Six-area navigation and Light / Dark / System are mandatory. Product Analytics is first-class. The canonical development build is `apps/tools`, not the archived static prototype.

## Delivered checkpoint

- Actual Next routes: Overview, Keywords, Apple Ads, Product Analytics, Experiments, Sources; reversible `KOPA_SIGNAL_UI` flag retains legacy reports.
- Linked keyword table/history, comparisons, annotations, evidence drawer, range selection, scope navigation and browser-local saved views.
- Product journeys, configurable ordered funnels, exact-day retention/cohorts, events; explicit installation/session units and purchase-source caveats.
- Light/Dark/System, desktop/laptop layouts, modal/keyboard controls and palette regression tests.
- Shared metric snapshots, JSON/CSV fixture read boundary, source-state gaps and tested export parity.
- Six actual-source OSS reviews; GET-only recent telemetry metadata audit; dependency baseline hardening.

See [14 feasibility](14_OPEN_SOURCE_FEASIBILITY.md), [15 Product Analytics](15_SIGNAL_PRODUCT_ANALYTICS_SPEC.md) and [Signal verification](SIGNAL_VERIFICATION.md) for precise evidence and incomplete work. Fixture completion does not establish source accuracy.

## Next vertical slices

The owner-approved next priority is InnerType actual-data integration. Its read-only snapshot checkpoint now includes observed-session paths/funnels, real event exploration and comparisons, with unavailable user retention/cohorts. See [16 integration and evidence](16_INNERTYPE_REAL_DATA_INTEGRATION.md) and [executed verification](INNERTYPE_VERIFICATION.md).

1. Complete the remaining M0 managed-schema, deployed writer/cron and full-project backup inventory. Scoped telemetry restoration has passed; it is not a full-project recovery proof.
2. Stage a versioned, retry-safe and concurrency-safe identity/event contract for InnerType. Preserve all historical rows. No person identities may be inferred from fragmented anonymous IDs.
3. Evaluate PostHog for future analysis after identity repair; no account activation, data transfer or new cost in this checkpoint.
4. Extend only validated read-only contracts to other apps. Prepare separate ASC download/sales/proceeds and Ads attribution/daily-report imports with official export reconciliation.
5. Complete owner operating tasks, source parity and reversible authenticated production rollout checks before cutover.

Remaining gaps include continuous authenticated production reads, verified user/device retention, transaction-backed monetization, synced saved views and the full managed recovery/deployment inventory. The local actual-data snapshot and explicit sample mode are separate.

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

## Authorization boundaries

Continue routine development, tests and read-only verification without another design-direction question. Pause only for a concrete destructive production change, new cost or live advertising/App Store operation. Document the exact operation and its reviewable result before seeking such approval. No calendar promise or owner-preference claim follows from a successful build.
