# Kopa milestone status · 15 October 2026

Source of truth: [docs/KOPA_ROADMAP.md](docs/KOPA_ROADMAP.md). This supersedes older ad hoc roadmap documents. Local development only; no deployment or release. Restricted SQL login explicitly approved and created; no other production changes.

| Milestone | Status | Evidence / exact next task |
|---|---|---|
| M0 | Done | Canonical accepted page at `npm run portfolio` / localhost:4340; refresh and first accepted regression CSV now in repo. Visible complete date, attempt, success and failed/stale state. Eleven reporting tests plus corrupt-publication test pass; canonical calculations replay official source and all 52 series/1,036 daily values reconcile. |
| M1 | Blocked at contract/deployment gate; local preflight complete | PASSPORT `d8a0df1`: strict response acknowledgement fix; 11 simulator tests and actual emitter→collector→temporary Postgres pass. Hosted table empty. Identical retry doubles anonymous counts; no exact distinct/retention capability exists. See `docs/milestones/m1/PREFLIGHT.md`. New replay contract requires owner approval; no release/deployment performed. |
| M2 | Done locally — shipping gated | POIS `702fe2b`: validated acknowledgements, bounded rejected-event quarantine, persisted recovery session identity. 34 simulator tests pass; 10 StoreKit CLI cases explicitly skip. Actual recovery method regression passes both branches and legacy/repeated cases. No submitted binary changed. |
| M3 | Working capability — owner review checkpoint | Live read-only page at localhost:4340/product.html. Restricted TLS login and two SELECT-only RLS policies separately approved/applied. Complete UTC period reconciled independently: 324 events, 3 active installations, 2 onboarding/first-session completions, 1 paywall/trial, D1 1/2, D7 immature. Source failure and empty-source states verified; no production customer activity observed. See docs/milestones/m3/README.md. |
| M4–M8 | Not started | Follow roadmap gates; no scraping/ads/spending actions now. |

Current coverage: InnerType/LoveType official historical Apple snapshot. POIS actual **TestFlight only**, no appstore-tagged events as of prior 15 Oct snapshot. PASSPORT anonymous aggregate schema/collector verified; zero hosted rows. Apple configuration blocker: LoveType Analytics request creation requires owner approval; Sales available. Private SQL read access is available through the Supabase connector and signed-in dashboard; the private SQL credential and approved RLS policies now support the local page.
