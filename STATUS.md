# Kopa milestone status · 15 October 2026

Source of truth: [docs/KOPA_ROADMAP.md](docs/KOPA_ROADMAP.md). This supersedes older ad hoc roadmap documents. Local development only; no deployment/release/configuration changes approved or made.

| Milestone | Status | Evidence / exact next task |
|---|---|---|
| M0 | In progress | Manual Apple refresh passed 15 Oct 13:05 UTC, period 14 Sep–11 Oct; 52 series/1,036 daily values independently reconciled. Accepted static page and refresh currently outside repo. Carry them in unchanged, add attempt/failure freshness metadata and preserve the first validated regression snapshot. |
| M1 | In progress — priority | PASSPORT isolated branch `codex/analytics-preflight-2026-10-15` from `f1894a7`. Inspect actual emitter/collector and run instrumented preflight before 23 Oct submission. |
| M2 | Not started | POIS read-only verification and both original defect reproductions complete in prior task. Local fixes remain to prepare; do not delay M1 or touch submitted binary. |
| M3 | Not started | Build one real Product Analytics view only after source contracts/preflight checks; no redesign. |
| M4–M8 | Not started | Follow roadmap gates; no scraping/ads/spending actions now. |

Current coverage: InnerType/LoveType official historical Apple snapshot. POIS actual **TestFlight only**, no appstore-tagged events as of prior 15 Oct snapshot. PASSPORT coverage not yet verified. Apple configuration blocker: LoveType Analytics request creation requires owner approval; Sales available. Private SQL read access is available through the owner-signed-in Supabase dashboard, not a persistent unattended SQL credential.
