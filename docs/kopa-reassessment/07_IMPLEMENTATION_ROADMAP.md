# 07 — Incremental implementation roadmap

> **Owner-approved implementation amendment — 15 October 2026.** B · Signal is selected; development work is authorized on `codex/signal-product-analytics`. The earlier Fieldwork recommendation/direction-choice gate below is historical and superseded. Six core destinations now include first-class Product Analytics. Light / Dark / System are mandatory. The canonical implementation is `apps/tools`, behind `KOPA_SIGNAL_UI=1`; fixtures require development plus `KOPA_SIGNAL_FIXTURES=1` and `data=sample`. See [14 OSS feasibility](14_OPEN_SOURCE_FEASIBILITY.md), [15 Product Analytics](15_SIGNAL_PRODUCT_ANALYTICS_SPEC.md) and [Signal verification](SIGNAL_VERIFICATION.md). Production cutover still requires source parity, restore evidence and owner task acceptance; no costly or destructive action is authorized by this amendment.


Date: 2026-10-14. **Development implementation is authorized; production writes, costly services and live operations remain separately gated.** Dependencies and acceptance criteria are gates, not a checklist to declare complete from a build.

## UX priority amendment — 14–15 October 2026

The owner accepted selective rebuilding and made analytical UX a release-level requirement. **UX0 and UX1 direction review are complete; Signal development is underway.** The original isolated prototype remains an archived direction reference; Signal visual direction is approved; owner task acceptance remains pending. The Next development UI is implemented behind a flag. No live backend migration or production deployment occurred.

1. **UX0:** inspect actual Kopa workflows and public AppFollow/AppTweak patterns; distinguish observed from documented behavior. See [10 UX review](10_UX_REVIEW.md).
2. **UX1 complete:** Signal selected from the two-direction review; build its dense watchlist/chart and comparison workflow. See [11 Design system](11_UX_DESIGN_SYSTEM.md) and [12 Screen specification](12_UX_SCREEN_SPEC.md).
3. **Direction gate complete:** the owner approved Signal and development implementation. Owner operating acceptance is still required before production cutover.
4. **UX2:** implement the accepted system incrementally in the existing frontend, aligned with M0–M5 source gates below. First real-data vertical slice: Keywords using a validated rank provider, immutable identities and recoverable import. Bring M5's identity/source prerequisites forward; cadence validation continues after the first slice. Migrate Overview with M3 and Ads with M4. Keep legacy paths through parity.
5. **UX3:** conduct the owner task comparison against AppFollow/Apple, measuring time, page hops, scope loss and interpretation errors. Refine before legacy retirement. See [13 Implementation plan](13_UX_IMPLEMENTATION_PLAN.md).

## Sequence and time assumptions

Preserve the current app while validating one source at a time. Design contracts and source validation may proceed together after the design gate and separate implementation authorization. The earlier 3–5-day first-slice and 20–30-day broader V1 planning estimates do not include the expanded design, library spike and owner comparison scope and are superseded pending those gates. Re-estimate per accepted vertical slice after source/access trials. A 14-day rank/provider and owner operating pilot still supplies evidence, not a delivery promise.

### M0 — Preserve evidence and establish a safe release baseline

Dependencies: owner authorization for the implementation phase and a safe database copy; no new subscription required.

Work: export schema/migration versions and important counts; take a verified backup; inventory active deployments/writers/cron; patch dependency advisories after exposure assessment; add working ESLint config and CI. Add non-destructive legacy method labels and avoid future destructive query edits/deletes. Do not run broad cleanup migrations against populated production tables.

Acceptance:

- Restore backup into a separate database and reconcile key counts/checksums; record procedure.
- Confirm deployed commits and environment/role names without exposing values.
- Existing tests/typecheck/build plus lint pass; dependency risks are remediated or explicitly bounded with release rationale.
- Authentication tests cover anonymous, valid non-admin, valid owner and membership-query failure through actual handlers/pages; source-role tests prevent unauthenticated reads.
- Existing observations, experiments, mappings and unrelated public content remain intact.

Risk: shared database/service-role blast radius. Stop migration work if restoration or table ownership is unclear.

### M1 — Prove sources and decide whether to buy the workflow

Dependencies: real app/storefront priorities, read-only Apple access, capped rank-provider trial permission and budget. First investigate any existing AppFollow/Appfigures entitlements.

Work: obtain a known non-empty organic-rank sample; measure billing unit, observation/missingness contract and permissions; test current Apple Platform API account/ACL/report shapes without writes; inspect ASC active report requests/history. Compare an existing vendor + Apple console weekly workflow against custom need.

Acceptance:

- App Store, bundle, ASC, Ads account/promoted-object and internal app mappings confirmed for each pilot app.
- Provider sample has timestamp, market/device/locale, source method, organic definition and distinct absent/failed states; pagination and storage/AI rights documented.
- Monthly credit/cost worksheet approved with a hard cap; no automatic overage.
- Apple report samples include correct native timezone/currency/claim metrics; account-specific constraints recorded.
- If data is unavailable or existing vendor workflow suffices, narrow or stop custom rank/UI work. Empty HTTP 200 is not success.

Risk: provider availability and entitlement. Deliverable may be a clear no-go for a particular source rather than invented data.

### M2 — Build one recoverable import path

Dependencies: M0; one confirmed source contract from M1.

Work: small Postgres task/attempt/lease model; private raw staging; typed validator/parser; source partition manifest; atomic publishing; per-source deadlines/retries and health queries. Reuse current job concepts without a generic orchestration framework.

Acceptance:

- Duplicate enqueue, overlapping worker, retry after crash and lease expiration do not duplicate canonical facts.
- Crash before/after publish leaves either the previous complete partition or the new complete partition, never partial totals.
- Unexpected schema, wrong ID/currency/date, 429, timeout, missing page/segment and valid zero produce distinct recorded outcomes.
- Replay the same retained source artifact without network calls and obtain identical normalized output/version.
- Credit/request budgets and secrets redaction tested at the adapter boundary.

Risk: exactly-once delivery cannot be assumed; use at-least-once tasks with idempotent publishing.

### M3 — Correct ASC acquisition and money semantics

Dependencies: M2, reader permissions, Admin-assisted report provisioning only if needed and separately authorized.

Work: correct newest-instance-per-date selection; paginate all reports/instances/segments; rebuild Discovery partitions, Downloads, and typed Sales measures. Start one app/market then extend. Keep old tables as evidence; migrate reads with a reversible flag.

Acceptance:

- An overlapping old/new instance produces only the newest complete date counts; all segments of that instance included.
- A newer complete partition that removes a category does not leave its old rows behind.
- Three units × per-unit proceeds, refunds, updates, redownloads, IAP parent mapping and mixed currencies reconcile with a known official report/export.
- Standard/Detailed privacy and counts/unique counts remain distinct; event date differs from processing/import dates.
- One full comparable 7-day baseline exists where source history permits; longer missing history is disclosed.
- Legacy vs corrected discrepancies are explained by date/source; no “match” obtained by arbitrary adjustment.

Risk: unrecoverable historical raw data. Mark affected intervals and start clean collection rather than inventing repair factors.

### M4 — Replace Ads transport and daily reporting contracts

Dependencies: M1/M2, approved read-only adAccount IDs. It can proceed independently of rank procurement once access is proven.

Work: separate Platform v1 adapter; campaign/group/keyword/ad/search-term reporting as required by actual workflows; country grouping; ORTZ/native timezone preservation; tap/view/total measures; complete pagination and rolling revised-window imports. Read-only change-history intake adds annotations.

Acceptance:

- Reconcile a fixed complete account/campaign/day slice against Apple export with identical timezone/currency/definitions.
- A multi-country campaign never duplicates `all` spend into each country; no country allocation without source dimensions.
- A range total remains a range; genuine daily facts and period facts cannot share a key.
- Re-import and concurrent imports are duplicate-free under database constraints.
- Suppressed/low-volume search terms and unreturned pages are surfaced as coverage limits; keyword/term sums need not equal campaign totals and that is explained.
- Older v5 and new v1 IDs/envelopes are mapped deliberately; no API URL switch reuses the old parser.
- No campaign writer, recommendation apply/dismiss or metadata writer is callable.

Risk: account eligibility or changed report fields. Keep a read-only manual official-export fallback for a defined window; do not pretend it is automated.

### M5 — Add trustworthy rank observations and small competitor monitoring

Dependencies: a permitted native or licensed source passes M1; M2. If no permitted source passes validation, explicitly defer this slice and label V1 as lacking automated organic ranks.

Work: immutable query identities and tracking membership; append-only observations + daily projection; import/export; scoped competitors and metadata annotations. Keep historical iTunes series visibly separate.

Acceptance:

- 90-series planning pilot or a smaller approved scope has its promised cadence, expected/collected coverage and source budget.
- Native-session validation panel runs for 14 days with deviations explained by context/method; do not require universal equality or fabricate an accuracy score.
- Not-found/depth, failed, stale and never-observed states persist through DB, chart, export and AI query.
- Archiving/editing a term preserves all original series and shared-app memberships.
- Capped pagination no longer hides a missing latest observation; current view uses a complete per-query projection.
- Competitor metadata snapshots preserve market/locale and do not imply full keyword-universe coverage.

Risk: licensed rank remains method-dependent and may not cover every locale/device. Show actual supported scope.

### M6 — Complete the accepted owner decision loop

Dependencies: at least ASC and Ads sources relevant to the owner's active apps; rank slice if it passed the source gate. Product Analytics is now a core parallel slice; acquisition can still ship independently when its sources pass.

Work: complete the UX1-approved Overview, Keywords and Apple Ads interactions through UX2 vertical slices; connect the experiment journal and Sources. Reuse stable identities and trustworthy backend infrastructure. Replace confusing presentation patterns with the approved shared design system and chart grammar. M6 is integration/parity, not the start of UX work. Add only a small number of validated deterministic triggers.

Acceptance:

- User can complete: inspect app → identify issue/opportunity or insufficient evidence → open source detail → record hypothesis/decision → revisit its measured result.
- Portfolio comparison uses latest common complete dates, not truncated arrays; currencies and attribution definitions are visible.
- Experiments save criteria before evaluation and separate controlled vs observational designs; multi-source rows never count as distinct days.
- Exports contain full selected scope, half-open timestamp bounds, source definitions and coverage manifest; current and historical metadata are labeled correctly.
- Mobile/narrow desktop layout, keyboard navigation, loading/error/empty states and actual authenticated data are checked. Build alone is insufficient.

Risk: returning to feature sprawl. Cut screens or metrics that do not answer one of the owner's seven questions.

### M7 — Read-only AI and scheduled operations

Dependencies: stable query functions/evidence IDs and tested source quality. Keep all AI source permissions read-only.

Work: documented REST query endpoints; thin typed MCP tools; daily imports; weekly deterministic digest with optional AI explanation; event-driven actionable alerts. Scheduler belongs to Kopa's deployed job system; this audit creates no Codex reminder or automation.

Acceptance:

- Agent can answer each brief example from evidence or explicitly state missing data, with reproducible figures and exact periods.
- Machine credential cannot mutate DB facts, credentials, campaigns, recommendations or metadata, even if a client invents a tool/HTTP request.
- Malicious text in a review/metadata field cannot change tool/account scope or trigger external operations.
- Pagination/row limits, source latency and unavailable data are present in machine responses; no unrestricted SQL.
- Daily ingestion repairs failed scopes; weekly report excludes incomplete comparisons; unchanged/non-actionable states produce no repeated alerts.
- Alert channel/destination is explicitly chosen by the owner before delivery is enabled. A local report is acceptable until then.

Risk: confident explanations from unreliable inputs. Block recommendations at the query quality layer, not only in a prompt.

## V1 definition

A usable V1 is a two-week operating cycle with real owned-app data and recorded decisions, not eight new dashboards:

1. One reliable daily import loop for each enabled source with recovery and coverage.
2. Per-app/market acquisition facts plus spend/CPA where campaigns exist, with source-aligned definitions.
3. A small observed keyword watchlist if a permitted affordable provider passed validation; otherwise an explicit gap and manual/imported evidence, never mislabeled iTunes rank.
4. A real experiment/change record with baseline, criterion, result/unknown and next action.
5. One weekly brief with at most a few supported priorities and links to evidence.
6. Read-only machine access sufficient to inspect the same facts.
7. Restore/rollback evidence, no unexpected historical loss, and no external write capability.

**V1 acceptance must name missing optional integrations.** “No active campaigns,” “no subscriptions,” and “no usable rank source” are legitimate states; do not seed demo performance to make the product appear complete.

## Later only when justified

Verified RevenueCat outcomes and attributed value; more markets/keywords; CPP/PPO result integration after exact metrics are verified; richer localization drafts; approved Ads/metadata proposal/execution system. Each future writer requires immutable approval previews, scope/spend caps, revalidation, auditability and uncertain-outcome reconciliation described in document 06. An autonomous budget optimizer is not a V1 milestone.

## Migration exit criteria

Retire legacy writers/console only after authoritative source parity, UX3 owner task acceptance, owner pilot, restore test and reversible cutover. Keep original history and a method map. Remove old schedulers after the new scheduler is observed healthy, with no duplicate collection. No public-site content changes are required for the internal platform.

## Authorized Signal execution sequence — current

1. **S0 complete for review:** actual Next six-area navigation, themes, interactive keyword/Ads/Overview, fixture Product Analytics, scoped export/API and dependency hardening.
2. **S1 evidence gathered:** six OSS candidates inspected in code; limited real event metadata audit. No claim of native rank or identity stability.
3. **S2 next integrity gate:** safe backup/restore and deployed-writer inventory; source app mappings, stable event IDs/schema, complete partitions. This remains incomplete, so a production importer must not be enabled yet.
4. **S3 first live slices:** one confirmed rank observation contract; one complete ASC/Ads partition; one verified InnerType funnel/cohort. Reconcile before enabling each Signal read behind the flag. Preserve old facts/method IDs and rolling source revisions.
5. **S4 owner operating acceptance:** same-size light/dark laptop review and AppFollow history tasks, then reversible cutover only after history/restore/auth checks. No deployment occurred here.

Product Analytics journeys, funnels, retention/cohorts and events are V1 workflows, not optional later dashboard cards. Verified monetization depends on transaction/entitlement reconciliation. A full PostHog clone, arbitrary AI SQL, replay and autonomous operations are outside this scope.
