# Kopa Studio — Execution Roadmap
**Version:** 1.0 · **Date:** 15 October 2026 · **Owner-approved direction:** lightweight internal app-growth reporting, not a general-purpose analytics platform.

## 0. Mission and priorities

**One business question:** Across InnerType, LoveType, POIS and PASSPORT, are people discovering, installing, using and purchasing the apps—and where should acquisition effort go next?

**App priority:**
1. **PASSPORT** — target App Store submission **23 October 2026**. Validate instrumentation before submission; do not compromise the release.
2. **POIS** — **already submitted for Apple review**. Validate TestFlight data and safely prepare reliability fixes; production app behavior will be unknown until live events arrive.
3. **InnerType** — live app used as a known-data test bed and official-Apple reconciliation reference; no product-specific feature investment unless essential.
4. **LoveType** — secondary; maintain basic coverage where data exists, avoid bespoke work.

**What Kopa is:** One simple, dark-mode-capable reporting interface with independent source sections for App Store Connect, Product Analytics, ASO ranking observations, Apple Ads, and (later) Meta/Google/TikTok. Each source can fail without hiding the others.

**What Kopa is not:** A new PostHog, AppTweak, RevenueCat, ad network, data warehouse, autonomous bidder, analytics SDK, ETL framework, or another UI redesign. Preserve the existing accepted Signal aesthetic and the functional minimal portfolio page. Do not restart the codebase again without demonstrated necessity.

**Current baseline (not new work to repeat):**
- App Store historical report for InnerType and LoveType was independently reconciled for **14 Sep–11 Oct**; the portfolio snapshot is implemented. A separate Codex task to make official Apple extraction refreshable was assigned; verify its actual status rather than assuming completion.
- POIS event audit found its real telemetry in Supabase's private **`form`** schema, not InnerType's `public.events`. For **17 Sep–14 Oct**, verified *TestFlight* activity was **3 active installations, 2 onboarding completions, 6 matched sessions, 1 observed trial completion**, and D1 retention **1/2 eligible**. There were **no observed `appstore` events**. None of those TestFlight numbers is production evidence or verified revenue.
- Two POIS reliability bugs were reproduced locally: an HTTP 200 collector response can contain ignored per-event rejections; recovered sessions can lose their analytics session UUID. Fixes were **proposed, not implemented**. Consult `FIXES_REQUIRING_APPROVAL.md` and `REPORT.md` from the prior Codex task.
- PASSPORT analytics schema and event coverage have **not yet been audited in this conversation**. Inspect the real implementation; do not infer the event names from POIS.

## 1. Rules of engagement for Codex

1. **Follow milestones in order, except expedite PASSPORT pre-submission work.** Work through the roadmap without requesting permission to run read-only SQL, validate counts, generate temporary CSVs, run local tests, or make ordinary local-development commits. Those are your engineering responsibilities, **not user review gates**.
2. **Deliver working capabilities, not reports as the final product.** SQL, CSV, hashes and reconciliation are internal proof. The owner reviews an actual Kopa page, reliable behavior or a simple decision—not a 40-page audit for each milestone.
3. **Small diffs, one measurable result per milestone.** Favor simple SQL, small read adapters and existing libraries. No generic abstractions, rewrites, new event taxonomies or microservices unless a named acceptance test requires them.
4. **Use existing infrastructure.** Keep app telemetry in its current Supabase project/schema; access private data **server-side using least-privilege credentials**. Never expose service keys or identifiable installation histories to the browser. Prefer straightforward read-only aggregate queries or narrow views; add a cache only if measured performance requires it.
5. **No fake fallback.** Synthetic fixtures are allowed in an isolated demo/test mode only. Real dashboards must never silently fall back to sample data after fetch errors. Explicitly distinguish **no data yet, zero, delayed, unavailable, failed, TestFlight and App Store production**.
6. **Preserve metric identities.** `installation_id` is not a person or an Apple download. App Store purchase units are not distinct customers. POIS `purchase_completed` is a client observation, not verified paid revenue. Paid network-reported conversions are not automatically attributable Apple transactions. Do not falsely join different reporting grains, timezones or currencies.
7. **Validate inside the milestone.** Every new metric needs one source query, one independent cross-check or fixture with known expected output, date/identity/denominator definition, and a complete/partial state. Use validation scripts internally; do not turn verification into a separate multi-day product.
8. **Protect apps nearing launch.** Local code/test fixes are allowed on development branches. Do not change live POIS/PASSPORT database schemas, collector deployment, credentials, analytics event contracts, TestFlight/App Store builds, submissions, ad campaigns, provider purchases or paid services without owner approval. Never hold a submitted release hostage for Kopa.
9. **Approval only for real-world consequences:** production mutations, schema/permission grants, app release/submission changes, new recurring costs, or live ad spending/actions. If blocked, describe the single necessary owner action and continue on other independent tasks; don't turn every informational uncertainty into a meeting.
10. **Stop overengineering:** If a milestone grows past roughly one to two focused Codex work sessions without delivering its acceptance criterion, report the obstruction, reduce scope and choose the smallest alternative. Favor a trustworthy partial capability over a grand system.

## 2. Milestones

### M0 — Stabilize the reporting baseline (small; do not redo completed work)
**Objective:** Know what's running and avoid multiple conflicting Kopa versions or data imports.

**Tasks:**
- Inspect the current Kopa code/branch and the already assigned App Store Connect refresh task. Record what has actually shipped, what is still a prototype, and whether a successful manual refresh reconciles against official Apple reports.
- If the official Apple refresh is already complete and verified, leave it alone. If incomplete, finish **only** that bounded task (no new ingestion architecture).
- Establish one clearly visible `last complete data date`, `last refresh attempt`, `last successful refresh` and source failure status on the overview.
- Keep the prior 28-day official report as a regression check. Keep currency and timezone semantics explicit.

**Done when:** A refresh can replace the historical snapshot without changing code, reconcile to source reports, and display stale or failed data as stale/failed (not zero or sample data). A brief status log lists any remaining Apple credentials/report-configuration blockers.

### M1 — PASSPORT analytics preflight **before 23 October** (highest calendar urgency)
**Objective:** Avoid shipping PASSPORT without basic visibility into activation and purchase attempts.

**Tasks:**
- Inspect PASSPORT's actual app event emitter, collector, database schema, identity model, build-channel stamping and purchase lifecycle. Do **not** assume event names, fields, flows or providers.
- Define the smallest reportable PASSPORT journey using events **that actually exist**: first observed open → first meaningful passport action (e.g., country/stamp added, if recorded) → return use → paywall → observed purchase/trial. Mark unavailable stages, don't fabricate them.
- Run a bounded end-to-end TestFlight/development test for event creation, batch delivery, storage, deduplication, environment separation and error acknowledgements. If no usable build exists, perform the closest reproducible instrumentation test and note the gap.
- Implement only minimal **local** prelaunch reliability fixes with focused tests when a verified defect threatens event collection. Do not risk the 23 October submission without explicit approval.
- Draft the smallest PASSPORT source adapter contract needed by Kopa: daily distinct observed installations, first-value-action installations, onboarding completion if real, paywall entrants, observed purchase completions, basic return activity. No dashboard rebuild yet.

**Done when:** A concise event matrix states **observed / emitted-but-not-validated / absent**; real TestFlight or instrumented test events can be traced end to end, with no silent acceptance of rejects; a one-page go/no-go for telemetry is ready ahead of submission. No impact to launch without approval.

### M2 — POIS telemetry reliability (can overlap M1 only if it doesn't delay PASSPORT)
**Objective:** Remove known data-loss and session-join defects without disrupting the submitted POIS build.

**Tasks:**
- Read the previous `FIXES_REQUIRING_APPROVAL.md`, `REPORT.md` and the original POIS analytics audit. Reproduce the two known defects.
- On a **local development branch**, implement the smallest fix to inspect per-event ingestion acknowledgements and retry/report rejected items appropriately; avoid duplicate event creation and infinite retries.
- Preserve and restore `session_id` for interrupted-session recovery, or explicitly record an unmatched recovered ending where restoration is impossible. Test the relevant restart and recovery paths.
- Regression-test onboarding, session completion, paywall and purchase events; validate both normal and rejected/bad-schema batches. Do not deploy or alter the under-review binary without approval.

**Done when:** Focused tests prove both defects corrected locally and an implementation note states precisely what would have to ship in a future POIS build. Existing TestFlight-only dataset remains correctly labeled.

### M3 — Live POIS + PASSPORT Product Analytics inside Kopa
**Objective:** Replace raw Supabase tables with an immediately useful, **real-data** product view; this is the first core product deliverable after launch readiness.

**Tasks:**
- Build **one reusable Product Analytics page** inside the existing minimal Kopa shell (not separate apps): persistent app selector, TestFlight/App Store environment, 7/28-day window, latest data date and source freshness.
- Read actual POIS and PASSPORT Supabase data through private, read-only server operations with narrow, source-specific queries. Keep separate schemas and identifiers; don't introduce a unified raw event warehouse.
- Top of page: observed active installations, observed first open, onboarding completion where tracked, activation/first core action, paywall exposure, observed purchase/trial completion, D1/D7 retention **only for mature cohorts**. Use explicit eligible cohort denominators; choose a fixed funnel horizon and document it.
- Below: a simple **ordered journey/funnel with drop-offs** and a daily trend for a selected metric. Include a POIS-specific first-session/usage drilldown and a PASSPORT-specific first-value-action drilldown, only where valid data exists.
- Preserve metric statuses and distinctions: no `appstore` events means **Production not yet observed**, not 0% conversion; client purchase ≠ paid transaction; `session_id` identifies a POIS posture session, not app browsing.
- Validate every visible metric against source SQL and automated tests; reconcile both the period aggregate and at least a small daily sample. Protect identity and exclude raw private content in UI/export.

**Done when:** The owner can open a live Kopa page and answer “What proportion of observed TestFlight/production installations reach first value and the paywall, and where do they leave?” for whichever app has qualifying data. No SQL, CSV or notebook interaction required. Unavailable metrics remain visible as unavailable.

### M4 — Real launch monitoring and simple portfolio decision view
**Objective:** Prepare useful reporting as POIS goes live and PASSPORT launches; don't wait for huge cohorts.

**Tasks:**
- Put one compact row per app on Kopa Overview: App Store official visibility/downloads/purchase units (when available), product first-open and activation, and a date/freshness indicator. Do not draw a pseudo-user-level funnel across Apple aggregate data and installation events.
- Provide POIS/PASSPORT first 7/14/28-day trend comparison **when data exists**, plus data coverage warnings and breakdown by actual environments. Retention remains unavailable until cohorts mature.
- Use one or two truly actionable anomalies only after enough volume; don't generate alarms from sample sizes of 1–3. Keep InnerType/LoveType as low-priority background rows.
- On launch, verify that actual App Store build-channel events and official Apple data begin arriving, independently; never convert TestFlight activity into live traffic.

**Done when:** In about a minute the owner can distinguish discovery/downloads, first observed app activity, first value, and Apple-reported purchases for POIS/PASSPORT with current dates and clear measurement boundaries.

### M5 — In-house ASO rank collector: **feasibility first, then tracker**
**Objective:** Obtain valuable ranking history that App Store Connect does not supply; avoid repeating the old Kopa's misleading iTunes “organic rank.”

**M5a — Proof, timeboxed:**
- Extract/read the old Kopa search collector as a reference, without bringing across its app architecture. Compare it with one viable **permitted** native-storefront observation technique; document terms, countries, devices, language, response depth and sponsored-slot handling.
- Pilot **20 relevant terms for POIS in Germany**, then a small contrasting storefront set, over at least three observation runs. Compare a subset with actual native App Store searches under recorded conditions. Record failed requests, non-appearance within depth and stale observations as **different states**.
- Explicitly test whether iTunes result position agrees with a native observation; if not, label it `iTunes catalog position`, **never organic rank**.
- Set a stop condition: if native result ordering cannot be captured repeatably and lawfully within a bounded pilot, **do not spend weeks implementing a crawler**. Recommend a narrow external data import or an honestly labeled proxy until another method is validated. No CAPTCHA circumvention or protective-control evasion.

**M5b — Only after proof passes:**
- Implement the smallest scheduled collector for selected app/keyword/market/device/locale, retaining method/version, observed time, depth, result/error state and raw request evidence where permitted. Bound rate/cost; retry without silently rewriting history.
- Add **one Keyword Tracker** view: tracked terms, current observed position, 7/28-day movement, a selectable rank history chart, country filter, and a few tracked competitors. Do not add difficulty models, keyword-install estimates, automated metadata writing or AI recommendations.

**Done when:** A tracked keyword's ranking series is reproducible and labeled with the actual observation method, and the owner can tell improvement from a missing collection. If M5a fails, the outcome is an honest source decision, not a fabricated tracker.

### M6 — Apple Ads: read-only daily campaign performance
**Objective:** Answer what spend is buying for POIS/PASSPORT after campaigns exist.

**Tasks:**
- Prefer Apple's supported current API and simple official exports where needed; treat the old v5 Kopa adapter as reference code only. Validate account access and native report definitions before building the UI.
- Import daily campaign / ad-group / keyword or search-term spend, impressions, taps and network-attributed downloads at available granularity, with currency, timezone, maturity, attribution type and revisions.
- Verify one bounded window against an Apple Ads console export. Show spend, reported results and CPA without claiming Apple-confirmed paying users by campaign absent defensible linking data.
- Build one simple paid-acquisition drilldown under the same app/date selection. Read-only; no bid changes or auto-pauses.

**Done when:** For active Apple Ads campaigns the owner can see spend and reported acquisition results daily, reconcile with Apple, and identify candidate waste/investigation areas.

### M7 — Meta / Google / TikTok, **only when channels are used**
**Objective:** Expand the same acquisition view rather than create three more products.

**Tasks:**
- Add **one platform at a time** when there is real spend and API/export access. Keep each integration's original conversion definitions, window, timezone and currency. Begin read-only.
- First prove one campaign/day slice against its own console. Then expose spend, delivery, network-reported installs/purchases when supported, and cost per reported result.
- Show incomparable reported conversions side-by-side but don't falsely aggregate into “verified purchases” or universal ROAS. Investigate attribution/MMP only if campaign spend and decision-making actually demand it.

**Done when:** One paid overview can compare actual spend and each network's separately defined outcomes by app/day/channel, with source labels. No unverified cross-platform conversion union.

### M8 — Experiments, useful AI access and approved actions (**later**)
**Objective:** Convert trusted historical evidence into next actions after M3–M7 are useful.

Add only a simple release/campaign/metadata change log, trend annotations, weekly changes worth reviewing and a read-only API for AI. Make recommendations reference app, window, numbers and limitations. Do **not** implement autonomous ad spend or App Store edits unless separately requested with approval and safeguards.

## 3. Operating rhythm and reporting

- **One milestone = one pull request/commit series + working demonstration + short `STATUS.md` update.** Avoid a separate research deliverable unless feasibility genuinely determines the build (PASSPORT event availability, ASO capture method).
- At each milestone, update `docs/KOPA_ROADMAP.md` in the working repo: `Not started / In progress / Blocked / Done`; date; what changed; how to test; sample vs live coverage; evidence; blockers; the exact next task.
- **Automatic progression:** after tests/acceptance pass, proceed to the next authorized, independent milestone. Do not ask the owner to inspect SQL, hashes or CSV exports as a prerequisite to routine implementation.
- **User review checkpoint:** request review only when a *new working business capability* appears (M3 real product view, M5 rank proof/tracker, M6 paid view), or when a genuine approval gate is encountered.
- Avoid multi-day work just to design. If a metric cannot be computed correctly, mark unavailable and continue with the rest of the screen.

## 4. Global definition of done

A milestone is done only if:
1. It answers its named question using actual data where possible, and explicitly says what cannot yet be known.
2. A small independent verification catches truncated reads, duplicate records, timezone/grain mismatches and unexpected empty inputs relevant to that milestone.
3. The user-facing view does not silently switch to fixtures, overstate attribution, or present TestFlight as App Store production.
4. The implementation runs with available credentials and fails safely when a private source cannot be accessed.
5. There is a working page/test/demo or concrete launch-readiness fix, not just a CSV or lengthy proposal.
6. Its new code is proportionate and no unrelated functionality was refactored.

## 5. Immediate start instruction

**Start at M0 (brief status only) then M1 PASSPORT preflight immediately because of the 23 October deadline.** M2 POIS fixes may be prepared locally in parallel only if M1 is not delayed. After prelaunch checks, proceed to M3 Product Analytics in Kopa. Later run M5 ASO feasibility before committing to scraping infrastructure. Respect production approval gates throughout.

## Execution status — 15 October 2026

The approved roadmap above is preserved verbatim. Current milestone evidence, tests, blockers and exact next tasks are maintained in [`../STATUS.md`](../STATUS.md). M0: Done (canonical page, refresh/failure metadata and regression checks verified). M1: local preflight/ack fix complete, blocked at replay-contract gate. M2: Done locally (702fe2b), future shipping approval required. M3: Done, owner accepted 15 October. M4: local portfolio coverage ready, real production launch evidence pending. M5a: retained daily collector and real AppFollow export compared; native automation NO-GO, native pilot not run. M5b: bounded historical comparison page ready; automated tracker gated. M6: first official one-day export numerically reconciled and working manual historical Ads view; wider daily/live integration incomplete. M7–M8: Not started. Production, release, permission and cost gates remain in force.
