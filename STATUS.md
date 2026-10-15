# Kopa milestone status · 15 October 2026

Source of truth: [docs/KOPA_ROADMAP.md](docs/KOPA_ROADMAP.md). This supersedes older ad hoc roadmap documents. Local development only; no deployment/release/configuration changes approved or made.

| Milestone | Status | Evidence / exact next task |
|---|---|---|
| M0 | Done | Canonical accepted page at `npm run portfolio` / localhost:4340; refresh and first accepted regression CSV now in repo. Visible complete date, attempt, success and failed/stale state. Eleven reporting tests plus corrupt-publication test pass; canonical calculations replay official source and all 52 series/1,036 daily values reconcile. |
| M1 | In progress — priority | PASSPORT isolated branch `codex/analytics-preflight-2026-10-15` from `f1894a7`. Inspect actual emitter/collector and run instrumented preflight before 23 Oct submission. |
| M2 | Not started | POIS read-only verification and both original defect reproductions complete in prior task. Local fixes remain to prepare; do not delay M1 or touch submitted binary. |
| M3 | Not started | Build one real Product Analytics view only after source contracts/preflight checks; no redesign. |
| M4–M8 | Not started | Follow roadmap gates; no scraping/ads/spending actions now. |

Current coverage: InnerType/LoveType official historical Apple snapshot. POIS actual **TestFlight only**, no appstore-tagged events as of prior 15 Oct snapshot. PASSPORT coverage not yet verified. Apple configuration blocker: LoveType Analytics request creation requires owner approval; Sales available. Private SQL read access is available through the owner-signed-in Supabase dashboard, not a persistent unattended SQL credential.
