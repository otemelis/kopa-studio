# Kopa Tools — Roadmap Reconciliation and Product Reset

Status: active product roadmap
Activated: 2026-07-28
Authoritative state: [KOPA_CURRENT_STATE.md](KOPA_CURRENT_STATE.md)
Reconciliation: [KOPA_ROADMAP_RECONCILIATION.md](KOPA_ROADMAP_RECONCILIATION.md)

## Product promise

Open Kopa and understand what changed, why it matters, whether the evidence is trustworthy, and what to do next.

## Working rules

- Use the current-state file before starting work.
- Inspect code and production-shaped evidence before accepting documentation claims.
- Build the smallest complete vertical slice.
- Keep Apple Ads at Automation Level 0 unless a future roadmap explicitly changes it.
- Do not add standalone product pages when an existing destination can carry the workflow.
- Do not remove compatibility routes until their replacements pass signed-in owner verification.
- Do not resume attribution automatically.

## Active milestone order

### 1. Trust and Data Correctness — COMPLETE

Goal: make existing evidence reliable enough to drive decisions.

Scope:

- enforce app, storefront/market, locale, date range, metadata version and evidence-window context;
- verify App Store Connect parser columns, raw payload, zero/partial/failure behavior and versioning;
- correct market readiness/localization claims;
- fix Apple Ads search-term product-fit decisions and source-keyword diagnosis;
- distinguish freshness, completeness, volume, relevance and cross-source agreement;
- unify recommendation dedupe identity;
- verify production/source parity and authenticated owner access.

First slice:

> UK Apple Ads evidence-to-action correctness for the current live dataset.

Implementation status on 2026-07-29: complete in production. The additive recommendation-context migration is applied, the `apps/tools` production deployment is live, and the owner confirmed the prescribed recomputation, six-conclusion presentation, and repeat-run acceptance flow works correctly.

Second slice:

> App Store Connect parser integrity for one production Discovery & Engagement report.

Implementation status on 2026-07-29: complete in production. The owner-authenticated import processed 183/183 source rows from four segments with zero rejected rows, recorded `discovery-v2`, twelve exact Apple columns, raw-row provenance, and a 2026-07-22–27 evidence window, and the Sources page passed signed-in acceptance.

Third slice:

> GB market-readiness integrity for app language, metadata, and screenshots.

Implementation status on 2026-07-29: complete in production. GB now remains Unknown for all three localization evidence layers because no exact-country evidence exists, while its nine tracked keywords, App Store Connect coverage, and Apple Ads activity remain visible. App-wide languages, legacy booleans, free-text notes, and market activity cannot upgrade localization claims. The Markets page and ASO overview passed signed-in acceptance.

Fourth slice:

> Recommendation app-and-market scope integrity for the InnerType GB feed.

Implementation status on 2026-07-29: complete in production. ASO insights, Apple Ads recommendations, and Discovery evidence now filter by exact app and market before presentation, with a feed-level guard as defense in depth. The signed-in InnerType/GB feed showed eight GB cards, no portfolio/null-market ASO findings, and preserved app/market scope when filtering to three Discovery cards.

Metadata-version context slice:

> Bind metadata-dependent ASO conclusions to an immutable exact-country listing snapshot and isolate rank evidence to that observed version.

Implementation status on 2026-07-31: complete in production. Current-metadata keyword rules require exact-country snapshots, rank evidence begins at the observed metadata-version boundary, stored snapshot/version/change provenance is visible in Recommendations, the current US conclusion exposes its immutable evidence, and GB no longer borrows US listing metadata.

Locale-context integrity slice:

> Bind language-dependent public metadata and ASO conclusions to an explicit App Store locale, and represent unavailable locale evidence as Unknown.

Implementation status on 2026-07-31: complete in production. Metadata snapshots, detected changes, tracked keywords, and persisted ASO conclusions now support exact locale context without inferring it from storefront country or Apple's app-wide supported-language list. Language-dependent rules require exact app, country, and locale matches. Current US and GB evidence correctly remains Unknown, the unsupported country-only US conclusion is preserved as superseded history, and a successful production collection did not recreate it.

Recommendation-identity integrity slice:

> Give ASO, Discovery, and Apple Ads conclusions one stable normalized identity contract while keeping changing evidence and stored lifecycle row IDs separate.

Implementation status on 2026-07-31: complete in production. Discovery no longer depends on array position, Apple Ads no longer treats an advancing evidence window as a new conclusion, rule/window provenance remains in the evidence fingerprint, and the combined feed exposes stable identities for signed-in acceptance. The first owner recompute performed the expected one-time legacy transition; the second returned five unchanged Apple Ads conclusions with no insert or refresh, and all six current InnerType/GB feed-card identities remained stable across reload.

Acceptance:

- Exclude `lovense`.
- Exclude `lovense remote`.
- Exclude `y not`.
- Pause or review broad `relationship test` while that broad target is active; do not repeat the recommendation after it is paused.
- Continue learning on `personality test`.
- State that fewer than 20 relevant taps are insufficient to judge store conversion; the current evidence has five taps.
- Include explicit InnerType/GB/window/source/freshness evidence.
- Perform no Apple Ads write.

Milestone exit:

- corrected rules have fixtures and regression tests;
- current live evidence yields the expected assessment;
- App Store Connect incomplete/partial data is honest;
- every conclusion exposes scope and sufficiency;
- no known inaccurate recommendation is presented as actionable.

Milestone status on 2026-07-31: complete in production. All corrected rules have regression coverage, the current InnerType/GB evidence is scoped and explicit, Discovery incomplete-window behavior is honest, GB localization remains Unknown without exact-country evidence, recommendation identities are stable, production source parity is recorded, anonymous access redirects to login, and signed-in owner access passed. Production contains no non-member auth account, so the signed-in unauthorized path was verified through fail-closed deterministic tests without creating a disposable production identity.

### 2. Today Page — ACTIVE

Goal: make the default page answer what changed and what to do next.

Deliver:

- current app/market/period/metadata context;
- material changes since last visit;
- blockers only when current and actionable;
- at most three prioritized actions;
- observation, diagnosis, action, confidence, evidence and review condition;
- recent rank, market, search-term and Change Log movement;
- collapsed healthy integration status.

Exit: the owner can understand the current situation without opening another product.

### 3. Rankings — PLANNED

Goal: replace AppFollow for understanding organic movement.

Deliver:

- one scoped keyword table with current, 1d, 7d, 28d, best and rank bucket;
- winners, losers, unranked and Top 10/25/50/100 summaries;
- trend history, metadata presence, competitors, ads evidence and Change Log annotations;
- saved views and scalable pagination/virtualization;
- explicit freshness.

Merge `/keywords` and `/rankings`; retain old routes until verified.

### 4. Metadata Change Monitoring — PLANNED

Goal: make Changes a measurement system.

Deliver:

- automatic before 14-day, indexing day 0–7 and after day 8–28 windows;
- rank/indexation, impressions, page views, downloads and conversion comparison;
- chart annotations;
- overlap warnings instead of causal claims;
- automatic review dates and outcome state.

Merge Change Log records with detected metadata events at the product layer.

### 5. Markets — PLANNED

Goal: provide one trustworthy international strategy view.

Deliver:

- market visibility and rank buckets;
- verified localization layers;
- tracked keywords, ASC availability and Apple Ads state;
- directional demand only when provenance is clear;
- one recommendation per market where evidence supports it.

Merge `/localizations`, ASO market summaries and ASC storefront views.

### 6. Apple Ads Decision Workspace — PLANNED

Goal: lead with campaign diagnosis, not structure.

Deliver:

- delivery, relevance, sample sufficiency and spend-risk summary;
- search-term relevance/action table;
- exact/broad/Search Match diagnosis;
- paid-to-organic opportunities;
- technical setup/sync detail only on error or under Settings.

Merge Apple Ads overview, structure, reporting and keyword-intelligence pages. Keep read-only behavior.

### 7. Recommendations — PLANNED

Goal: create one prioritized cross-source action feed.

Deliver:

- observation, diagnosis, action, confidence, evidence and review condition;
- common dedupe and lifecycle across ASO, Discovery and Apple Ads;
- New, Accepted, Rejected, Snoozed, Completed, Inconclusive and Superseded states;
- capacity/character/scope/sample guardrails;
- maximum three actions on Today.

### 8. Technical Consolidation — PLANNED

Goal: move administration out of the decision workflow.

Deliver Settings sections for Apps, Data Sources, Jobs, Health and Integrations. Provide one user-facing refresh action. Keep granular sync controls and raw history under Settings. Redirect/remove compatibility routes only after signed-in acceptance and rollback confirmation.

### 9. Attribution Reassessment — DEFERRED

Do not begin automatically.

Create `ATTRIBUTION_READINESS_REVIEW.md` only after Milestone 8. Assess install/attributed volume, app instrumentation, privacy/retention, keyword-level usefulness, decision impact, effort and product value.

The review must also reconcile the existing shared analytics `installs`/Edge Function path with Kopa’s `apple_ads_attribution` endpoint/table and choose one canonical install identity before any app integration continues.

Possible outcomes:

- resume;
- minimal pilot;
- defer again;
- remove from the near-term roadmap.

Until then, preserve schema, endpoint and documentation; keep attribution out of primary navigation and do no further implementation.

## Explicitly outside the active sequence

- Apple Ads write automation.
- Automatic bid or budget changes.
- Campaign creation/activation.
- AI analyst jobs.
- AppFollow import.
- Multi-tenant organizations, billing and onboarding.
- Major visual redesign before data correctness.

## Status update contract

At the end of each implementation slice:

1. verify the real output, not only page rendering;
2. run typecheck, tests and build;
3. update `KOPA_CURRENT_STATE.md`;
4. update this roadmap’s milestone status;
5. record any production/source mismatch;
6. preserve rollback and compatibility paths.
