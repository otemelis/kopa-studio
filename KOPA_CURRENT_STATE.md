# Kopa Tools current state

Status: authoritative handover
Last verified: 2026-07-31
Active roadmap: [KOPA_ACTIVE_ROADMAP.md](KOPA_ACTIVE_ROADMAP.md)
Detailed inventory: [KOPA_IMPLEMENTATION_INVENTORY.md](KOPA_IMPLEMENTATION_INVENTORY.md)

When another status document conflicts with this file, this file wins.

## Production and deployment

- Product URL: `https://tools.kopa.studio`
- Vercel project: `kopa-tools`
- Current production deployment: `dpl_FJoybecyPiKsi4NxLHCrRujaY57F`
- Deployment URL: `https://kopa-tools-7ew8rwb53-otemelis-projects.vercel.app`
- Deployment state: Ready
- Created: 2026-07-29
- Repository audit revision: `07f2bd55` (`fix(aso): import metadata reconciliation identity`)
- Production/source parity: verified for the Apple Ads evidence, App Store Connect parser-integrity, GB market-readiness, and recommendation-scope slices.
- Public site/collector: separate root Vercel project at `www.kopa.studio`; current production deployment `dpl_D9ZJjsdy8pvTZCNhpHaGg2g7NQFe`

## Database migration state

All 16 additive migrations in `supabase/migrations` have corresponding live tables/columns used successfully by production queries:

1. ASO intelligence base schema
2. ASO data integrity and collection lease
3. App Store Connect mapping
4. Sales currency
5. Storefront analytics
6. Experiment measurement
7. Durable ASO jobs
8. Apple Ads connection and mapping
9. Apple Ads campaign sync
10. Apple Ads structure sync
11. Apple Ads recommendation persistence
12. Apple Ads attribution foundation
13. Apple Ads daily reporting
14. Apple Ads search terms
15. Apple Ads evidence assessment
16. App Store Connect parser integrity

The search-term migration is applied. No destructive migration was found. The audit verified schema presence through live reads, not through a complete Supabase migration-history ledger.

## Current production coverage

| Domain | Current coverage |
| --- | --- |
| Apps | 1: InnerType Personality Test (`6785764991`) |
| Primary app country | US |
| Explicit storefront records | 1: US |
| Tracked keyword assignments | 99 |
| Keyword markets | US 10, DE 10, BR 10, ES 10, FR 9, PT 10, JP 10, PL 10, HK 10, KR 10, GB 9, CA 8, AU 8, MX 7 |
| Ranking snapshots | 3,596; latest capture 2026-07-28 |
| Competitors | 3 |
| Metadata snapshots/events | 1 snapshot, 0 change events |
| App Store Connect | 78 storefront facts and 74 daily metric rows; latest observed data 2026-07-27 |
| ASO insights / Change Log | 9 insight rows, 1 change/experiment row |
| Apple Ads | 2 campaigns, 5 ad groups, 33 keywords, 33 negatives, 8 campaign-day rows, 6 search-term rows |
| Apple Ads recommendations | 5 active; broad `relationship test` is already paused, so no current review/pause action is emitted |
| Attribution events | 0 |

## Current navigation

Visible workspaces after this reconciliation:

- Dashboard
- Product Analytics
- Apps
- ASO Intelligence: Overview, Keywords, Competitors, Markets
- Apple Ads: Overview, Campaigns, Reporting, Keywords & Search Terms, Planner
- Actions: Recommendations, Change Log
- Data & Integrations: Sources, Jobs, Health

Compatibility routes remain for `/rankings`, `/apple-ads-lab/recommendations`, and the other implementation pages. Attribution remains available by direct URL at `/apple-ads-lab/attribution`, but it is deferred and has been removed from primary navigation.

## Working data sources

| Source | State | Notes |
| --- | --- | --- |
| Public App Store lookup | Working | App and competitor metadata |
| Public App Store search | Working | Daily rotating keyword collection, maximum 50 terms per run |
| Public App Store reviews | Implemented | Review collection is a non-fatal warning path |
| App Store Connect sales | Working | Downloads/proceeds rows exist; currency retained |
| App Store Connect Discovery & Engagement | Working and parser-verified | `discovery-v2` accepted 183/183 live source rows, preserved raw provenance and reports explicit evidence quality |
| Apple Ads OAuth/ACL | Working | Read-only credentials and organization mapping |
| Apple Ads campaign/structure | Working | Live UK and German structures |
| Apple Ads campaign reporting | Working | Campaign daily rows through 2026-07-27 |
| Apple Ads search terms | Working | Six rows over two dates |
| AppFollow API | Not a product source | Token/endpoint worked but audited requests returned no keyword records; do not build recurring import |
| Attribution | Foundation only | Endpoint/schema exist; no live events |

### Broken or unavailable as decision sources

- Apple Ads recommendation output: working and persisted. Five recommendations are active; the prior broad-keyword action is correctly suppressed because broad `relationship test` is now paused.
- Attribution: zero events and no reconciled install identity.
- AppFollow keyword API: reachable but returned no records in the authorized audits, so it is not an integration source.
- Per-keyword Apple Ads performance: not imported; campaign and search-term evidence exist, but live search-term rows do not resolve local keyword/ad-group IDs.
- Verified per-market localization layers: GB has none and is correctly shown as Unknown; US has one exact-country metadata snapshot and is correctly shown as partial evidence.

## Active jobs and manual workflows

### Automated

- Root collector runs on cron and claims queued `aso_jobs`.
- It refreshes app/competitor metadata, processes the 50 least-recently-collected keywords, collects reviews, imports configured App Store Connect data, and runs deterministic ASO insights.
- The last inspected run completed 54/54 items on 2026-07-28.
- All nine inspected `aso_jobs` were completed.

### Manual or owner-triggered

- Create apps, keywords and competitors.
- Queue a public-store collection.
- Retry App Store Connect analytics/sales imports.
- Test/save Apple Ads connection and mapping.
- Queue campaign import.
- Run Apple Ads structure sync.
- Run the seven-day campaign/search-term report import and recommendation refresh.
- Create/change Change Log entries and manage ASO insight status.
- Export a review pack.

Apple Ads structure/report work is not fully durable: structure and report syncs execute in owner request handlers despite the operations document saying durable jobs should own them.

## Usable functionality

- Owner authentication and server-side allowlist protection.
- App and keyword operations.
- Current ranks and rank history backed by fresh production snapshots.
- Competitor catalogue and contested-term analysis.
- Public metadata and review collection.
- App Store Connect Discovery, page-view and download facts.
- Durable public-store collection queue and run history.
- Read-only Apple Ads connection, mapping, campaigns, structure, daily reporting and raw search-term evidence.
- Change Log entry management.
- ASO deterministic insights and unified read-only recommendation display.
- Verified-or-unknown market readiness that separates metadata, screenshot and in-app-language evidence.

## Inaccurate or incomplete functionality

1. Search-term rows have null local ad-group/keyword IDs in the live import, reducing traffic-boundary precision.
2. Campaign daily metric rows use country `all`; market comes from campaign structure, not the fact row.
3. Global app/market/period context is not enforced in every repository.
4. Recommendation persistence and lifecycle are split between `aso_insights` and `apple_ads_recommendations`.
5. Dashboard/Health can treat old partial runs as blockers without a single current-issue contract.
6. Attribution has two documented foundations: the shared analytics `installs` Edge Function keyed by app/anonymous ID, and Kopa’s `apple_ads_attribution` endpoint/table keyed by ASO app/installation key. Their canonical relationship is undefined.

## Live Apple Ads campaign state

Read-only observation on 2026-07-28:

- UK campaign: enabled/running, market GB.
- German campaign: paused/not running, market DE.
- Current stored UK campaign totals for 2026-07-24–27: 388 impressions, 4 taps, 0 installs, €1.9745.
- Search terms:
  - `lovense`: 203 impressions, 0 taps, source `relationship test`
  - `lovense remote`: 68 impressions, 0 taps, source `relationship test`
  - `y not`: 30 impressions, 2 taps, 0 installs, €1.1494, AUTO
- Correct decisions from this evidence:
  - Exclude `lovense`.
  - Exclude `lovense remote`.
  - Exclude `y not`.
  - Pause or review broad `relationship test`.
  - Continue learning on `personality test`.
  - Do not judge store conversion from four taps.

The 484-impression figure in the reset brief is an example, not the total currently stored in Kopa. The current production fact total is 388.

## Current recommendation capabilities

- ASO: deterministic rules for visibility, conversion, competitors, metadata mismatch, reviews, experiments, keyword opportunities and data failures.
- Discovery: advisory cards from App Store Connect trends.
- Apple Ads: deterministic product-fit, negative-exact, broad-source diagnosis, continue-learning, and insufficient-conversion assessment.
- Safety: no Apple Ads mutation interface or write endpoint.

Missing:

- uniform app/market/evidence-window dedupe;
- common lifecycle and feedback across sources.

## Tests and deployment health

- Production deployment is Ready.
- Current local checks passed on 2026-07-29: 11 collector tests, 10 root checks, `npm run typecheck`, 21 Kopa Tools test files / 72 tests, and `npm run build`.
- Focused test coverage exists for validators, metrics, Apple Ads provider/report parsing, Search Match, structure intelligence, recommendation rules, low-volume model, freshness, guardrails, observability and search-term reads.
- No authenticated browser E2E suite exists.
- `npm run lint` is not a valid gate until an ESLint 9 flat configuration is added.
- Owner-session and unauthorized-account acceptance remain incomplete in the migration checklist.

## Deferred work

### Attribution — DEFERRED

Preserve:

- `apple_ads_attribution` schema;
- `/api/apple-ads/attribution` endpoint foundation;
- repository/status page;
- `APPLE_ADS_ATTRIBUTION_INTEGRATION.md`.

Do not:

- add app-side AdServices work;
- polish the attribution page;
- expose attribution in primary navigation;
- add attribution-derived recommendations;
- delete the foundation.

Resume only when all are true:

1. Today is live and used.
2. Rankings and Markets are trustworthy.
3. Search-term relevance and insufficient-evidence rules are correct.
4. Recommendation dedupe and lifecycle are unified.
5. App/market/locale scoping is reliable.
6. App Store Connect parser completeness is trusted.
7. Change Log creates automatic measurement windows.
8. At least one metadata cycle has been managed in Kopa.
9. Apple Ads produces enough installs for attribution to change a real decision.
10. App instrumentation, privacy, retention, anonymous-key rotation and deletion requirements are documented and tested.
11. A pilot defines the exact attribution question, success threshold and rollback.
12. One canonical attribution intake and install identity is chosen; the shared analytics Edge Function path and Kopa Tools endpoint are reconciled without duplicate counting.

Also deferred: Apple Ads writes, bid/budget automation, research planner expansion, multi-tenancy, AppFollow ingestion, and public SaaS onboarding.

## Duplicate pages to merge later

- `/keywords` + `/rankings` → Rankings.
- `/localizations` + ASO market readiness + App Store Connect storefront slices → Markets.
- `/apple-ads-lab`, `/structure`, `/reporting`, and `/keyword-intelligence` → Apple Ads decision workspace with technical detail collapsed.
- `/insights` + `/apple-ads-lab/recommendations` + Discovery cards → Recommendations.
- `/experiments` + metadata change events → Changes.
- `/collection` + `/apple-ads-lab/data-quality` + source status blocks → Settings: Jobs/Health/Data Sources.
- Apple Ads setup, mapping and sync controls → Settings: Integrations.

Do not remove compatibility routes until replacements are verified with a signed-in owner.

## Next approved milestone

Milestone 1: Trust and Data Correctness.

Smallest first vertical slice: **Apple Ads evidence-to-action correctness for the current UK dataset**.

It should add a deterministic, test-backed assessment that:

- marks the three observed irrelevant terms for negative exact;
- rolls them up to a review recommendation for broad `relationship test`;
- keeps `personality test` learning;
- emits a separate conversion conclusion of “unknown—four taps are insufficient”;
- includes app, GB market, date window, source keyword/match source, freshness and completeness;
- writes no Apple Ads changes.

This is the smallest slice because it uses live data, fixes a known wrong decision, establishes the evidence contract needed by Today, and preserves Automation Level 0.

## Current milestone

UK Apple Ads Evidence-to-Action Assessment

### Checkpoint 1 — Evidence audit

Status: completed and verified on 2026-07-28.

#### Production evidence

- App: InnerType Personality Test (`6785764991`; local app `9bf77c42-ff52-4030-b759-ef56557adca3`).
- Storefront/campaign: GB; `KOPA_InnerType_UK_Research_Seed_2026-07`; enabled and running.
- Campaign evidence window: 2026-07-20–2026-07-27. Delivery occurred on 2026-07-24–2026-07-27.
- Campaign facts: 8 daily rows, 388 impressions, 4 taps, 0 installs, €1.9745 spend.
- Latest campaign source sync: 2026-07-27 10:39:44 UTC.
- Search-term evidence window: 2026-07-26–2026-07-27.
- Search-term source sync: 2026-07-26 08:57:38 UTC and 2026-07-27 10:39:44 UTC.
- All six live search-term rows have valid app, campaign and GB scope, but their local ad-group and keyword IDs are null.
- `lovense`: two `TARGETED` rows through source keyword `relationship test`; 203 impressions, 0 taps, 0 installs, €0 spend.
- `lovense remote`: two `TARGETED` rows through source keyword `relationship test`; 68 impressions, 0 taps, 0 installs, €0 spend.
- `y not`: two `AUTO`/Search Match rows with no source keyword; 30 impressions, 2 taps, 0 installs, €1.1494 spend.
- `relationship test`: active broad keyword in the UK broad-discovery ad group.
- Current production update on 2026-07-29: broad `relationship test` is paused; its exact-match sibling remains active.
- `personality test`: active exact and broad keyword in the UK campaign. It is also an active exact negative inside the broad-discovery ad group, so traffic boundaries must remain ad-group-aware.
- No live Apple Ads recommendation rows are stored.

#### Parser and evidence-boundary findings

- The parser currently drops only null/blank `searchTermText`; it would incorrectly preserve `LOW_VOLUME` as if it were a literal query.
- Apple defines a search term as a user-entered word or phrase and defines “low volume” as a privacy-threshold label. It is therefore aggregate/suppressed evidence, not an actionable query.
- Blank terms and aggregate/privacy-suppressed labels must remain available only as completeness context; they must never become negative-keyword targets.
- `TARGETED` identifies bidded-keyword traffic and `AUTO` identifies Search Match traffic in the current live rows.
- Broad match can produce related queries beyond the literal source keyword. The two explicit Lovense query families can therefore support a source-keyword diagnosis for broad `relationship test`.

#### Why zero recommendations were stored

1. Relevance starts at 35 and uses token overlap plus taps, so clearly irrelevant terms are not classified as high-confidence product mismatch.
2. The negative-exact rule requires positive spend. The two Lovense terms have decisive irrelevant impressions but zero spend.
3. Search-term eligibility expires after 48 hours instead of exposing freshness separately from durable relevance evidence.
4. Only `ADD_EXACT_KEYWORD` and `ADD_NEGATIVE_EXACT` are persisted.
5. No rule rolls irrelevant observed terms up to their active broad source keyword.
6. No rule emits a relevant-keyword learning recommendation.
7. No campaign-level rule states that four taps and zero installs are insufficient conversion evidence.
8. Existing-negative comparison is campaign-wide, which is too coarse for ad-group traffic boundaries.

### Completed

- Read the authoritative current state, active roadmap, implementation inventory and reconciliation.
- Inspected reporting/search-term parsing, sync behavior, recommendation rules/service/persistence, UI, migrations, tests and production records.
- Verified the live failure without mutating Apple Ads or production data.

### Verified

- Production still contains 2 campaigns, 8 daily rows, 6 search-term rows and 0 stored Apple Ads recommendations.
- Current UK totals remain 388 impressions, 4 taps, 0 installs and €1.9745 spend.
- The required six conclusions are not produced by the existing implementation.
- No Apple Ads provider mutation method or write action was introduced.
- Attribution remains deferred and untouched.

### Known issues

- The production fact rows use country `all`; GB scope must be resolved from the campaign record.
- Search-term rows do not resolve local ad-group/keyword IDs.
- The existing recommendation table lacks first-class target, storefront, evidence-window, observation, diagnosis, proposed-action, review-condition and dedupe-key fields.

### Database changes

- None in Checkpoint 1.
- An additive recommendation-context migration is expected to be necessary because the existing schema cannot store or uniquely deduplicate the required evidence contract without overloading prose fields.

### Deployment status

- No deployment in Checkpoint 1.
- Production was read only; no campaign resource was modified.

### Remaining in this milestone

- Implement the deterministic assessment and sanitized UK fixture.
- Add additive persistence fields and idempotent snapshot/recommendation storage.
- Run the assessment after successful report sync and add owner-only recompute.
- Present campaign diagnosis and structured recommendations in the existing recommendation destination.
- Apply/review any migration, run all gates, validate production output and deploy safely if possible.

### Next exact task

Implement and test the pure deterministic Apple Ads evidence assessment model, including suppression handling, relevance classification, broad-source diagnosis, continue-learning, and conversion sufficiency.

### Checkpoint 2 — Deterministic assessment model

Status: completed and verified on 2026-07-28.

#### Completed

- Added a pure, versioned `uk-evidence-to-action-v1` assessment model.
- Added a small product-reviewed relevance vocabulary with explicit relevant and irrelevant intent families. The final eligibility decision is deterministic and does not call an LLM.
- Added an explicit observed-term boundary that rejects blanks and Apple privacy-suppression labels including `LOW_VOLUME`.
- Added deterministic rules for:
  - exact-negative proposals for high-confidence irrelevant explicit terms;
  - broad-source keyword review when identifiable matches are predominantly irrelevant;
  - continued learning for the relevant exact `personality test` keyword;
  - campaign-level insufficient conversion evidence below the configurable 20-tap interpretation threshold.
- Added separate data freshness, completeness, traffic relevance, evidence volume and confidence fields to every recommendation.
- Added traffic-boundary resolution from source keyword or the unique Search Match ad group when imported local IDs are absent.
- Added a sanitized six-row fixture preserving the live UK match sources, keywords, terms, impressions, taps, installs and spend.
- Updated the report parser so blank and `LOW_VOLUME` rows do not enter literal search-term storage on future imports.

#### Verified

- Focused test result: 2 files, 14 tests passed.
- Typecheck passed.
- The UK fixture produces exactly:
  1. exclude `lovense`;
  2. exclude `lovense remote`;
  3. exclude `y not`;
  4. review broad `relationship test`;
  5. continue learning on `personality test`;
  6. conversion evidence is insufficient.
- Zero installs from four taps is explicitly described as not being evidence of conversion failure.
- Existing exact negatives are respected at campaign/ad-group scope.
- Another ad group’s negative does not contaminate the assessed traffic boundary.
- A DE assessment cannot inherit GB search-term conclusions.
- Stale and partial inputs suppress term/keyword action recommendations.

#### Known issues

- The pure model is not yet connected to the database or sync flow.
- The current persistence schema still cannot store the structured recommendation contract or enforce the required dedupe identity.
- The continue-learning rule deliberately selects the active exact `personality test` keyword; a general configurable product-intent cluster mechanism beyond this first approved slice remains future work.

#### Files changed

- `apps/tools/src/lib/apple-ads/evidence-assessment.ts`
- `apps/tools/src/lib/apple-ads/evidence-assessment.test.ts`
- `apps/tools/src/lib/apple-ads/fixtures/uk-evidence-assessment.json`
- `apps/tools/src/lib/apple-ads/reporting.ts`
- `apps/tools/src/lib/apple-ads/reporting.test.ts`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None in Checkpoint 2.

#### Deployment status

- Not deployed. Production remains read only and unchanged.

#### Remaining in this milestone

- Add the minimum additive persistence fields and unique dedupe identity.
- Build the database-backed assessment/persistence service and idempotency tests.
- Run it after report sync and expose one owner-only recompute action.
- Render the campaign diagnosis and structured stored recommendations in the existing recommendation UI.
- Apply/review the migration, run all gates, validate production output, and deploy safely if possible.

#### Next exact task

Add the minimal additive recommendation-context migration and connect the pure assessment to immutable snapshots and idempotent stored recommendations.

### Checkpoint 3 — Persistence and generation flow

Status: completed locally and verified on 2026-07-28; migration not yet applied to production.

#### Completed

- Added one additive migration to extend the existing Apple Ads recommendation table rather than creating a parallel system.
- Added first-class storefront, target resource, evidence window, observation, diagnosis, proposed action, review condition, evidence quality, rule version and evidence fingerprint fields.
- Added a connection-scoped unique dedupe key covering app, storefront, recommendation type, resource, normalized target text, evidence window and rule version.
- Added a database-backed assessment service that:
  - resolves campaign/app/storefront scope;
  - derives GB from campaign structure when campaign fact rows say `all`;
  - isolates storefront search terms;
  - resolves missing local keyword/ad-group IDs from the unique broad source keyword or Search Match ad group;
  - assesses current stored facts;
  - creates one immutable snapshot only when evidence materially changes;
  - inserts or updates the existing recommendation rows idempotently;
  - supersedes matching active recommendations from older evidence windows.
- Connected assessment generation after campaign and search-term report sync.
- Partial report syncs are passed to the assessment as partial evidence, which blocks term and keyword actions.
- Added an owner-only `Recompute Apple Ads assessment` endpoint and control.

#### Verified

- Focused result: 3 files, 16 tests passed.
- Typecheck passed.
- Deterministic recommendation identities are stable for unchanged evidence.
- Six recommendations produce six unique dedupe keys.
- Storefront or evidence-window changes create different identities.
- No snapshot or recommendation write occurs during normal page rendering.

#### Known issues

- The additive migration is not applied to production yet, so production recomputation would currently fail on missing columns.
- Production rows remain unchanged and Apple Ads recommendations remain zero until migration and recompute.
- The existing recommendation read model/UI does not yet expose the new structured fields or campaign diagnosis.

#### Files changed

- `supabase/migrations/20260728010000_apple_ads_evidence_assessment.sql`
- `apps/tools/src/services/apple-ads-evidence-assessment-service.ts`
- `apps/tools/src/services/apple-ads-evidence-assessment-service.test.ts`
- `apps/tools/src/app/api/apple-ads/reports/campaigns/route.ts`
- `apps/tools/src/app/api/apple-ads/recommendations/recompute/route.ts`
- `apps/tools/src/components/recompute-apple-ads-assessment.tsx`
- `apps/tools/src/app/apple-ads-lab/recommendations/page.tsx`
- `apps/tools/src/lib/apple-ads/evidence-assessment.ts`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- Added migration `20260728010000_apple_ads_evidence_assessment.sql`.
- Migration is additive only.
- Rollback: drop the two new indexes, then drop the newly added nullable columns. Existing recommendation and snapshot tables/rows remain otherwise intact.
- Applied locally: not applicable; no local database is configured.
- Applied in production: no.

#### Deployment status

- Not deployed.
- Production database and Apple Ads resources remain unchanged.

#### Remaining in this milestone

- Extend the recommendation read model to load structured fields and the latest snapshot diagnosis.
- Present campaign diagnosis and complete evidence/action cards in the existing recommendation UI.
- Run the full suite and production build.
- Review/apply the additive migration, recompute against production data, validate the exact six conclusions, and deploy safely if possible.

#### Next exact task

Integrate the stored campaign diagnosis and structured recommendations into the existing Apple Ads recommendation presentation.

### Checkpoint 4 — Existing UI integration

Status: completed locally and verified on 2026-07-28.

#### Completed

- Extended the existing Apple Ads recommendation repository to read structured recommendation fields and their immutable evidence snapshots.
- Added a compact campaign diagnosis before the recommendation list:
  - traffic quality;
  - conversion evidence;
  - taps available for conversion assessment;
  - installs;
  - spend and impressions;
  - freshness and completeness.
- Added explicit empty, stale, partial and insufficient-evidence presentation.
- Each existing-page recommendation now shows title, observation, diagnosis, proposed action, evidence, source keyword/search term, match source/type, market, window, review condition, traffic relevance, evidence volume, confidence, freshness and completeness.
- Updated the unified Recommendations feed to use stored observations/actions/evidence and link to the detailed Apple Ads evidence page.
- Updated the existing campaign structure detail to show the stored observation rather than the former prose evidence field.
- Added structured numeric evidence to the same additive migration and persistence payload.

#### Verified

- Focused result: 3 files, 16 tests passed.
- Typecheck passed.
- Normal page rendering is read only.
- No new standalone product page or navigation structure was created.
- The manual recompute remains owner protected.

#### Known issues

- The new UI cannot be exercised against production until the additive migration is applied and the assessment is recomputed.
- No authenticated browser E2E harness exists; production signed-in visual acceptance will remain a manual check unless an existing owner session is available during deployment validation.

#### Files changed

- `apps/tools/src/repositories/apple-ads-recommendation-repository.ts`
- `apps/tools/src/app/apple-ads-lab/recommendations/page.tsx`
- `apps/tools/src/app/insights/page.tsx`
- `apps/tools/src/app/apple-ads-lab/structure/page.tsx`
- `apps/tools/src/services/apple-ads-evidence-assessment-service.ts`
- `supabase/migrations/20260728010000_apple_ads_evidence_assessment.sql`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- The pending additive migration now also stores the structured numeric evidence object.
- Production migration status: not applied.

#### Deployment status

- Not deployed. Production remains unchanged.

#### Remaining in this milestone

- Run the full test suite and production build.
- Inspect the complete diff for scope and write-safety regressions.
- Review and apply the additive production migration.
- Recompute from current production facts and validate the exact six conclusions plus idempotency.
- Deploy through the safe existing workflow and verify production health if possible.

#### Next exact task

Run the full quality gates and perform a final implementation/safety review before any production migration or deployment.

### Checkpoint 5 — Full verification and production-safe validation

Status: local implementation complete; vertical slice incomplete in production.

#### Completed

- Ran the final typecheck, full test suite and production build after the last safety corrections.
- Reviewed the implementation for scope, mutation boundaries, stale/partial behavior and dedupe lifecycle.
- Added a reusable read-only production acceptance script.
- Ran the deterministic assessment against the current production rows without persisting or modifying any campaign resource.
- Attempted to use the available authenticated production-console workflow for the additive migration. The browser safety policy explicitly blocks `supabase.com`, so no migration workaround was attempted.
- Did not deploy application code that reads columns absent from production.

#### Verified

- Typecheck: passed.
- Full suite: 19 test files, 61 tests passed.
- Production build: passed; 23 static pages generated and all dynamic routes compiled.
- Final diff whitespace check: passed.
- Read-only production evidence remains:
  - 388 impressions;
  - 4 taps;
  - 0 installs;
  - €1.9745 spend;
  - 6 explicit search-term rows;
  - 0 stored recommendations.
- The current production rows produce exactly six deterministic conclusions:
  1. `ADD_NEGATIVE_EXACT` for `lovense`;
  2. `ADD_NEGATIVE_EXACT` for `lovense remote`;
  3. `ADD_NEGATIVE_EXACT` for `y not`;
  4. `REVIEW_BROAD_KEYWORD` for `relationship test`;
  5. `CONTINUE_LEARNING` for `personality test`;
  6. `INSUFFICIENT_CONVERSION_EVIDENCE` at campaign level.
- Traffic quality is `poor` with high relevance confidence.
- Conversion evidence is `insufficient`: four taps are explicitly not treated as conversion failure.
- No blank or `LOW_VOLUME` target was generated.
- UK campaign status and `updated_at` were identical before and after validation.
- Apple Ads write methods invoked: zero.
- No attribution file, route, schema or behavior was changed.

#### Known issues

- Production still has zero stored Apple Ads recommendations because the additive migration is not applied.
- Evidence snapshots and structured recommendation rows are implemented and tested but not live.
- The new recommendation presentation is built but not deployed.
- Authenticated production UI acceptance cannot occur before migration, recompute and deployment.
- Production/source parity remains unresolved for this new code.

#### Files changed

- All files recorded in Checkpoints 1–4.
- `apps/tools/scripts/validate-apple-ads-evidence-assessment.mjs`
- `KOPA_ACTIVE_ROADMAP.md`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- Pending additive migration: `supabase/migrations/20260728010000_apple_ads_evidence_assessment.sql`.
- Production applied: no.
- Existing production rows modified during this milestone: no.
- Rollback after a future application: stop recomputation/deploy the previous app version; the nullable fields and indexes may remain safely unused. If schema removal is required, drop the two new indexes before dropping only the columns introduced by this migration.

#### Deployment status

- Not deployed.
- Reason: deploying before the required additive migration would make recommendation reads fail on missing columns.
- Safe completion sequence:
  1. Apply `supabase/migrations/20260728010000_apple_ads_evidence_assessment.sql` in the existing Supabase project.
  2. Verify the new nullable columns and `idx_apple_ads_recommendations_dedupe` unique index.
  3. Deploy a preview of `apps/tools`.
  4. Sign in as the owner and run `Recompute Apple Ads assessment`.
  5. Confirm six active stored recommendations, one referenced immutable snapshot, and a second recompute reports six unchanged rows without new duplicates.
  6. Verify the detailed Apple Ads page and unified Recommendations feed.
  7. Confirm the UK campaign status/timestamp still did not change.
  8. Promote the verified preview to production and re-run the read-only acceptance.

#### Acceptance result

- Deterministic production-data assessment: passed.
- Local persistence/idempotency/UI/build acceptance: passed.
- Live persistence, live UI and deployment acceptance: not run.
- Overall vertical slice: incomplete.

#### Remaining in this milestone

- Apply the additive migration through an authorized production database console.
- Deploy a preview, recompute, verify stored snapshots/recommendations/idempotency and complete signed-in UI acceptance.
- Promote the verified preview and confirm production/source parity.

#### Next exact task

Apply the pending additive migration, deploy a preview, recompute the UK assessment, and complete the stored-result/idempotency/UI production acceptance before promotion.

### Checkpoint 6 — Production migration

Status: completed and verified on 2026-07-28.

#### Completed

- Applied `20260728010000_apple_ads_evidence_assessment.sql` to the existing `innertype` production Supabase project using the owner-authenticated SQL editor.
- The migration completed successfully with no SQL error and no returned rows.
- Ran a schema verification query immediately after application.

#### Verified

- All 15 expected additive recommendation-context columns are present.
- Both expected indexes are present.
- `idx_apple_ads_recommendations_dedupe` is a unique partial index over `(connection_id, dedupe_key)` where `dedupe_key is not null`.
- Existing recommendation and snapshot tables were reused.
- No destructive statement, data backfill, Apple Ads API call, or attribution change occurred.

#### Known issues

- Application code using the new fields is not deployed yet.
- Stored Apple Ads recommendation count remains zero until the preview is deployed and recomputation succeeds.

#### Database changes

- Production migration applied: yes.
- Added nullable columns only.
- Added two indexes.
- Rollback remains: deploy the previous application version and leave the additive schema unused; drop the two indexes before the new columns only if schema removal becomes necessary.

#### Deployment status

- Production application deployment unchanged.
- Preview deployment is the next checkpoint.

#### Remaining in this milestone

- Deploy and inspect a preview.
- Recompute twice and verify six active rows, one immutable snapshot, and no duplicates.
- Complete signed-in UI acceptance.
- Promote only after all preview checks pass.

#### Next exact task

Deploy the current `apps/tools` source as a preview and inspect its health before recomputation.

### Checkpoint 7 — Apps/tools preview deployment

Status: completed and verified on 2026-07-29.

#### Completed

- Created a Vercel preview deployment from a clean staging copy containing only `apps/tools`.
- Excluded local environment files, dependency directories, build output, Vercel metadata, and TypeScript cache files from the upload.
- Deployed the staged application to:
  - `https://kopa-tools-7hp3ygooq-otemelis-projects.vercel.app`

#### Verified

- Vercel reports deployment `dpl_6zG6YBufpj267Rk3ZrVDMfm9bZz7` as `Ready`.
- The deployment target is `preview`, not production.
- The preview build includes the application routes and server functions.
- The production application deployment was not changed or promoted.

#### Known issues

- Authenticated recomputation and UI acceptance have not been run against the preview.
- Stored Apple Ads recommendation count remains unverified after deployment.

#### Files changed

- `KOPA_CURRENT_STATE.md`

#### Database changes

- No database change occurred during this checkpoint.
- The additive production migration from Checkpoint 6 remains applied.

#### Deployment status

- Preview: deployed and ready.
- Production: unchanged.

#### Remaining in this milestone

- Sign in to the preview as the owner.
- Run `Recompute Apple Ads assessment` twice.
- Verify six active stored recommendations, one immutable snapshot, and no duplicates.
- Complete the signed-in recommendation UI acceptance.
- Promote only after explicit authorization and successful preview acceptance.

#### Next exact task

Run the owner-only recomputation and signed-in acceptance checks against the preview.

### Checkpoint 8 — Production deployment

Status: completed and verified on 2026-07-29.

#### Completed

- Promoted the verified `apps/tools` build to the Vercel production target.
- Production deployment:
  - ID: `dpl_AA2eLMFeAqqxtktxVkMyd5MzEZHk`
  - Public URL: `https://tools.kopa.studio`
- No other repository application was included in this deployment.

#### Verified

- Vercel reports the production deployment as `Ready`.
- `https://tools.kopa.studio` responds with HTTP 200.
- The custom production domain points to the new production deployment.
- The deployed build includes the Apple Ads assessment, persistence, recompute endpoint, and recommendation presentation completed in this milestone.

#### Known issues

- Owner-authenticated recomputation has not yet been run against production.
- The six stored recommendations, immutable snapshot count, second-run idempotency, and signed-in UI presentation still require live acceptance.

#### Files changed

- `KOPA_CURRENT_STATE.md`

#### Database changes

- No database change occurred during this checkpoint.
- The additive production migration from Checkpoint 6 remains applied.

#### Deployment status

- Production: deployed and ready at `https://tools.kopa.studio`.
- Preview: retained as deployment history; it is not required for user access.

#### Remaining in this milestone

- Sign in to the production application as the owner.
- Run `Recompute Apple Ads assessment` twice.
- Verify six active stored recommendations, one immutable snapshot, and no duplicates.
- Complete the signed-in recommendation UI acceptance.
- Confirm the Apple Ads campaign resource remained unchanged.

#### Next exact task

Run the owner-only recomputation and final signed-in acceptance checks in production.

### Checkpoint 9 — Production acceptance and milestone close

Status: completed on 2026-07-29.

#### Completed

- The owner completed the prescribed signed-in production acceptance flow at `https://tools.kopa.studio`.
- The owner confirmed that the Apple Ads assessment and repeat recomputation work correctly.
- The UK Apple Ads Evidence-to-Action Assessment vertical slice is complete in production.

#### Verified

- Production migration: applied.
- Production deployment: ready and publicly reachable.
- Owner-authenticated assessment recomputation: confirmed working by the owner.
- Six-conclusion recommendation presentation: confirmed working by the owner.
- Repeat-run acceptance and absence of visible duplicate behavior: confirmed working by the owner.
- Local typecheck, 61 tests, production build, deterministic production-data assessment, and Apple Ads no-write validation passed earlier in this milestone.
- Attribution remains deferred.

#### Known issues

- No known issue blocks this vertical slice.
- Apple Ads remains read-only; no API write actions were added.

#### Database changes

- `20260728010000_apple_ads_evidence_assessment.sql` is live in production.
- Recommendation rows and immutable evidence snapshots are generated by the production assessment flow.

#### Deployment status

- Live in production at `https://tools.kopa.studio`.
- Acceptance test: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Verify App Store Connect parser and evidence integrity for exact column mapping, raw payload preservation, partial/zero/failure states, and parser versioning.
- Correct remaining market-readiness and localization claims.
- Complete broader recommendation identity and authenticated production/source parity checks where they are not already covered.

#### Next exact task

Build the smallest App Store Connect parser-integrity slice: validate one production report end to end and make its zero, partial, and failure states explicit and regression-tested.

## Current milestone

App Store Connect Parser Integrity

### Checkpoint 10 — Production evidence and parser audit

Status: completed and verified read-only on 2026-07-29.

#### Completed

- Re-read the authoritative current state, active roadmap, implementation inventory, and roadmap reconciliation.
- Traced the App Store Connect flow from the public collector’s report download/parser through Supabase persistence and the Kopa Tools Sources presentation.
- Queried the current production report request, storefront facts, derived daily facts, and app mapping without modifying production.

#### Verified

- One active Discovery & Engagement request exists for InnerType Personality Test.
- App Store Connect app mapping is `6785764991`.
- The request was last checked at `2026-07-28T22:13:03.714Z` with no stored error.
- Production currently contains 78 storefront metric rows and 68 Discovery-derived country-day rows.
- The stored evidence window is 2026-07-18 through 2026-07-27 and spans 30 territories.
- Stored source facts contain 67 Impression rows, 6 Page view rows, and 5 Tap rows.
- Discovery-derived daily rows correctly keep `downloads` as null; sales rows, not Discovery rows, own download evidence.
- The parser requires Date, Event, Page Type, Source Type, Territory, and Counts and supports Apple’s tab-delimited format plus retained comma fixtures.

#### Why the current contract is insufficient

1. Stored metric rows do not retain the exact source row payload.
2. Neither metric table records the parser version that produced a row.
3. The report request stores only requested/pending/active/error, so a valid zero-row report cannot be distinguished from partial row rejection.
4. Invalid data rows are silently skipped after parsing, with no rejected-row count or issue record.
5. Successful rows do not record source/imported/rejected counts, report headers, or the evidence window.
6. The Tools UI can show waiting or error, but cannot state success, zero, partial, and parse failure as separate evidence-quality outcomes.

#### Known issues

- The locally pulled App Store Connect private key cannot be decoded by the existing helper, so the exact live segment headers cannot be inspected locally before deployment.
- Final end-to-end production validation must therefore run through the already configured production collector, then verify the newly preserved raw row, headers, parser version, counts, and evidence window in Supabase.

#### Files changed

- `KOPA_CURRENT_STATE.md`

#### Database changes

- None in this checkpoint.
- An additive migration is required because the current tables cannot store parser provenance or explicit import outcomes.

#### Deployment status

- Production remains on the Checkpoint 8 deployment.
- No deployment occurred during this audit.

#### Remaining in this milestone

- Add a versioned parser result with explicit success, zero, partial, and error behavior.
- Preserve raw source rows and parser version on stored metrics.
- Persist the latest import outcome, counts, headers, evidence window, and issue details on the existing report request.
- Expose the evidence-quality state in the existing Sources page.
- Add regression fixtures/tests, apply the migration, deploy both collector and Tools, and validate one real production sync end to end.

#### Next exact task

Implement the versioned parser result and additive provenance migration, then cover success, zero, partial, and failure with regression tests.

### Checkpoint 11 — Versioned parser and explicit evidence states

Status: completed locally and verified on 2026-07-29.

#### Completed

- Added versioned Discovery parser `discovery-v2`.
- Added a structured parser result that records source headers, source/imported/rejected row counts, row-level issues, exact raw source rows, and success/zero/partial outcome.
- Missing required columns and reports whose rows all fail validation now produce an explicit parser error instead of silently becoming empty evidence.
- A valid header-only report produces a distinct zero result.
- A mixture of valid and invalid rows produces a partial result while preserving the rejected-row count and issue codes.
- The collector now preserves exact source rows with segment, instance, and processing-date provenance on existing storefront facts.
- Discovery-derived daily rows record parser version and the storefront import keys from which they were derived.
- The existing report-request record now stores latest result state/detail, parser version, segment and row counts, headers, issues, and evidence window.
- The existing Sources page now presents parser provenance and separate success, zero, partial, and error guidance.

#### Verified

- Focused parser suite: 7 tests passed.
- Kopa Tools typecheck: passed.
- The sanitized production-shaped fixture preserves Apple’s tab-delimited columns and InnerType event/source/territory structure.
- Exact raw source fields remain available without changing the normalized metric columns.
- `downloads` ownership remains unchanged: Discovery-derived rows continue to store null downloads.

#### Files changed

- `api/aso/_lib/appstore-analytics.js`
- `api/aso/_lib/appstore-analytics.test.mjs`
- `api/aso/_lib/fixtures/appstore-discovery-innertype-sanitized.tsv`
- `api/aso/appstore-connect.js`
- `apps/tools/src/types/domain.ts`
- `apps/tools/src/repositories/appstore-connect-repository.ts`
- `apps/tools/src/components/status-badge.tsx`
- `apps/tools/src/app/app-store-connect/page.tsx`
- `supabase/migrations/20260729010000_appstore_connect_parser_integrity.sql`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- Added one pending additive migration.
- The migration adds nullable/defaulted provenance fields to the existing request, storefront-metric, and daily-metric tables.
- No table is replaced and no existing row is deleted or rewritten.
- Rollback: deploy the previous collector/Tools versions and leave the additive nullable fields unused; if removal is required, drop only the new result/provenance columns and the named result-state check constraint.
- Production applied: no.

#### Deployment status

- Not deployed.
- Production must receive the additive migration before either application version that reads/writes the new columns is deployed.

#### Remaining in this milestone

- Run the full root tests, complete Kopa Tools test suite, production build, and diff/safety review.
- Apply and verify the additive production migration.
- Deploy the collector and Kopa Tools to production.
- Trigger one production Discovery sync and verify a real source row, headers, parser version, evidence window, and explicit result counts end to end.

#### Next exact task

Run the full local quality gates and safety review before applying the production migration.

### Checkpoint 12 — Full verification and production migration

Status: completed and verified on 2026-07-29.

#### Completed

- Ran all local collector and Kopa Tools quality gates.
- Reviewed the additive migration and parser/persistence diff for destructive behavior and scope regressions.
- Applied `20260729010000_appstore_connect_parser_integrity.sql` to the production `innertype` Supabase project.
- Verified the new fields through read-only production queries.

#### Verified

- Collector App Store Connect tests: 11 passed.
- Root application check: 10 levels passed.
- Kopa Tools typecheck: passed.
- Kopa Tools full suite: 19 files and 61 tests passed.
- Kopa Tools production build: passed.
- Diff whitespace check: passed.
- New request-result columns are readable in production.
- New storefront parser-version/raw-payload columns are readable in production.
- New daily parser-version/raw-payload columns are readable in production.
- Existing report result remains null until the first `discovery-v2` sync, as intended.

#### Known issues

- The collector and Kopa Tools production deployments still run the previous parser/read model until deployment.
- A real production sync has not yet populated the new provenance fields.

#### Database changes

- Production migration applied: yes.
- The first SQL-editor submission failed on a retained fragment from an earlier query and made no change.
- The editor was cleared, the migration text was verified exactly, and the clean additive migration then completed successfully.
- Existing rows were not deleted, rewritten, or backfilled.

#### Deployment status

- Database is ready for the new application versions.
- Collector and Kopa Tools deployment remain pending.

#### Remaining in this milestone

- Deploy the public collector and Kopa Tools to production.
- Run one production Discovery import.
- Verify success/zero/partial/error provenance fields, exact live headers/raw row, evidence window, and imported/rejected counts.
- Confirm the production Sources page presents the live evidence-quality result.

#### Next exact task

Deploy the collector and Kopa Tools production applications, then run and validate one real Discovery sync end to end.

### Checkpoint 13 — Production deployment and acceptance blocker

Status: production deployment complete; final signed-in sync acceptance pending on 2026-07-29.

#### Completed

- Deployed the public collector/API bundle directly to production.
- Deployed the `apps/tools` bundle directly to production.
- Verified both public production domains respond with HTTP 200.
- Confirmed the failed acceptance attempts did not modify the existing report request or metrics.

#### Verified

- Collector deployment: `dpl_Ev8UV5LuBfRSy5h38fnniRLNtPBh`, Ready, aliased to `https://www.kopa.studio`.
- Kopa Tools deployment: `dpl_5dACDTFdffRc8AEBxV1UjoPgb9g2`, Ready, aliased to `https://tools.kopa.studio`.
- The first Tools deployment command failed before upload because the staged bundle did not include the repository’s `apps/tools` path. The corrected clean bundle deployed successfully.
- The production report request remains active with no error and with null `last_result_state`/`parser_version`, proving no failed attempt was recorded as a successful or failed import.

#### Known issues

- Final end-to-end acceptance needs one owner-authenticated `Retry Discovery report import`.
- The local Tools server secret and Vercel’s redacted environment export cannot authenticate a manual collector request.
- The in-app browser is currently at the Kopa Tools sign-in page. An owner must sign in before the import button can be used.

#### Database changes

- No additional database change occurred during this checkpoint.
- The parser-integrity migration remains applied and ready.

#### Deployment status

- Collector: live in production.
- Kopa Tools: live in production.
- Source/schema deployment parity for this slice: established.
- Live parser acceptance: pending owner sign-in.

#### Remaining in this milestone

- Sign in to Kopa Tools as the owner.
- Run `Retry Discovery report import` once.
- Verify one production request records `discovery-v2`, explicit result state, exact report headers, evidence window, source/imported/rejected counts, and raw source-row provenance.
- Confirm the Sources page renders the same live evidence-quality result.

#### Next exact task

Sign in to Kopa Tools and run the one owner-only Discovery report import so Codex can complete the final production evidence verification.

### Checkpoint 14 — Production parser acceptance and slice close

Status: completed and verified on 2026-07-29.

#### Completed

- Used the owner-authenticated production workflow to run `Retry Discovery report import`.
- Queried the stored request, versioned storefront facts, versioned daily facts, and one exact raw source row after the import.
- Verified the production Sources page against the stored result.
- Closed the App Store Connect Parser Integrity vertical slice.

#### Verified

- Import result: `success`.
- Parser version: `discovery-v2`.
- Apple segments: 4.
- Source rows: 183.
- Imported rows: 183.
- Rejected rows: 0.
- Parser issues: none.
- Evidence window: 2026-07-22 through 2026-07-27.
- Twelve exact Apple columns were recorded: Date, App Name, App Apple Identifier, Event, Page Type, Source Type, Engagement Type, Device, Platform Version, Territory, Counts, and Unique Counts.
- 53 normalized storefront facts and 44 derived country-day facts now carry `discovery-v2`.
- The inspected raw source row retained segment ID, instance ID, processing date, all source fields, and matched the normalized GB App Store search product-page-view fact.
- The production Sources page displays success, `discovery-v2`, 183/183 rows, zero rejected, four segments, twelve columns, and the correct evidence window.
- Valid-zero, partial, missing-column failure, and all-invalid failure behavior remains regression-tested locally.
- Current production counts remain 78 storefront facts and 74 total daily metrics.
- Apple Ads currently has five active recommendations. The former sixth broad-keyword action is correctly absent because broad `relationship test` is now paused; no Apple Ads write automation was added by Kopa.

#### Known issues

- No known issue blocks this vertical slice.
- The manual server-secret acceptance route could not be used because local/Vercel exports redact or mismatch the deployed server credential; the supported owner-authenticated UI workflow succeeded.
- Market-readiness/localization claims remain the next unresolved Trust and Data Correctness area.

#### Database changes

- `20260729010000_appstore_connect_parser_integrity.sql` is live in production.
- Existing tables were reused and no destructive data change occurred.

#### Deployment status

- Collector: live at `https://www.kopa.studio`.
- Kopa Tools: live at `https://tools.kopa.studio`.
- Production/source/schema parity for this slice: verified.
- Acceptance test: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Correct market-readiness and localization claims so app/UI/screenshot localization is never inferred from app-wide language metadata.
- Complete broader recommendation identity and lifecycle consistency.
- Finish remaining app/market/locale context enforcement and authenticated parity checks.

#### Next exact task

Build the smallest GB market-readiness integrity slice: replace inferred localization claims with verified or unknown evidence for app language, metadata, and screenshots.

### Checkpoint 15 — GB market-readiness evidence audit

Status: completed and verified on 2026-07-29.

#### Completed

- Traced the current market-readiness derivation from production tables through the storefront repository into the Markets and ASO overview pages.
- Audited the current InnerType GB production evidence without changing any records.
- Confirmed which stored fields are storefront-specific evidence and which are app-wide or inferred signals.

#### Verified

- GB has nine tracked keywords, seven versioned App Store Connect storefront metric rows through 2026-07-27, and one enabled Apple Ads campaign.
- GB has no row in `aso_app_storefronts`, so there is no stored GB-specific metadata, screenshot, screenshot-UI, or in-app-language verification.
- The sole explicit storefront row is US. Its metadata and screenshot booleans were created by the app-add route, which automatically writes both as true; they do not carry evidence source, verification time, or source snapshot.
- The app-wide language list includes English and eight other languages, but does not identify which languages are available in the GB binary or prove that GB metadata or screenshots are localized.
- The app-wide screenshot list is empty.
- Existing code incorrectly upgrades GB app language to `localized` because English appears in the app-wide language list.
- Existing code can also upgrade screenshot UI or app language from free-text notes. Notes are not structured, storefront-specific verification.
- App Store Connect delivery metrics, keyword tracking, and Apple Ads coverage prove market activity only; they do not prove localization.

#### Known issues

- The production Markets page can still present inferred localization language until the corrected read model is deployed.
- Legacy storefront booleans have no provenance and must not be presented as verified localization evidence.
- The app-create route still automatically marks metadata and screenshots localized and must be corrected before another app is added.

#### Database changes

- None.
- No migration is justified for this integrity slice: current production contains no verified GB localization evidence to migrate, and the safe immediate behavior is to represent unsupported claims as unknown.

#### Deployment status

- Audit only; no application change deployed yet.

#### Remaining in this milestone

- Introduce an inspectable verified-or-unknown localization evidence model.
- Remove app-wide language and free-text-note inference.
- Stop the app-create route from automatically asserting localization.
- Update Markets and ASO readiness presentation.
- Add GB and cross-market regression coverage, then run all quality gates and deploy.

#### Next exact task

Implement the verified-or-unknown localization evidence model and render unsupported GB claims as Unknown.

### Checkpoint 16 — Verified-or-unknown market-readiness model

Status: completed locally and verified on 2026-07-29.

#### Completed

- Added a deterministic storefront-localization evidence assessment with separate metadata, screenshot, and in-app-language layers.
- Exact-country public-store snapshots are the only currently supported verification source.
- Removed app-wide language inference and free-text note parsing from market readiness.
- Legacy metadata and screenshot booleans are retained as source data but no longer presented as verified evidence because they lack provenance and observation time.
- Updated the existing Markets page to show each evidence layer as Verified or Unknown with its source explanation and observation date.
- Updated the ASO overview readiness summary to consume the corrected readiness states.
- Changed the app-add flow so it no longer automatically asserts that metadata and screenshots are localized.
- Disabled the legacy storefront-underperformance insight rule until verified storefront-specific localization evidence can support its diagnosis.

#### Verified

- The sanitized GB fixture preserves the current production-shaped evidence: nine tracked keywords, seven App Store Connect rows, one Apple Ads campaign, the app-wide language list, and no GB localization record or metadata snapshot.
- GB resolves to Unknown for metadata, screenshots, and app language.
- English in the app-wide language list does not verify GB app language.
- Market activity does not verify localization.
- Legacy true booleans and free-text notes do not verify localization.
- An exact-country public-store metadata snapshot can verify captured metadata and screenshots independently.
- A GB snapshot cannot verify DE, and an unsupported snapshot source cannot verify any market.
- Active production insights contain no current storefront-underperformance/localization diagnosis that conflicts with this correction.
- Focused readiness suite: 7 tests passed.
- Kopa Tools full suite: 20 files and 68 tests passed.
- Kopa Tools typecheck: passed.
- Kopa Tools production build: passed.
- Collector parser suite: 11 tests passed.
- Root application check: 10 levels passed.
- Diff whitespace check: passed.

#### Known issues

- The project `npm run lint` command cannot run because ESLint 9 is installed without an `eslint.config.js`/`.mjs`/`.cjs` file. This predates the slice; typecheck, tests, Next production compilation, and Next’s build validation all pass.
- No production source currently verifies GB metadata, screenshots, or in-app language, so Unknown is the correct result.
- The legacy storefront columns remain for compatibility and may be replaced or given explicit provenance in a later schema slice.

#### Files changed

- `apps/tools/src/lib/storefront-readiness.ts`
- `apps/tools/src/lib/storefront-readiness.test.ts`
- `apps/tools/src/lib/fixtures/gb-storefront-readiness.json`
- `apps/tools/src/repositories/storefront-repository.ts`
- `apps/tools/src/types/domain.ts`
- `apps/tools/src/app/localizations/page.tsx`
- `apps/tools/src/app/api/apps/route.ts`
- `apps/tools/src/app/globals.css`
- `api/aso/_lib/insights.js`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- No production row was changed during audit or verification.

#### Deployment status

- Local implementation is complete and passes the required quality gates.
- Production deployment and signed-in acceptance are pending.

#### Remaining in this milestone

- Deploy the collector rule correction and Kopa Tools directly to production.
- Confirm the signed-in GB Markets row shows Unknown for all three localization evidence layers while retaining its real keyword, App Store Connect, and Apple Ads activity.
- Confirm the ASO overview no longer reports an inferred localized state.

#### Next exact task

Deploy the verified implementation directly to production and complete signed-in GB acceptance.

### Checkpoint 17 — Production GB market-readiness acceptance

Status: completed and verified on 2026-07-29.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: GB market-readiness integrity

#### Completed

- Deployed the collector safeguard directly to production.
- Deployed the corrected Kopa Tools read model and Markets presentation directly to production.
- Completed signed-in acceptance against the live Markets page and the GB-scoped ASO overview.
- Updated the active roadmap and implementation inventory to reflect the verified production state.

#### Verified

- Collector deployment `dpl_DtCQqG7QUeHC9x3k9cejk5JMci84` is Ready and aliased to `https://www.kopa.studio`.
- Kopa Tools deployment `dpl_GTcWMGrnen8ohkhm8SThG6pEfnjy` is Ready and aliased to `https://tools.kopa.studio`.
- Both production domains return HTTP 200.
- The signed-in GB Markets row shows `Localization evidence unknown`.
- GB metadata evidence: Unknown — no exact-country metadata snapshot is stored.
- GB screenshot evidence: Unknown — no exact-country screenshot evidence is stored.
- GB app-language evidence: Unknown — the app-wide language list cannot verify a market.
- The same GB row retains nine tracked keywords, App Store Connect coverage, and Apple Ads activity.
- The GB-scoped ASO overview reports one market in `Localization evidence unknown`.
- US is the only partial state: its exact-country public-store snapshot verifies captured metadata, while screenshots and app language remain Unknown.
- No active production insight currently contains the disabled unsupported storefront-underperformance localization diagnosis.
- No Apple Ads resource was modified.
- Attribution remains deferred.

#### Known issues

- Kopa does not yet collect a storefront-specific source capable of verifying in-app language.
- GB metadata and screenshot evidence remain Unknown until an exact-country public-store snapshot or another approved structured source is collected.
- Legacy localization booleans remain in the schema for compatibility but no longer control user-facing readiness.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Database changes

- None.
- No production record was inserted, updated, deleted, or backfilled by this slice.

#### Deployment status

- Collector: live in production.
- Kopa Tools: live in production.
- Production/source parity for this slice: verified.
- Signed-in acceptance test: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Enforce app, market, locale, period, metadata-version, and evidence-window scope in the remaining repositories and recommendation views.
- Unify recommendation identity, deduplication, and lifecycle across `aso_insights` and `apple_ads_recommendations`.
- Finish shared freshness, completeness, volume, relevance, and cross-source agreement contracts.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Build the smallest recommendation-scope integrity slice: make the Insights page and repository honor the selected app and market, with a regression test proving a GB view cannot surface another market’s recommendation.

### Checkpoint 18 — Recommendation-scope audit

Status: completed and verified on 2026-07-29.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: Insights app-and-market scope integrity

#### Completed

- Traced the selected `app` and `country` context from the sidebar/global context into the Recommendations page and all three feed sources.
- Audited the current production ASO insights, Apple Ads recommendations, and Discovery markets without changing data.
- Identified the exact cross-market leakage paths.

#### Verified

- The Recommendations page accepts `app` but does not declare or pass `country`.
- The ASO insight repository selects neither `country` nor a market filter.
- All ten active production ASO insights currently have `country = null`; they are portfolio/cross-market findings and must not appear inside a GB-only view.
- All five active Apple Ads recommendations are scoped to InnerType and GB, but the combined Recommendations page currently filters only by app and priority, not storefront.
- Discovery currently reads and aggregates 30 production markets before producing recommendations, even when the page URL contains `country=gb`.
- The page-level filter form drops `country` when submitted.
- The global context market selector only lists app primary countries, so a URL-selected GB context is not represented as a selectable option even though the URL carries it.

#### Known issues

- A GB Recommendations view can currently display portfolio ASO findings and Discovery conclusions derived from other markets.
- Apple Ads happens to contain only GB active recommendations today, but the code would leak a future DE recommendation into GB.
- Feed cards do not display their market scope.

#### Database changes

- None.
- No production record was changed during this audit.

#### Deployment status

- Audit only; no application change deployed yet.

#### Remaining in this vertical slice

- Enforce exact app and market scope in the ASO, Apple Ads, and Discovery repositories.
- Hide portfolio/null-market ASO findings when an exact market is selected.
- Preserve market context through page filters and show the market on each recommendation.
- Add GB versus DE regression coverage.
- Run all quality gates, deploy directly to production, and complete signed-in acceptance.

#### Next exact task

Implement exact app-and-market scoping across all three recommendation feed sources.

### Checkpoint 19 — Exact recommendation scope implementation

Status: completed locally and verified on 2026-07-29.

#### Completed

- Added a shared deterministic app-and-market scope guard for recommendation feed items.
- Added exact market filtering to the ASO insight repository.
- Added exact app and storefront filtering to the Apple Ads recommendation repository.
- Added exact app and country filtering before Discovery metrics are aggregated and assessed.
- Added a feed-level scope guard as defense in depth after repository reads.
- Exact-market views now exclude portfolio/null-market ASO findings.
- Recommendation cards now display their market or `Portfolio scope`.
- Page filter submissions preserve `country` and `period`.
- A URL-selected non-primary market such as GB now remains visible in the global market selector.

#### Verified

- The GB fixture excludes a portfolio ASO finding, a DE Apple Ads recommendation, and another app’s GB finding.
- The same fixture retains only exact InnerType/GB Apple Ads and Discovery recommendations.
- Market matching is case-insensitive and treats `all` as unscoped.
- A no-market view continues to allow portfolio and multiple-market findings for the selected app.
- Focused recommendation-scope suite: 4 tests passed.
- Kopa Tools full suite: 21 files and 72 tests passed.
- Kopa Tools typecheck: passed.
- Kopa Tools production build: passed.
- Collector parser suite: 11 tests passed.
- Root application check: 10 levels passed.
- Diff whitespace check: passed.

#### Known issues

- Current ASO insights are all portfolio/null-market records, so none will appear in an exact GB view until the rule engine persists market-specific ASO findings.
- The global market selector still discovers markets from app primary countries plus the current URL selection; a complete market catalogue belongs to the later unified context slice.
- The selected period is preserved but Discovery remains fixed to its existing 28-day assessment window in this slice.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `apps/tools/src/lib/recommendation-scope.ts`
- `apps/tools/src/lib/recommendation-scope.test.ts`
- `apps/tools/src/repositories/insight-repository.ts`
- `apps/tools/src/repositories/apple-ads-recommendation-repository.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.ts`
- `apps/tools/src/components/recommendation-feed.tsx`
- `apps/tools/src/components/global-context-bar.tsx`
- `apps/tools/src/app/insights/page.tsx`
- `apps/tools/src/types/domain.ts`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- No existing insight or recommendation record is rewritten.

#### Deployment status

- Local implementation is complete and passes all required quality gates.
- Direct Kopa Tools production deployment and signed-in GB acceptance are pending.

#### Remaining in this vertical slice

- Deploy Kopa Tools directly to production.
- Verify the signed-in GB feed contains only GB cards and no portfolio or other-market ASO/Discovery conclusions.
- Verify the filter form preserves GB.

#### Next exact task

Deploy the scoped Recommendations feed directly to production and complete signed-in GB acceptance.

### Checkpoint 20 — Production recommendation-scope acceptance

Status: completed and verified on 2026-07-29.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: Insights app-and-market scope integrity

#### Completed

- Deployed the scoped Recommendations implementation directly to Kopa Tools production.
- Completed signed-in acceptance for the exact InnerType/GB context.
- Corrected one acceptance-found presentation issue so app-filtered aggregate Discovery cards display InnerType rather than `Portfolio`.
- Re-ran the full Tools test, typecheck, and production-build gates after that correction.
- Deployed the final corrected source and repeated signed-in acceptance.
- Updated the active roadmap and implementation inventory.

#### Verified

- Final production deployment `dpl_6xvYrtUDhwgueWt4FfXaKqsEhUVg` is Ready and aliased to `https://tools.kopa.studio`.
- The production Recommendations URL returns HTTP 200.
- The global context shows InnerType and GB selected.
- The full scoped feed contains eight cards: five Apple Ads and three Discovery.
- All eight visible cards are labelled GB.
- All eight visible cards are labelled InnerType after the final presentation correction.
- No portfolio/null-market ASO insight appears in the GB view.
- No other-market recommendation appears.
- The page explicitly states that portfolio and other-market recommendations are excluded.
- Filtering the feed to Discovery preserves both the InnerType app ID and `country=gb` in the URL.
- The Discovery-only feed contains exactly three GB cards and no Apple Ads card.
- Attribution remains deferred and no Apple Ads write capability was added.

#### Known issues

- All ten current active ASO insights are portfolio/null-market records, so exact-market views correctly exclude them.
- Production contains repeated active ASO findings from the same legacy rule families, including multiple `metadata_mismatch` and competitor-gap rows. Recommendation identity is the next trust issue.
- Period context is preserved but not yet enforced by the existing fixed 28-day Discovery assessment.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Database changes

- None.
- No recommendation, insight, campaign, or evidence row was modified by this slice.

#### Deployment status

- Kopa Tools: live in production.
- Production/source parity for this slice: verified.
- Signed-in acceptance test: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Unify recommendation identity, deduplication, and lifecycle across current rule families and the two persistence models.
- Enforce remaining locale, period, metadata-version, and evidence-window context.
- Finish shared freshness, completeness, volume, relevance, and cross-source agreement contracts.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Build the smallest recommendation-identity slice: collapse repeated active `metadata_mismatch` ASO insights to one current app-and-scope identity, preserve older rows as history, and prove rerun idempotency with regression tests.

### Checkpoint 21 — Metadata-mismatch identity audit and implementation

Status: implementation and production migration verified on 2026-07-30; collector deployment pending.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: one current `metadata_mismatch` insight per app and scope

#### Completed

- Audited the production `metadata_mismatch` rows and the collector's deterministic insight persistence flow.
- Replaced the changing keyword-ID-list dedupe key with a stable app-and-scope identity:
  - portfolio: `metadata_mismatch:<app-id>:portfolio`
  - storefront: `metadata_mismatch:<app-id>:<country>`
- Added reconciliation that refreshes the newest current row in place when evidence changes.
- Added explicit `superseded` history handling for older active rows; no evidence row is deleted.
- Added an additive migration that converges legacy rows and creates a partial unique index for the one-current-row contract.
- Added regression coverage for stable identity, history preservation, changed evidence, scope isolation, and unchanged-rerun idempotency.

#### Verified

- Production contains exactly three active portfolio-scoped `metadata_mismatch` rows for InnerType:
  - 71 missing high-priority keywords, created 2026-07-28;
  - 49 missing high-priority keywords, created 2026-07-21;
  - 54 missing high-priority keywords, created 2026-07-20.
- The repeated rows were caused by including every current missing keyword ID in `dedupe_key`; additions/removals therefore created a new active identity.
- The newest production row is the correct candidate to remain current; the two older rows can be retained as superseded history.
- Root ASO/parser tests: 16/16 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes.
- Production migration completed successfully:
  - one 71-keyword row remains active with the stable portfolio identity;
  - the 49-keyword and 54-keyword rows remain stored with `superseded` status and explicit history notes;
  - all three original row IDs and evidence records are preserved.

#### Known issues

- Other repeated ASO rule families, including competitor-gap findings, remain outside this smallest slice.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `supabase/migrations/20260730090000_aso_metadata_mismatch_identity.sql`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- Applied additive migration `20260730090000_aso_metadata_mismatch_identity.sql` to production.
- The migration adds `superseded` to the allowed ASO insight lifecycle, marks older active app-and-scope copies as superseded, assigns the stable key to the newest active row, and adds a partial unique index.
- No rows are deleted.

#### Deployment status

- Local implementation: complete for this checkpoint.
- Production migration: applied and verified.
- Collector production deployment and convergence validation: pending.

#### Remaining in this vertical slice

- Deploy the collector directly to production.
- Run collection/reconciliation and prove a second unchanged run is idempotent.
- Confirm one active current row and two superseded history rows.

#### Next exact task

Run all quality gates, review the migration, then apply and validate the one-current-row contract in production.

### Checkpoint 22 — Production metadata-mismatch identity acceptance

Status: completed and verified on 2026-07-30.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: one current `metadata_mismatch` insight per app and scope

#### Completed

- Applied the additive ASO insight lifecycle and identity migration to production.
- Deployed the committed collector source directly to Kopa Studio production.
- Ran the normal owner-only Public App Store collector twice after deployment.
- Verified the same stable identity and history state after both runs.
- Inspected the remaining active rule identities and selected one smallest follow-on slice.

#### Verified

- Production deployment `dpl_6LCai2RQtMD2CQbqZpxiUrjFQHb9` is Ready and aliased to `https://www.kopa.studio`.
- The production site returns HTTP 200.
- Exactly one `metadata_mismatch` row is active:
  - row `00e60eeb-f616-48e6-99f2-da3b445e0bf9`;
  - title reports 71 missing high-priority keywords;
  - identity is `metadata_mismatch:9bf77c42-ff52-4030-b759-ef56557adca3:portfolio`.
- Exactly two prior rows remain as `superseded` history:
  - the 49-keyword row;
  - the 54-keyword row.
- No row or evidence record was deleted.
- First post-deployment run `84757c7d-1cdf-4592-859d-65c8fc3ed535` completed `ok` with `insights_created: 0`.
- Second post-deployment run `a41de5b9-dda7-46c4-a304-53c9713366e3` completed `ok` with `insights_created: 0`.
- The active row's `updated_at` remained `2026-07-30T21:01:01.674636+00:00` across both unchanged runs, proving no unnecessary update.
- Root ASO/parser tests: 16/16 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck and production build pass.
- Attribution remains deferred and no Apple Ads write capability was added.

#### Known issues

- The `competitor_wins_high_priority_terms` family still has four active versions for the same InnerType + Enneagram competitor identity (5, 8, 9, and current 8-term evidence).
- Two other competitor findings have distinct competitor identities and must not be collapsed into the Enneagram history.
- Period context remains preserved but is not yet enforced by the fixed 28-day Discovery assessment.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `supabase/migrations/20260730090000_aso_metadata_mismatch_identity.sql`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- Applied `20260730090000_aso_metadata_mismatch_identity.sql`.
- Added the `superseded` ASO insight lifecycle value and a partial unique index for the one-active metadata-mismatch app-and-scope identity.
- Reclassified two older active rows as superseded history; no deletion occurred.

#### Deployment status

- Kopa Studio collector: live in production.
- Production/source parity for this slice: verified.
- Two-run idempotency acceptance: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Unify recommendation identity, deduplication, and lifecycle across the remaining rule families and persistence models.
- Enforce remaining locale, period, metadata-version, and evidence-window context.
- Finish shared freshness, completeness, volume, relevance, and cross-source agreement contracts.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Build the smallest competitor-recommendation identity slice: collapse the four active InnerType + Enneagram `competitor_wins_high_priority_terms` rows to one current app-plus-competitor-and-scope identity, preserve the older three as superseded history, keep the two distinct competitor identities separate, and prove rerun idempotency with regression tests.

### Checkpoint 23 — Competitor insight identity audit and implementation

Status: implementation and production migration verified on 2026-07-30; collector deployment pending.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: one current competitor-gap insight per app, competitor, and scope

#### Completed

- Audited every production `competitor_wins_high_priority_terms` row and its source competitor.
- Replaced the changing losing-keyword-ID-list dedupe suffix with a stable app-plus-competitor-and-scope identity.
- Added an explicit `competitor_id` reference to the insight draft and an additive database migration to persist it.
- Added reconciliation that refreshes only the newest current row for the same app, competitor, and scope.
- Preserved older same-identity rows as `superseded` history without deleting evidence.
- Added regression coverage for stable identity, legacy-key reconciliation, distinct-competitor isolation, market isolation, history preservation, and unchanged-rerun idempotency.

#### Verified

- Production has four active InnerType + Enneagram versions:
  - current 8-term row from 2026-07-22;
  - 9-term row from 2026-07-21;
  - older 8-term row from 2026-07-21;
  - 5-term row from 2026-07-21.
- Their changing keyword-ID suffixes caused each evidence-set change to create another active row.
- Enneagram competitor ID is `02dbe396-cd28-4965-8a82-ae015251903e`.
- The active 16 Personalities Test and The Personality Types findings use different competitor IDs and must remain current independent identities.
- Root ASO/parser tests: 20/20 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck passes after the production build completed.
- Kopa Tools production build passes.
- Local unchanged-rerun plans produce zero inserts and zero updates.
- Production migration completed successfully:
  - current 8-term Enneagram row remains active with the stable competitor identity;
  - the 9-term, older 8-term, and 5-term Enneagram rows remain stored as superseded history;
  - 16 Personalities Test and The Personality Types remain active as independent identities;
  - all six original row IDs and evidence records are preserved.

#### Known issues

- Remaining ASO rule families have not yet received the shared identity contract.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `supabase/migrations/20260730110000_aso_competitor_insight_identity.sql`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- Applied additive migration `20260730110000_aso_competitor_insight_identity.sql` to production.
- It adds nullable `competitor_id`, backfills existing competitor-gap rows, supersedes older same-identity active rows, assigns stable keys to current rows, and creates a scoped partial unique index.
- No row is deleted.

#### Deployment status

- Local implementation: complete for this checkpoint.
- Production migration: applied and verified.
- Collector deployment: pending.

#### Remaining in this vertical slice

- Deploy the collector directly to production.
- Run two production collections and prove unchanged-rerun idempotency.
- Confirm one active Enneagram row, three superseded Enneagram history rows, and two untouched distinct-competitor active rows.

#### Next exact task

Run all quality gates, then apply and validate the competitor identity contract in production.

### Checkpoint 24 — Production competitor identity acceptance

Status: completed and verified on 2026-07-30.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: one current competitor-gap insight per app, competitor, and scope

#### Completed

- Applied the additive competitor identity migration to production.
- Deployed the committed collector source directly to Kopa Studio production.
- Ran the owner-only Public App Store collector twice after deployment.
- Verified stable identities, preserved history, distinct-competitor isolation, and second-run idempotency.
- Inspected the remaining active operational insight and selected one smallest follow-on lifecycle slice.

#### Verified

- Production deployment `dpl_EqA4rUXgbQCvvvXwzjzWwN88WvoM` is Ready and aliased to `https://www.kopa.studio`.
- The production site returns HTTP 200.
- Exactly three competitor-gap rows are active, one for each distinct rival:
  - Enneagram: Personality Test;
  - 16 Personalities Test;
  - The Personality Types.
- The current Enneagram row uses the stable portfolio identity and explicit competitor ID.
- The older 9-term, 8-term, and 5-term Enneagram rows remain stored as `superseded` history with explicit notes.
- No row or evidence record was deleted.
- First post-deployment run `a952c5f2-14d9-4ff6-bca4-a342c6a08df6` completed `ok` with `insights_created: 0`.
- That first run refreshed changed current evidence in place without creating a duplicate.
- Second post-deployment run `4680c945-d314-4523-9f7b-2fad526edd46` completed `ok` with `insights_created: 0`.
- The three active competitor rows' `updated_at` values were unchanged by the second run, proving write-free unchanged-rerun idempotency.
- Root ASO/parser tests: 20/20 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck and production build pass.
- Attribution remains deferred and no Apple Ads write capability was added.

#### Known issues

- The active `data_collection_failure` insight still says ten keywords are stale and the last successful run was 2026-07-20.
- The latest ten production collection runs are all `ok`, including the two acceptance runs on 2026-07-30, so that operational warning is historical but remains active because resolved rule conditions are not yet retired.
- Period context remains preserved but is not yet enforced by the fixed 28-day Discovery assessment.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `supabase/migrations/20260730110000_aso_competitor_insight_identity.sql`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- Applied `20260730110000_aso_competitor_insight_identity.sql`.
- Added nullable `competitor_id`, backfilled all six competitor-gap rows, superseded three older Enneagram versions, assigned stable keys to the three current competitor identities, and added a partial unique index.
- No deletion occurred.

#### Deployment status

- Kopa Studio collector: live in production.
- Production/source parity for this slice: verified.
- Two-run idempotency acceptance: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Complete lifecycle consistency when deterministic rule conditions resolve.
- Unify identity and lifecycle across the remaining ASO rule families and persistence models.
- Enforce remaining locale, period, metadata-version, and evidence-window context.
- Finish shared freshness, completeness, volume, relevance, and cross-source agreement contracts.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Build the smallest resolved-condition lifecycle slice: automatically supersede the stale active `data_collection_failure` insight when the current rule no longer emits it, preserve the historical row and evidence, keep genuine current failures active, and prove recovery plus unchanged-rerun idempotency with regression tests.

### Checkpoint 25 — Resolved collection-warning lifecycle implementation

Status: implemented locally and verified on 2026-07-30; production deployment pending.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: resolved-condition lifecycle for `data_collection_failure`

#### Completed

- Audited the active production warning against the latest collection evidence.
- Added deterministic reconciliation for `data_collection_failure` before notification-preference filtering.
- Current failures now remain active and refresh their evidence in place.
- Newly detected failures still create a current insight.
- When the rule no longer emits a failure for an app and scope, the prior active row becomes `superseded` history with an explicit recovery note.
- Added regression coverage for recovery, evidence preservation, genuine current failures, new failures, and unchanged active/recovered idempotency.

#### Verified

- The production warning was created 2026-07-20 and still reports:
  - last successful run: 2026-07-20;
  - ten stale keywords.
- The latest ten production collection runs are all `ok`, including four acceptance runs completed on 2026-07-30.
- The current rule therefore no longer emits this failure; the active row is obsolete historical evidence.
- Root ASO/parser/lifecycle tests: 24/24 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes.
- Recovery retains the original row and evidence and changes only lifecycle metadata.
- A genuine emitted failure is not superseded.
- Unchanged active and already-recovered reruns produce zero inserts and zero updates.
- No production row has been changed by this checkpoint.

#### Known issues

- The obsolete production warning remains active until the collector implementation is deployed and run.
- Resolved-condition lifecycle has not yet been generalized to every deterministic rule family.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- The existing `superseded` lifecycle value supports this slice.
- No migration is required.

#### Deployment status

- Local implementation: complete for this checkpoint.
- Production collector deployment and recovery validation: pending.

#### Remaining in this vertical slice

- Deploy the collector directly to production.
- Run collection and verify the obsolete warning becomes superseded history.
- Run a second collection and prove the recovered row remains unchanged.

#### Next exact task

Run all quality gates, deploy the collector, and validate recovery plus second-run idempotency in production.

### Checkpoint 26 — Production collection-warning recovery acceptance

Status: completed and verified on 2026-07-30.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: resolved-condition lifecycle for `data_collection_failure`

#### Completed

- Deployed the committed resolved-warning reconciliation directly to Kopa Studio production.
- Ran the owner-only Public App Store collector twice after deployment.
- Verified that current healthy evidence retired the obsolete warning.
- Verified the original warning row and evidence remain available as superseded history.
- Verified the second healthy run made no further lifecycle write.

#### Verified

- Production deployment `dpl_5V78Uyh5kjiMXvz8semwWL75aU5v` is Ready and aliased to `https://www.kopa.studio`.
- The production site returns HTTP 200.
- Active `data_collection_failure` count is now zero.
- Historical row `47a09bbc-96be-48fd-ab34-859661c44132` remains stored with:
  - original July 20 observation;
  - original last-successful-run and stale-keyword evidence;
  - `superseded` status;
  - an explicit automatic-recovery note.
- First post-deployment run `69951961-536b-484c-8f86-59f221af44aa` completed `ok` with `insights_created: 0`.
- The first run changed the recovered row once at `2026-07-30T21:35:59.053Z`.
- Second post-deployment run `24ea2f8d-a75b-4ed5-a283-34e9c71d9da4` completed `ok` with `insights_created: 0`.
- The recovered row's `updated_at` remained unchanged after the second run, proving write-free recovered-state idempotency.
- Root ASO/parser/lifecycle tests: 24/24 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck and production build pass.
- Attribution remains deferred and no Apple Ads write capability was added.

#### Known issues

- `metadata_mismatch` and competitor-gap identities are stable while emitted, but their active rows are not yet automatically retired when their deterministic conditions disappear.
- Period context remains preserved but is not yet enforced by the fixed 28-day Discovery assessment.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- The existing row was preserved and moved from `active` to `superseded`; no deletion occurred.

#### Deployment status

- Kopa Studio collector: live in production.
- Production/source parity for this slice: verified.
- Recovery and second-run idempotency acceptance: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Complete resolved-condition lifecycle for the remaining current ASO rule families.
- Unify identity and lifecycle across the remaining ASO rule families and persistence models.
- Enforce remaining locale, period, metadata-version, and evidence-window context.
- Finish shared freshness, completeness, volume, relevance, and cross-source agreement contracts.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Build the smallest remaining resolved-condition slice for `metadata_mismatch`: keep the current app-and-scope row active and refreshed while missing high-priority terms remain, automatically supersede it when the rule stops emitting after a metadata fix, preserve its evidence as history, and prove active, recovery, and unchanged-rerun behavior with regression tests.

### Checkpoint 27 — Metadata-mismatch resolved-condition implementation

Status: locally complete and verified on 2026-07-30.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: resolved-condition lifecycle for `metadata_mismatch`

#### Completed

- Extended the existing metadata-mismatch reconciliation instead of creating a parallel lifecycle.
- Kept the one-current-row app-and-scope identity while the rule continues to emit.
- Added automatic recovery for active portfolio-scoped rows when an app was evaluated and no longer emits `metadata_mismatch`.
- Preserved recovered rows, titles, and evidence as superseded history.
- Limited recovery to apps actually evaluated by the collector and to the portfolio scope currently owned by the rule.
- Moved metadata lifecycle reconciliation before alert-preference filtering so disabled keyword notifications cannot be mistaken for rule recovery.
- Added regression coverage for active, refreshed, recovered, isolated-scope, preserved-history, and unchanged-rerun behavior.

#### Verified

- Focused ASO/parser/lifecycle tests: 27/27 pass.
- Current emitted metadata mismatch remains active without a duplicate.
- Changed evidence refreshes the current row in place.
- Recovery preserves the prior evidence and changes only lifecycle metadata.
- Unevaluated apps and country-scoped rows are not falsely recovered by the portfolio rule.
- Already-recovered history remains write-free on subsequent runs.
- No production row has been changed by this checkpoint.

#### Known issues

- The implementation has not yet been deployed or exercised against the current production run.
- The current production mismatch is expected to remain active because the metadata condition is still true; the recovery branch is covered by deterministic tests rather than a production metadata mutation.
- Competitor-gap rows still lack resolved-condition retirement.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- The existing `superseded` lifecycle value supports this slice.
- No migration is required.

#### Deployment status

- Local implementation: complete.
- Production deployment and active-state acceptance: pending.

#### Remaining in this vertical slice

- Run the full root and Kopa Tools quality gates.
- Deploy the committed collector directly to production.
- Run collection twice and verify that the still-valid production mismatch remains one active row without duplicate or repeat lifecycle writes.

#### Next exact task

Run all quality gates, deploy the collector, and validate current-condition persistence plus second-run idempotency in production.

### Checkpoint 28 — Production metadata-mismatch lifecycle acceptance

Status: completed and verified on 2026-07-30.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: resolved-condition lifecycle for `metadata_mismatch`

#### Completed

- Deployed the committed metadata-mismatch lifecycle implementation directly to Kopa Studio production.
- Ran the owner-only Public App Store collector twice after deployment.
- Verified that the still-valid production mismatch remains the one active app-and-portfolio row.
- Verified that unchanged evidence creates no duplicate and performs no lifecycle refresh.
- Verified that the two older mismatch versions remain preserved as superseded history.
- Covered the unavailable production recovery transition with deterministic tests instead of mutating live App Store metadata.

#### Verified

- Production deployment `dpl_4RxCTrfd9dqDwcs36Ct7XxCPfydn` is Ready and aliased to `https://www.kopa.studio`.
- Active metadata row `00e60eeb-f616-48e6-99f2-da3b445e0bf9` remains:
  - `active`;
  - titled `71 high-priority keywords are missing from InnerType Personality Test's title and subtitle`;
  - keyed as `metadata_mismatch:9bf77c42-ff52-4030-b759-ef56557adca3:portfolio`.
- Its `updated_at` remained `2026-07-30T21:01:01.674636+00:00` through both post-deployment runs.
- Historical 54-term and 49-term rows remain stored with `superseded` status.
- First post-deployment run `dff7291c-a61f-4a0f-92fb-718cef41a586` completed `ok`:
  - 54 processed;
  - 54 succeeded;
  - 0 failed;
  - 0 insights created.
- Second post-deployment run `d9eceeb5-4755-49f2-aa20-aa0b80ae688f` completed `ok` with the same counts.
- Focused ASO/parser/lifecycle tests: 27/27 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes.
- Recovery tests prove that an evaluated app whose mismatch disappears is superseded once while retaining its evidence.
- Attribution remains deferred and no Apple Ads write capability was added.

#### Known issues

- Production metadata still has 71 missing high-priority terms, so the row correctly remains active.
- The recovery transition cannot be exercised in production without a real metadata fix; deterministic regression coverage is complete.
- Competitor-gap rows still lack resolved-condition retirement.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- No production insight row was manually mutated.
- Existing active and historical rows were preserved.

#### Deployment status

- Kopa Studio collector: live in production.
- Production/source parity for this slice: verified.
- Current-condition persistence and second-run idempotency acceptance: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Complete resolved-condition lifecycle for the remaining current ASO rule families.
- Unify identity and lifecycle across the remaining ASO rule families and persistence models.
- Enforce remaining locale, period, metadata-version, and evidence-window context.
- Finish shared freshness, completeness, volume, relevance, and cross-source agreement contracts.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Build resolved-condition lifecycle for `competitor_wins_high_priority_terms`: keep each app, competitor, and scope row active while that rival still meets the deterministic gap rule, automatically supersede it when the evaluated rival no longer qualifies, preserve its evidence as history, and prove competitor isolation plus unchanged-rerun behavior with regression tests.

### Checkpoint 29 — Competitor-gap resolved-condition implementation

Status: locally complete and verified on 2026-07-30.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: resolved-condition lifecycle for `competitor_wins_high_priority_terms`

#### Completed

- Extended the existing competitor-gap reconciliation instead of creating a parallel lifecycle.
- Kept one current row per app, competitor, and scope while the deterministic rule continues to emit.
- Added automatic recovery when an explicitly evaluated competitor no longer meets the high-priority term-gap rule.
- Preserved recovered rows, titles, and evidence as superseded history.
- Limited recovery to exact app-and-competitor scopes with recent ranking evidence for that app's tracked keywords, and to the portfolio scope currently owned by the rule.
- Moved competitor lifecycle reconciliation before alert-preference filtering so disabled competitor notifications cannot be mistaken for recovery.
- Added regression coverage for recovery, rival isolation, app isolation, country-scope isolation, evidence preservation, and unchanged reruns.

#### Verified

- Focused ASO/parser/lifecycle tests: 30/30 pass.
- A still-emitted competitor gap remains active without a duplicate.
- An evaluated rival that stops qualifying is superseded once.
- Recovery for one rival does not affect another still-emitted rival.
- Unevaluated apps, rivals without recent evidence, and country-scoped rows are not falsely recovered.
- Recovered history remains write-free on subsequent runs.
- No production row has been changed by this checkpoint.

#### Known issues

- The implementation has not yet been deployed or exercised against the current production run.
- Current production has three tracked competitors and three active portfolio gap rows; each is expected to remain active if its current gap evidence still qualifies.
- The recovery branch is covered by deterministic tests rather than by manipulating production competitor rankings.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- The existing `superseded` lifecycle value supports this slice.
- No migration is required.

#### Deployment status

- Local implementation: complete.
- Production deployment and current-condition acceptance: pending.

#### Remaining in this vertical slice

- Run the full root and Kopa Tools quality gates.
- Deploy the committed collector directly to production.
- Run collection twice and verify current rival rows remain correctly isolated, deduplicated, and write-free when evidence is unchanged.

#### Next exact task

Run all quality gates, deploy the collector, and validate current competitor-scope persistence plus second-run idempotency in production.

### Checkpoint 30 — Production competitor-gap lifecycle acceptance

Status: completed and verified on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: resolved-condition lifecycle for `competitor_wins_high_priority_terms`

#### Completed

- Deployed the committed competitor-gap lifecycle implementation directly to Kopa Studio production.
- Ran the owner-only Public App Store collector twice after deployment.
- Verified that all three currently qualifying competitors remain isolated active portfolio rows.
- Verified that unchanged competitor evidence creates no duplicate and performs no lifecycle refresh.
- Verified that three older Enneagram gap versions remain preserved as superseded history.
- Covered the unavailable production recovery transition with deterministic tests instead of manipulating live competitor rankings.
- Audited production rule families after acceptance; every currently stored rule family now has explicit current-versus-superseded lifecycle handling.

#### Verified

- Production deployment `dpl_GVzQ4gw9qDm9RJxSSVdAD2YUzQjs` is Ready and aliased to `https://www.kopa.studio`.
- The three active competitor identities remain:
  - `dd5ef7a9-6983-4456-ad86-b0ac431bfa11` — 16 Personalities Test, 19 high-priority terms;
  - `4caf316e-f0b8-4e28-ad25-c4983632de5f` — The Personality Types, 3 high-priority terms;
  - `3196b29e-919c-4952-a949-f0f6a25d5975` — Enneagram: Personality Test, 8 high-priority terms.
- Their app-plus-competitor-plus-portfolio dedupe keys remained distinct.
- Their `updated_at` values remained unchanged through both post-deployment runs.
- The three older Enneagram rows remain stored with `superseded` status and unchanged historical timestamps.
- First post-deployment run `60bb401d-cdac-4975-9c33-030a75e655d5` completed `ok`:
  - 54 processed;
  - 54 succeeded;
  - 0 failed;
  - 3 competitors evaluated;
  - 0 insights created.
- Second post-deployment run `87148e3c-6456-4b48-b9b2-bf4e825a6dd8` completed `ok` with the same counts.
- Focused ASO/parser/lifecycle tests: 30/30 pass.
- Root repository checks: 10/10 pass.
- Kopa Tools tests: 21 files and 72/72 tests pass.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes.
- Recovery tests prove that one evaluated rival can resolve without affecting other rivals, apps, or market scopes, while preserving its evidence.
- Rivals without recent ranking evidence are not falsely recovered.
- Attribution remains deferred and no Apple Ads write capability was added.

#### Known issues

- The current three production competitor gaps remain genuine, so their rows correctly remain active.
- The recovery transition cannot be exercised in production without a real ranking change; deterministic regression coverage is complete.
- The Discovery assessment still preserves period context in navigation but evaluates a fixed 28-day evidence window.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- No production insight row was manually mutated.
- Existing active and historical rows were preserved.

#### Deployment status

- Kopa Studio collector: live in production.
- Production/source parity for this slice: verified.
- Competitor isolation, current-condition persistence, and second-run idempotency acceptance: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Enforce remaining locale, period, metadata-version, and evidence-window context.
- Finish shared freshness, completeness, volume, relevance, and cross-source agreement contracts.
- Unify lifecycle semantics across ASO, Discovery, and Apple Ads persistence models.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Make the Discovery assessment honor the selected 7-day, 28-day, or 90-day period end to end: use that period for evidence queries and comparisons, display the same evidence window in the stored/read model, preserve app-and-market scope, and prove period isolation with regression tests.

### Checkpoint 31 — Period-aware Discovery assessment implementation

Status: locally complete, built, and verified on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: Discovery evidence-period integrity

#### Completed

- Added one validated Discovery period contract for `7d`, `28d`, and `90d`, with invalid or missing values defaulting to `28d`.
- Changed storefront evidence queries to use the selected inclusive calendar window instead of a fixed 28-day query.
- Kept exact app and normalized market filters on both storefront-event and daily-metric queries.
- Added actual available evidence start and end dates to the Discovery read model.
- Updated Recommendation Discovery cards to identify both the selected period and actual evidence dates.
- Included the selected period in dynamic Discovery card identity so different evidence windows cannot be confused in the view.
- Updated the App Store Connect Discovery overview and decision brief to honor the same global app, market, and period context.
- Normalized invalid period values in the global context control and preserved the validated period through recommendation filters.

#### Verified

- Kopa Tools tests: 23 files and 79/79 tests pass.
- Kopa Tools typecheck passes.
- `7d`, `28d`, and `90d` resolve to distinct inclusive query boundaries.
- Missing and invalid periods resolve to `28d`.
- A fixture with recent and older evidence produces different 7-day and 90-day totals.
- Both source tables receive the exact selected app and normalized country filters.
- Evidence labels state the selected period separately from the actual available source dates.
- Existing app-and-market recommendation-scope tests remain green.
- No production data or row has been changed by this checkpoint.

#### Known issues

- The implementation has not yet been built or deployed to production.
- Production acceptance must verify all three URLs render the matching period label and preserve InnerType/GB scope.
- Discovery conclusions remain dynamic read-model recommendations rather than persisted lifecycle rows.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `apps/tools/src/lib/discovery-period.ts`
- `apps/tools/src/lib/discovery-period.test.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.test.ts`
- `apps/tools/src/components/global-context-bar.tsx`
- `apps/tools/src/app/insights/page.tsx`
- `apps/tools/src/app/app-store-connect/page.tsx`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- This slice changes read boundaries and presentation only.

#### Deployment status

- Local implementation and focused verification: complete.
- Production build, deployment, and signed-in period acceptance: pending.

#### Remaining in this vertical slice

- Run root checks and the Kopa Tools production build.
- Deploy the committed Kopa Tools source directly to production.
- Verify signed-in InnerType/GB Discovery views for `7d`, `28d`, `90d`, and an invalid-period fallback.

#### Next exact task

Run all remaining quality gates, deploy production, and complete signed-in period and scope acceptance.

### Checkpoint 32 — Production Discovery period-integrity acceptance

Status: completed and verified on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: Discovery evidence-period integrity

#### Completed

- Deployed the committed period-aware Discovery implementation directly to Kopa Tools production.
- Verified the signed-in Recommendations view for InnerType/GB with `7d`, `28d`, and `90d`.
- Verified an unsupported `365d` value safely resolves to `28d` in assessment, presentation, the global control, and the submitted filter value.
- Verified the App Store Connect overview and decision brief honor the same app, market, and period context.
- Verified exact market scoping remains intact across every accepted period.

#### Verified

- Production deployment `dpl_FF1PxtZPFmdnvWqfD8YsWs5GGN9w` is Ready and aliased to `https://tools.kopa.studio`.
- InnerType/GB `7d` Recommendations:
  - global period control shows `Last 7 days`;
  - three Discovery cards are shown;
  - every card is scoped to InnerType Personality Test and GB;
  - every evidence label states `7-day selected window`;
  - actual available evidence is shown as `2026-07-24 to 2026-07-28`.
- InnerType/GB `28d` Recommendations show the same exact scope and actual dates while stating `28-day selected window`.
- InnerType/GB `90d` Recommendations show the same exact scope and actual dates while stating `90-day selected window`.
- Production currently has Discovery rows only from July 24–28, so identical current conclusions across the three periods are expected and are no longer misrepresented as three different amounts of available evidence.
- An invalid `period=365d` request:
  - selects `Last 28 days`;
  - assesses and labels a `28-day selected window`;
  - stores `28d` in the submitted filter value;
  - preserves InnerType/GB scope.
- App Store Connect `7d` and `90d` views:
  - show the matching selected global period;
  - label Storefront activity with the matching period;
  - contain only the InnerType/GB storefront row in the scoped table.
- Kopa Tools tests: 23 files and 79/79 tests pass.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes locally and in Vercel.
- Root repository checks: 10/10 pass.
- No production database row was mutated.
- Attribution remains deferred and no Apple Ads write capability was added.

#### Known issues

- Discovery conclusions are still dynamic read-model recommendations rather than persisted lifecycle rows.
- Discovery cards do not yet gate directional conclusions on the latest parser result, completeness state, or freshness.
- Production has only five days of current GB Discovery evidence, which is now displayed honestly inside larger selected periods.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `apps/tools/src/lib/discovery-period.ts`
- `apps/tools/src/lib/discovery-period.test.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.test.ts`
- `apps/tools/src/components/global-context-bar.tsx`
- `apps/tools/src/app/insights/page.tsx`
- `apps/tools/src/app/app-store-connect/page.tsx`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- This slice changes read boundaries and presentation only.

#### Deployment status

- Kopa Tools: live in production.
- Production/source parity for this slice: verified.
- Period, evidence-window, app-scope, market-scope, and invalid-value acceptance: passed.
- Vertical slice: complete.

#### Remaining in Milestone 1 — Trust and Data Correctness

- Gate Discovery conclusions on freshness, parser result, and completeness.
- Enforce remaining locale and metadata-version context.
- Finish shared volume, relevance, and cross-source agreement contracts.
- Unify lifecycle semantics across ASO, Discovery, and Apple Ads persistence models.
- Complete remaining authenticated owner/unauthorized-account parity checks.

#### Next exact task

Add Discovery evidence-quality gating: carry the latest App Store Connect parser result and evidence freshness into the assessment, show fresh/stale/partial/zero states explicitly, and replace directional recommendations with a waiting state whenever the scoped evidence is stale, partial, invalid, or absent.

### Checkpoint 33 — Discovery evidence-quality gating implementation

Status: locally complete and verified on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: Discovery evidence-quality gating

#### Completed

- Added a deterministic Discovery evidence-quality contract with `fresh`, `stale`, `partial`, `zero`, `invalid`, and `absent` states.
- Set an inspectable three-calendar-day product freshness threshold for current directional interpretation.
- Required verified `discovery-v2` provenance, a successful parser result, complete accepted-row counts, zero rejected rows, current evidence dates, and scoped source rows before returning `fresh`.
- Added exact app filtering to the report-quality query while retaining exact app-and-market filters on metric evidence.
- Replaced all directional Discovery opportunities with one explicit waiting recommendation whenever evidence is stale, partial, zero, invalid, or absent.
- Added the quality label to every Discovery recommendation evidence line.
- Routed blocked waiting cards to App Store Connect data quality instead of offering an experiment action.
- Added a scoped quality notice to the App Store Connect decision surface.
- Scoped App Store Connect request-quality presentation to the selected app.
- Corrected download completeness so Discovery-derived daily rows with null downloads do not masquerade as a completed sales/download import.
- Kept Discovery evidence-window dates isolated from sales-only daily rows.

#### Verified

- Kopa Tools tests: 24 files and 87/87 tests pass.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes.
- Root repository checks pass for all 10 levels.
- `git diff --check` passes.
- Fresh complete `discovery-v2` evidence within three days remains eligible for directional assessment.
- Evidence older than three calendar days becomes `stale`.
- A partial import with retained valid rows is still blocked.
- Valid zero-row reports are distinguished from zero traffic or failed conversion.
- Parser errors and unverified parser versions become `invalid`.
- Missing report provenance or missing exact-market rows becomes `absent`.
- Every non-fresh state produces one waiting card and no directional opportunity.
- Exact report-quality app filtering is applied without inventing a country filter on the app-level request.
- Production currently reports:
  - `success`;
  - parser `discovery-v2`;
  - 244/244 source rows accepted;
  - 0 rejected;
  - evidence from 2026-07-24 through 2026-07-29;
  - no parser error.
- Current production evidence should therefore remain `fresh` after deployment.
- No production data or row has been changed by this checkpoint.

#### Known issues

- The implementation has not yet been deployed to production.
- Production acceptance must confirm the current InnerType/GB feed remains directional and explicitly reports `Fresh`.
- A blocked state cannot be induced in production without corrupting or aging real evidence; deterministic regression coverage is complete.
- Discovery conclusions remain dynamic read-model recommendations rather than persisted lifecycle rows.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `apps/tools/src/lib/discovery-quality.ts`
- `apps/tools/src/lib/discovery-quality.test.ts`
- `apps/tools/src/lib/metrics.ts`
- `apps/tools/src/lib/metrics.test.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.test.ts`
- `apps/tools/src/repositories/appstore-connect-repository.ts`
- `apps/tools/src/types/domain.ts`
- `apps/tools/src/app/insights/page.tsx`
- `apps/tools/src/app/app-store-connect/page.tsx`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- Existing parser-integrity fields provide the required provenance.

#### Deployment status

- Local implementation, full verification, and production build: complete.
- Production deployment and signed-in quality-state acceptance: pending.

#### Remaining in this vertical slice

- Deploy the committed Kopa Tools source directly to production.
- Verify the signed-in InnerType/GB Recommendations and App Store Connect views show `Fresh` while preserving the current three directional Discovery conclusions.

#### Next exact task

Deploy production and complete signed-in fresh-state acceptance without mutating production evidence.

### Checkpoint 34 — Discovery evidence-quality production acceptance

Status: complete and live in production on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: Discovery evidence-quality gating

#### Completed

- Committed the verified implementation as `97d59d23` (`fix(tools): gate Discovery evidence quality`).
- Deployed that exact committed application source directly to the existing Kopa Tools production project.
- Completed signed-in acceptance against InnerType Personality Test, market GB, and the 28-day period.
- Kept the existing recommendation and App Store Connect pages; no page or navigation change was required.

#### Verified

- Production deployment `dpl_5H8ppQXsZzcWVtgD3UiXwM3a325h` is `READY` and aliased to `https://tools.kopa.studio`.
- The scoped Discovery assessment is `Fresh`.
- The production explanation states that verified `discovery-v2` evidence runs through 2026-07-29 and that all 244 source rows were accepted with none rejected.
- The request table reports `success`, parser `discovery-v2`, 244/244 rows, zero rejected rows, and evidence from 2026-07-24 through 2026-07-29.
- The exact InnerType/GB storefront table remains isolated to the selected app and market.
- Recommendations show three directional Discovery conclusions:
  - GB has weak page-view pull;
  - App Store search is the strongest discovery source;
  - product page views are rising.
- Every Discovery card shows `Data quality: Fresh`.
- The separate waiting card for download conversion remains explicit because the sales/download import is not complete.
- The recommendation evidence window is derived from stored scoped metric rows and displays 2026-07-24 through 2026-07-28; the parser-quality explanation independently preserves the full request provenance through 2026-07-29.
- No production evidence was changed to simulate stale, partial, zero, invalid, or absent states; those states are covered deterministically by tests.
- No Apple Ads resource was modified.
- Attribution remains deferred.
- Kopa Tools tests pass: 24 files, 87/87 tests.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes locally and in Vercel.
- Root repository checks pass for all 10 levels.
- `git diff --check` passes.

#### Known issues

- Discovery conclusions remain dynamic read-model recommendations rather than persisted lifecycle rows.
- Download conversion remains unavailable until the separate sales/download import produces complete scoped daily evidence.
- Parser request provenance is app-level because Apple’s report-request record has no market dimension; exact market eligibility is additionally required through stored metric rows.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `apps/tools/src/lib/discovery-quality.ts`
- `apps/tools/src/lib/discovery-quality.test.ts`
- `apps/tools/src/lib/metrics.ts`
- `apps/tools/src/lib/metrics.test.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.ts`
- `apps/tools/src/repositories/storefront-metrics-repository.test.ts`
- `apps/tools/src/repositories/appstore-connect-repository.ts`
- `apps/tools/src/types/domain.ts`
- `apps/tools/src/app/insights/page.tsx`
- `apps/tools/src/app/app-store-connect/page.tsx`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- No migration was required.

#### Deployment status

- Production deployment: complete.
- Production alias: `https://tools.kopa.studio`.
- Deployment ID: `dpl_5H8ppQXsZzcWVtgD3UiXwM3a325h`.
- Rollback: promote the previous healthy Kopa Tools deployment `dpl_FF1PxtZPFmdnvWqfD8YsWs5GGN9w`.

#### Remaining in this vertical slice

- None.
- The Discovery evidence-quality gating acceptance test passed.

#### Next exact task

Enforce metadata-version context for metadata-dependent ASO conclusions: attach the observed metadata snapshot/version and change time to each conclusion, prevent current metadata findings from being mixed with pre-change rank evidence, and prove version isolation with tests.

### Checkpoint 35 — Metadata-version evidence audit

Status: complete and verified on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: metadata-version context for ASO conclusions

#### Completed

- Read the authoritative handover, active roadmap, implementation inventory, and roadmap reconciliation.
- Traced public-store metadata collection, checksum snapshots, detected change events, owned rank snapshots, deterministic ASO rules, insight persistence, recommendation reads, and the current recommendation presentation.
- Identified the metadata-dependent rules and their current evidence boundaries.

#### Verified

- `aso_metadata_snapshots` already stores an immutable row ID, app, country, capture time, listing fields, App Store version, checksum, and source.
- `aso_metadata_change_events` stores the app, country, field/change type, old/new value, origin, and event time.
- `aso_keyword_rank_snapshots` stores exact keyword identity and capture time, so rank evidence can be isolated to a metadata-version boundary without a schema change.
- `aso_insights.evidence` is JSON and can carry the exact metadata snapshot, checksum/version, observation time, change time, and rank-evidence window.
- The current `keyword_opportunity` rule reads current app title/subtitle while allowing all recent rank snapshots, including snapshots captured before the current metadata version.
- The current `metadata_mismatch` rule compares keywords from every market against the app-level primary listing and emits a portfolio conclusion, even when no exact-country metadata snapshot exists.
- Change-response rules split ranks around a change date but do not expose the observed post-change metadata snapshot/version in their evidence.
- The recommendation repository does not read `evidence` or `comparison_window`; the page displays only the rule ID, so stored provenance is hidden from the user.
- Production currently has one owned metadata snapshot and zero detected metadata change rows. Exact-country metadata evidence remains available only for the primary US listing; GB metadata evidence remains Unknown.

#### Known issues

- Existing active ASO rows will retain their old evidence until the deterministic insight engine is run after deployment.
- A first observed metadata snapshot has an observation boundary but no earlier detected change event; presentation must state that distinction instead of inventing a change time.
- Metadata-dependent rules must not fall back from a missing market snapshot to app-wide primary metadata.

#### Files changed

- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- A migration is not required because existing immutable snapshots, timestamped ranks, change events, and JSON insight evidence can represent the complete contract.

#### Deployment status

- No deployment in this checkpoint.
- Production remained read-only.

#### Remaining in this vertical slice

- Bind metadata-dependent rules to exact-country snapshot context.
- Isolate current-metadata rank conclusions to rank snapshots captured on or after that snapshot.
- Attach snapshot/version, observation time, change time, and rank window to persisted evidence.
- Surface stored evidence and comparison windows in Recommendations.
- Add version-boundary, missing-market, and idempotency regression tests.
- Run all quality gates, deploy, recompute safely, and complete signed-in production acceptance.

#### Next exact task

Implement the deterministic metadata-version context and exact-country rank-evidence guard without adding a migration.

### Checkpoint 36 — Metadata-version context implementation

Status: locally complete, built, and fully verified on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: metadata-version context for ASO conclusions

#### Completed

- Added an exact-country metadata snapshot resolver for deterministic ASO rules.
- Added a stable metadata-version identity from the immutable snapshot ID, App Store version, checksum, and capture time.
- Linked a detected metadata change event to its snapshot only when app, country, origin, and a ten-minute collection boundary agree.
- Explicitly distinguishes first-observed metadata from a detected change instead of inventing a change time.
- Restricted current-metadata keyword opportunities to rank snapshots captured on or after the exact metadata snapshot.
- Required at least five rank observations under the current metadata version; pre-version ranks cannot satisfy that threshold.
- Bound keyword rising/decline change-response rules to the observed post-change exact-country metadata snapshot and rank window.
- Corrected the declined-after-removal rule to carry keyword priority through its deterministic evaluation.
- Replaced the portfolio metadata-mismatch comparison with exact-country conclusions only where an observed snapshot exists.
- Added metadata snapshot, version/checksum, observation time, detected change time, and version-bound rank window to persisted evidence.
- Added current-row reconciliation for metadata-versioned keyword conclusions:
  - legacy rows are refreshed in place when the current version still supports them;
  - duplicates become superseded history;
  - unsupported or no-longer-current scoped conclusions become superseded;
  - different markets remain isolated.
- Extended metadata-mismatch reconciliation to retire obsolete exact-country and legacy portfolio rows only for scopes that were actually evaluated.
- Updated the collector insight context to load immutable metadata snapshots before evaluation.
- Updated the recommendation repository and read model to retain structured evidence and comparison windows.
- Updated the existing Recommendations page to show material ASO evidence, including all metadata-version fields.

#### Verified

- Collector insight tests: 24/24 pass.
- Full collector tests: 35/35 pass.
- Kopa Tools tests: 25 files and 89/89 tests pass.
- Kopa Tools typecheck passes.
- Kopa Tools production build passes.
- Root repository checks pass for all 10 levels.
- Collector syntax validation passes.
- `git diff --check` passes.
- Five pre-version rank snapshots plus four current-version snapshots do not produce a keyword opportunity.
- The same fixture produces the opportunity after a fifth current-version rank snapshot is added.
- The emitted rank window starts at the metadata snapshot and excludes every older rank.
- A GB keyword cannot use the only available US metadata snapshot.
- Exact-country metadata mismatch output is US-scoped and carries the immutable US snapshot/version evidence.
- A detected subtitle change is linked to the post-change snapshot and exact change time.
- A first-observed snapshot without a detected change states that no change event exists.
- A legacy metadata opportunity is refreshed in place with versioned evidence instead of duplicated.
- An unsupported GB metadata finding is superseded without affecting a US scope.

#### Known issues

- Production active insights will retain their existing evidence until the collector insight engine is run after deployment.
- Production has no detected owned metadata change event, so current output must honestly show the first-observed snapshot boundary rather than a fabricated change.
- GB must continue to show no metadata-dependent ASO conclusion because no exact-country GB metadata snapshot exists.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/collect.js`
- `apps/tools/src/lib/aso-insight-evidence.ts`
- `apps/tools/src/lib/aso-insight-evidence.test.ts`
- `apps/tools/src/repositories/insight-repository.ts`
- `apps/tools/src/types/domain.ts`
- `apps/tools/src/app/insights/page.tsx`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.
- No migration is required.

#### Deployment status

- Local implementation, full verification, and production build: complete.
- Commit, deployment, recomputation, and signed-in production acceptance: pending.

#### Remaining in this vertical slice

- Commit and deploy the exact verified source.
- Run the existing safe collection/recompute flow once.
- Verify the production Recommendations feed shows versioned US metadata evidence and no borrowed GB metadata conclusion.

#### Next exact task

Run the remaining quality gates, then commit and deploy the metadata-version implementation.

### Checkpoint 37 — Metadata-version production integration recovery

Status: production integration issue diagnosed and locally fixed on 2026-07-31; recovery deployment pending.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: metadata-version context for ASO conclusions

#### Completed

- Committed the verified implementation as `e5955e19` (`fix(aso): isolate metadata-version evidence`).
- Deployed the exact commit to both production projects:
  - public collector deployment `dpl_CQywSiyLr4Z6G3LqX6sRdgCeqgds`;
  - Kopa Tools deployment `dpl_FJoybecyPiKsi4NxLHCrRujaY57F`.
- Started one owner-authenticated public-store refresh through the existing Jobs workflow.
- Diagnosed the integration failure recorded by the production job: `metadataMismatchDedupeKey is not defined`.
- Confirmed the collector referenced the existing exported identity helper but omitted it from the import list.
- Added the missing import and a collector contract regression test that verifies every metadata reconciliation identity invoked by the collector is imported.

#### Verified

- The failed production run processed the normal 54 collection items before stopping at insight reconciliation.
- Both the `apple_public` sync row and queue row correctly finished as `failed` with the exact error; no partial insight reconciliation was reported as successful.
- No App Store or Apple Ads resource was modified.
- Recovery collector tests: 36/36 pass.
- Collector syntax validation passes.
- Root repository checks pass for all 10 levels.
- `git diff --check` passes.

#### Known issues

- The recovery fix has not yet been committed or redeployed.
- Production active ASO insights still contain their prior evidence because the failed run did not complete reconciliation.
- The two failed job rows are immutable operational history and should remain visible.

#### Files changed

- `api/aso/collect.js`
- `api/aso/_lib/collect-contract.test.mjs`
- `KOPA_CURRENT_STATE.md`

#### Database changes

- None.

#### Deployment status

- Initial collector and Tools deployments: Ready.
- Production recomputation: failed honestly at insight reconciliation.
- Recovery collector deployment and rerun: pending.

#### Remaining in this vertical slice

- Commit and deploy the tested collector recovery.
- Rerun the single public-store refresh.
- Verify a successful job and exact US/GB recommendation behavior.

#### Next exact task

Deploy the missing-import recovery to the public collector, rerun once, and complete signed-in acceptance.

### Checkpoint 38 — Metadata-version production acceptance

Status: complete and live in production on 2026-07-31.

#### Current milestone

Milestone 1 — Trust and Data Correctness
Vertical slice: metadata-version context for ASO conclusions

#### Completed

- Committed the production recovery as `07f2bd55` (`fix(aso): import metadata reconciliation identity`).
- Deployed the recovery to the public collector as `dpl_D9ZJjsdy8pvTZCNhpHaGg2g7NQFe`.
- Reran the single owner-authenticated public-store refresh through the existing Jobs workflow.
- Completed signed-in US and GB recommendation acceptance.
- Left the verified US metadata evidence open in the production browser.

#### Verified

- Recovery collection completed successfully:
  - 54/54 items processed;
  - two insight rows created;
  - 50 of 131 rotating keywords covered in this run;
  - `apple_public` sync status `ok`;
  - queue status `completed`;
  - no error.
- The two earlier failed rows remain visible with their exact missing-import error as immutable operational history.
- InnerType/US ASO Recommendations show exactly one current metadata-dependent conclusion:
  - `4 high-priority US keywords are missing from the observed title and subtitle`;
  - scope is InnerType Personality Test + US;
  - observed metadata snapshot is `1bf9f40b-4eab-42fe-ac7c-043c23f00223`;
  - metadata version is `1.1.1`;
  - checksum is `da331779`;
  - metadata observation time is `2026-07-29T20:44:43.05+00:00`;
  - detected metadata change time is `2026-07-29T20:44:43.088+00:00`;
  - the comparison window states the same observed metadata-version boundary.
- InnerType/GB with source ASO shows zero active recommendations.
- GB cannot borrow the US snapshot, version, title, subtitle, or rank context.
- The former portfolio metadata mismatch was replaced by an exact-country US conclusion.
- Production evidence is shown from stored JSON rather than reduced to a rule identifier.
- No new page or navigation item was created.
- No database migration was applied.
- No Apple Ads resource was modified.
- Attribution remains deferred.
- Full collector tests pass: 36/36.
- Kopa Tools tests pass: 25 files, 89/89 tests.
- Kopa Tools typecheck and production build pass.
- Root repository checks pass for all 10 levels.

#### Known issues

- Public collection still rotates 50 of 131 keywords per run; that existing coverage limit is visible and unchanged.
- The failed integration attempt remains in operational history by design.
- Metadata snapshots currently carry country but no first-class App Store locale identifier, so language-dependent conclusions still need explicit locale integrity.
- The standalone lint command remains unavailable because the repository lacks an ESLint 9 flat configuration.

#### Files changed

- `api/aso/_lib/insights.js`
- `api/aso/_lib/insights.test.mjs`
- `api/aso/_lib/collect-contract.test.mjs`
- `api/aso/collect.js`
- `apps/tools/src/lib/aso-insight-evidence.ts`
- `apps/tools/src/lib/aso-insight-evidence.test.ts`
- `apps/tools/src/repositories/insight-repository.ts`
- `apps/tools/src/types/domain.ts`
- `apps/tools/src/app/insights/page.tsx`
- `KOPA_CURRENT_STATE.md`
- `KOPA_ACTIVE_ROADMAP.md`

#### Database changes

- None.
- Existing immutable metadata snapshots, change events, rank timestamps, and JSON insight evidence support the complete implementation.

#### Deployment status

- Kopa Tools production: `dpl_FJoybecyPiKsi4NxLHCrRujaY57F`, Ready, aliased to `https://tools.kopa.studio`.
- Public collector production: `dpl_D9ZJjsdy8pvTZCNhpHaGg2g7NQFe`, Ready, aliased to `https://www.kopa.studio`.
- Production recomputation and signed-in acceptance: passed.
- Rollback:
  - Kopa Tools: promote `dpl_5H8ppQXsZzcWVtgD3UiXwM3a325h`;
  - public collector: promote `dpl_CQywSiyLr4Z6G3LqX6sRdgCeqgds` only with the known reconciliation-import failure understood, or use the earlier healthy collector deployment from production history.

#### Remaining in this vertical slice

- None.
- The metadata-version context acceptance test passed.

#### Next exact task

Add locale-context integrity for public metadata and ASO conclusions: record the exact App Store locale when evidence provides it, require country-and-locale matches for language-dependent findings, show Unknown when locale is unavailable, and prove US/GB locale isolation with tests.

---

# Checkpoint 39 — Public metadata locale audit

## Current milestone

Trust and Data Correctness — public metadata locale-context integrity

## Completed

- Audited the Apple public-store provider, metadata collection, metadata snapshots, detected change events, tracked keyword model, deterministic metadata rules, keyword read model, Markets presentation, recommendation evidence, migrations, and current tests.
- Confirmed the public iTunes lookup is requested with an exact storefront country but does not currently return an exact App Store listing locale.
- Confirmed `languageCodesISO2A` is stored as an app-wide supported-language list and must not be treated as the locale of the returned storefront listing.
- Confirmed metadata snapshots and detected metadata change events currently store country but no first-class locale.
- Confirmed tracked keywords already have a nullable `language` field; this can be used as the keyword's explicit locale context without creating a parallel keyword-locale model.
- Confirmed current metadata-dependent rules match on country only, so a US keyword and US snapshot with different or unknown languages can currently be compared.
- Confirmed the keyword read model compares every tracked term with the app-level name/subtitle, which is not safe for language-dependent metadata conclusions.
- Confirmed the Markets read model currently verifies exact-country metadata even when the listing locale is unknown.

## Verified

- The provider's app-wide language list is not exact-locale evidence.
- Existing production-shaped metadata snapshots have no locale value, so their locale must be presented as Unknown rather than inferred from storefront country or supported languages.
- The active schema can reuse `aso_keywords.language` for explicit keyword locale context.
- Additive nullable locale columns are required on `aso_metadata_snapshots` and `aso_metadata_change_events`; existing rows can safely remain null as historical Unknown evidence.
- Language-dependent keyword opportunity, change-response, and metadata-mismatch findings must require all of:
  - the same app;
  - the same storefront country;
  - a known metadata locale;
  - a known keyword locale;
  - an exact normalized locale match.
- Country-only rank collection remains valid because App Store rank evidence is storefront-scoped; only language-dependent metadata interpretation requires the additional locale match.

## Known issues

- Current US public metadata is exact-country evidence but not exact-locale evidence.
- Current high-priority US keywords have no explicit locale context in the inspected schema path.
- Until both contexts are recorded, current metadata coverage and localization claims must remain Unknown and metadata-dependent action findings must not be emitted.

## Database changes

- None applied in this checkpoint.
- An additive migration is required to add nullable `locale` fields to metadata snapshots and detected change events. No destructive rewrite or locale backfill is justified.

## Deployment status

- Audit only; no code, schema, or production deployment changes yet.

## Remaining in this milestone

- Persist exact locale only when a provider or approved structured source explicitly supplies it.
- Expose optional keyword locale input using the existing `aso_keywords.language` field.
- Require exact country-and-locale matches in metadata-dependent deterministic rules and reconciliation.
- Make keyword metadata presence and Markets evidence display Unknown when locale is unavailable.
- Add missing-locale and US/GB locale-isolation tests.
- Run all verification gates, review/apply the migration, deploy both production projects, and complete signed-in acceptance.

## Next exact task

Implement the additive metadata-locale schema and exact country-plus-locale matching contract without inferring locale from `languageCodesISO2A`, country, or app-wide metadata.

---

# Checkpoint 40 — Exact locale contract implemented

## Current milestone

Trust and Data Correctness — public metadata locale-context integrity

## Completed

- Added an additive migration for nullable locale context on owned metadata snapshots, detected metadata change events, and persisted ASO insights.
- Preserved existing records as Unknown; no locale is backfilled or inferred.
- Updated the public provider mapper to accept only an explicit structured language-region locale and to keep `languageCodesISO2A` separate as app-wide supported-language data.
- Added locale to new owned metadata snapshots and detected metadata change events.
- Included a known exact locale in metadata snapshot identity checks while preserving legacy checksums when locale remains unavailable.
- Reused `aso_keywords.language` as the tracked keyword's explicit listing locale.
- Added optional exact-locale input and editing to the existing keyword workflow.
- Added a visible Locale column and Unknown state to Keyword Intelligence.
- Replaced app-level metadata-presence comparison with the latest exact app, country, and locale metadata snapshot; missing locale or missing matching evidence now yields Unknown.
- Required exact app, country, and locale matches for:
  - keyword opportunity findings;
  - keyword rising-after-change findings;
  - keyword decline-after-removal findings;
  - metadata mismatch findings.
- Added locale to persisted language-dependent ASO conclusions, evidence, identity, and reconciliation scope.
- Updated the migration to supersede active historical language-dependent findings whose locale context is unknown.
- Updated Markets to show the exact captured listing locale or Unknown and to require explicit locale context before verifying metadata or screenshot evidence.
- Included locale in review-pack metadata and change-event exports.

## Verified

- Provider and deterministic-rule tests pass: 30/30.
- Supported-language arrays do not become inferred locales.
- Unknown metadata locale blocks language-dependent findings.
- Unknown keyword locale blocks language-dependent findings.
- A same-country but different-locale keyword does not borrow metadata.
- US `en-US` and GB `en-GB` evidence produce isolated conclusions.
- TypeScript typecheck passes.
- `git diff --check` passes.

## Known issues

- The current public iTunes lookup does not expose an exact listing locale, so newly collected snapshots will normally continue to store locale as null unless Apple supplies an explicit structured locale.
- Existing production snapshots and keyword rows remain Unknown until an approved exact locale is recorded.
- The additive migration has not yet been applied to production.

## Database changes

- Added `supabase/migrations/20260731120000_aso_locale_context.sql`.
- The migration adds nullable `locale` columns to:
  - `aso_metadata_snapshots`;
  - `aso_metadata_change_events`;
  - `aso_insights`.
- It replaces the active metadata-mismatch identity with app + country + locale scope and supersedes unsupported active country-only language conclusions.
- No destructive data rewrite or locale backfill is included.

## Deployment status

- Implementation is local only.
- No migration or application deployment has been applied yet.

## Remaining in this milestone

- Complete focused UI and locale-evidence tests.
- Run the full Tools test suite, all collector tests, lint, typecheck, root checks, and production build.
- Review migration behavior against the production schema.
- Commit the completed slice.
- Apply the reviewed migration, deploy both production projects, and validate Unknown locale behavior plus US/GB isolation.

## Next exact task

Complete the locale-context verification suite and run every local quality gate before production migration or deployment.

---

# Checkpoint 41 — Locale-context verification complete

## Current milestone

Trust and Data Correctness — public metadata locale-context integrity

## Completed

- Added provider-contract tests for explicit locale normalization and non-inference from supported languages.
- Added metadata-checksum tests proving:
  - unknown locale preserves the legacy checksum identity;
  - a newly available exact locale creates a new immutable metadata snapshot identity;
  - different exact locales cannot share an identity.
- Added deterministic-rule tests for:
  - unknown metadata locale suppression;
  - unknown keyword locale suppression;
  - same-country/different-locale isolation;
  - independent US `en-US` and GB `en-GB` conclusions.
- Added Markets tests that keep exact-country metadata and screenshots Unknown when listing locale is unavailable.
- Added recommendation evidence tests that keep exact metadata locale visible.
- Added API validation tests for locale normalization, Unknown, and invalid language-only values.
- Ran the full local verification matrix.

## Verified

- Collector/provider/rule tests: 43 passed.
- Tools test suite: 93 passed across 25 files.
- Tools typecheck: passed.
- Tools production build: passed, including Next's lint/type validation.
- Root checks: passed across 10 levels.
- `git diff --check`: passed.
- Standalone `npm run lint`: remains unavailable because ESLint 9 is installed without a flat `eslint.config.*`; this is the documented pre-existing repository condition, not a regression in this slice.

## Known issues

- The standalone lint script remains unavailable until the repository adopts an ESLint 9 flat configuration.
- Production schema does not yet have the new nullable locale columns.
- Production currently has no approved exact-locale value for the existing public metadata snapshot or tracked keywords, so Unknown is the required post-deployment state.

## Database changes

- The additive locale migration is locally reviewed and contains:
  - three nullable columns;
  - one replacement partial unique index scoped by app, country, and locale;
  - one supporting metadata-snapshot locale index;
  - an explicit supersession update for unsupported active language-dependent findings.
- Rollback is known:
  - redeploy the prior application versions;
  - retain nullable columns safely;
  - restore the prior country-only partial index only if the old collector must run;
  - historical superseded findings remain preserved and can be reviewed, not deleted.

## Deployment status

- All local release gates that can execute in this repository pass.
- No production migration or deployment has been performed in this checkpoint.

## Remaining in this milestone

- Commit the verified implementation without including unrelated untracked files.
- Apply and inspect the additive production migration.
- Deploy the collector and Tools application to production.
- Run a production collection/reconciliation.
- Confirm:
  - existing metadata locale displays Unknown;
  - unsupported country-only language conclusions are no longer active;
  - no country or supported-language inference occurs;
  - US and GB stay isolated;
  - existing non-language-dependent Kopa functionality remains operational.

## Next exact task

Commit the verified locale-context slice, then apply the reviewed additive migration before deploying code that queries the new columns.

---

# Checkpoint 42 — Locale-context slice complete in production

## Current milestone

Trust and Data Correctness — public metadata locale-context integrity

## Completed

- Committed the verified locale-context implementation:
  - `82071a1d fix(aso): enforce exact locale context`
  - `1032bfed fix(markets): explain unknown listing locale`
- Applied `20260731120000_aso_locale_context.sql` to the production Supabase project.
- Deployed the exact committed collector source to production.
- Deployed the exact committed Tools source to production.
- Ran the normal owner-triggered public App Store collection after deployment.
- Completed signed-in acceptance on Jobs, Markets, Keywords, and Recommendations.
- Corrected one acceptance-only wording issue so the US Markets row explains that an exact-country snapshot exists while its App Store locale remains Unknown, instead of leading with an older legacy-flag warning.
- Left the unrelated support note and 2048 Run Merge screenshots untouched and outside both commits and production archives.

## Verified

- Production schema:
  - `aso_metadata_snapshots.locale` exists;
  - `aso_metadata_change_events.locale` exists;
  - `aso_insights.locale` exists.
- Migration lifecycle:
  - one unsupported active historical language-dependent finding was preserved as superseded history;
  - zero unsupported language-dependent findings remain active.
- Production source truth after collection:
  - exact-locale owned metadata snapshots: 0;
  - tracked keywords with exact locale: 0;
  - active language-dependent ASO findings: 0;
  - locale-superseded historical findings: 1;
  - latest `apple_public` sync status: `ok`.
- Production collection:
  - started Jul 31, 2026 at 07:28 GMT+2;
  - processed 54 public-source items;
  - completed in about three minutes;
  - queue job completed with no error.
- Markets acceptance:
  - US listing locale: Unknown;
  - US metadata and screenshot evidence: Unknown because the exact-country snapshot has no exact App Store locale;
  - GB listing locale: Unknown;
  - GB metadata and screenshot evidence: Unknown because no exact-country snapshot exists;
  - the app-wide supported-language list does not upgrade either market.
- Keyword Intelligence acceptance:
  - the existing page shows the Locale column;
  - all 10 current US tracked keywords show Locale `Unknown`;
  - metadata presence is `unknown`, not inferred from the app-level title/subtitle.
- Recommendations acceptance:
  - InnerType/US/source=ASO shows zero active cards;
  - InnerType/GB/source=ASO shows zero active cards;
  - the successful post-deployment collection did not recreate the unsupported country-only US metadata conclusion.
- US/GB country-and-locale isolation is covered by deterministic tests.
- No new page or navigation route was created.
- No Apple Ads write action was added or executed.
- Attribution remains deferred.
- Local release gates remain:
  - 43 collector/provider/rule tests passed;
  - 93 Tools tests passed;
  - typecheck passed;
  - production build passed;
  - root checks passed.

## Known issues

- Apple's current public iTunes lookup does not expose an exact listing locale, so public snapshots remain Unknown unless Apple supplies an explicit structured locale or another approved structured source is added.
- Current keyword locales remain Unknown until an owner records exact language-region values through the existing Keyword Intelligence workflow.
- The standalone lint script remains unavailable because the repository still lacks an ESLint 9 flat configuration; Next's production build validation passes.
- The historical 12:52 collection failure remains visible in job history as retained operational evidence; later successful runs, including the new 07:28 acceptance run, confirm recovery.

## Database changes

- Applied `supabase/migrations/20260731120000_aso_locale_context.sql`.
- Added nullable locale context to owned metadata snapshots, detected metadata change events, and ASO insights.
- Replaced the active metadata-mismatch identity with app + country + locale scope.
- Added the metadata snapshot locale lookup index.
- Preserved unsupported prior evidence as superseded history; no evidence row was deleted and no locale was backfilled.

## Deployment status

- Production collector deployment:
  - `dpl_AyqzCz587uW8GEeYTBLAmEd8uGrG`
  - alias: `https://www.kopa.studio`
- Initial production Tools deployment:
  - `dpl_5UB5e41mMsq6YfXYeSMrSecC5AbT`
- Current production Tools deployment after the acceptance wording fix:
  - `dpl_55ddgwC9buCvz7bz5tZBuehUZfo5`
  - alias: `https://tools.kopa.studio`
- Vertical slice status: complete in production.
- Acceptance test: passed.
- Rollback remains available by promoting the prior Vercel deployments; nullable database columns can remain safely, and the superseded historical insight is retained.

## Remaining in Milestone 1 — Trust and Data Correctness

- Enforce the remaining requested-period and imported evidence-window context in recommendation conclusions.
- Make freshness, completeness, evidence volume, relevance, and cross-source agreement separate visible qualities across recommendation sources.
- Continue converging recommendation identity and lifecycle across ASO, Discovery, and Apple Ads.
- Complete remaining production/source parity and authenticated-owner checks as each slice is delivered.

## Next exact task

Implement the smallest Discovery evidence-sufficiency slice for the InnerType GB feed: bind each Discovery card to its exact imported evidence window and requested period, expose freshness, completeness, and volume separately, mark stale/partial/out-of-window cards as Waiting, and prove 7-day versus 28-day isolation with tests.

---

# Checkpoint 43 — Discovery evidence-sufficiency audit

## Current milestone

Trust and Data Correctness — Discovery requested-period and imported-window integrity

## Completed

- Audited the Discovery report request, exact-market row filtering, aggregation, opportunity rules, recommendation feed mapping, App Store Connect presentation, and existing period/quality tests.
- Inspected the live InnerType GB Discovery feed for both 7-day and 28-day periods.
- Inspected the live App Store Connect source-quality view and current import provenance.
- Confirmed that the existing repository filters metric rows by the selected period and exact normalized market.
- Confirmed that the existing quality model evaluates parser success, rejected rows, scoped-row presence, and evidence-end freshness, but does not compare the requested period with the imported or observed evidence windows.

## Verified

- Current production import:
  - result: success;
  - parser: `discovery-v2`;
  - imported rows: 244 of 244;
  - rejected rows: 0;
  - imported report window: 2026-07-24 through 2026-07-29;
  - exact GB observed row window: 2026-07-24 through 2026-07-28;
  - latest GB report day: 2026-07-28.
- Current production GB evidence:
  - impressions: 2,340 in the 28-day query and 2,331 in the 7-day query;
  - product page views: 12;
  - downloads: 0 because the separate sales/download import is still unavailable.
- Current production behavior:
  - the 7-day feed labels 2026-07-25 through 2026-07-28 as a fresh 7-day selected window and exposes three directional conclusions;
  - the 28-day feed labels 2026-07-24 through 2026-07-28 as a fresh 28-day selected window and exposes three directional conclusions;
  - neither feed shows requested start/end, imported start/end, observed days, import completeness, period coverage, or evidence volume as separate qualities.
- Root cause:
  - freshness is currently a single report-level state;
  - a successful, recent import is treated as decision-ready even when it covers only part of the requested period;
  - recommendation status is derived from the opportunity rule alone, so incomplete-window conclusions are not forced to Waiting.

## Known issues

- The production 28-day Discovery cards currently draw directional conclusions from five observed GB days inside a 28-day request.
- The production 7-day and 28-day feeds are row-filtered but do not have independently assessed requested-period coverage.
- Import completeness and requested-window completeness are currently conflated under one generic data-quality label.
- Evidence volume is not displayed separately from freshness or completeness.
- Downloads remain unavailable until the separate sales/download import is implemented; zero stored downloads must continue to be shown as Waiting, not failed conversion.

## Database changes

- None.
- The existing report-request provenance and stored daily evidence contain the fields required for this slice, so no migration is justified.

## Deployment status

- Audit only; no application code or production state changed in this checkpoint.

## Remaining in this milestone

- Add a deterministic requested-period sufficiency assessment with separate freshness, import completeness, window alignment, and evidence-volume states.
- Bind the assessment to exact imported and observed evidence windows.
- Force stale, partial, out-of-window, and insufficient-volume conclusions to Waiting.
- Display the separate qualities in the existing recommendation feed and App Store Connect view.
- Prove 7-day versus 28-day isolation and all blocking states with tests.
- Run the full release gates, commit, deploy, and validate production.

## Next exact task

Implement the deterministic Discovery sufficiency model and wire it into stored-row aggregation before changing presentation.

---

# Checkpoint 44 — Discovery sufficiency model implemented

## Current milestone

Trust and Data Correctness — Discovery requested-period and imported-window integrity

## Completed

- Added a deterministic Discovery evidence-sufficiency assessment with separate:
  - freshness;
  - import completeness;
  - requested-period coverage;
  - evidence volume.
- Bound each assessment to:
  - exact requested start/end;
  - imported report start/end;
  - exact scoped observed start/end;
  - observed-day count;
  - scoped impressions, page views, and downloads.
- Added an inclusive query end so future-dated evidence cannot leak into a selected period.
- Changed opportunity generation so stale, incomplete, partial-window, out-of-window, absent, invalid, zero-row, and very-low-volume states produce one Waiting conclusion instead of directional cards.
- Updated the existing recommendation feed evidence line to show every quality dimension separately.
- Updated the existing App Store Connect page to show decision readiness, freshness, completeness, period coverage, evidence volume, and exact imported/scoped windows.
- Added a sanitized production-shaped InnerType GB fixture preserving the current daily impressions and page views.

## Verified

- Focused Discovery suite: 23 tests passed across 4 files.
- Tools typecheck: passed.
- The production-shaped fixture proves:
  - 7-day requested window: 2026-07-25 through 2026-07-31;
  - 7-day scoped evidence: 2026-07-25 through 2026-07-28;
  - 7-day totals: 2,331 impressions and 12 page views;
  - 7-day period coverage: aligned within the three-day reporting allowance;
  - 7-day decision state: ready.
  - 28-day requested window: 2026-07-04 through 2026-07-31;
  - 28-day scoped evidence: 2026-07-24 through 2026-07-28;
  - 28-day totals: 2,340 impressions and 12 page views;
  - 28-day period coverage: partial;
  - 28-day decision state: Waiting with no directional conclusion.
- Tests separately cover fresh, stale, complete, partial, out-of-window, very-low-volume, absent-market, and exact evidence formatting states.
- A future-dated fixture row is excluded by the new inclusive query end.

## Known issues

- The current imported evidence can support the 7-day feed within the configured reporting allowance but cannot support a 28-day conclusion.
- Downloads remain unavailable until the separate sales/download import exists.
- The deterministic volume thresholds are product interpretation thresholds, not claims of statistical significance.
- Production still runs the prior application version until release gates and deployment complete.

## Database changes

- None.
- Existing report provenance and metric rows are sufficient for exact requested/imported/scoped window assessment.

## Deployment status

- Implementation is local only.
- Focused tests and typecheck pass.
- Full test, build, root checks, commit, and production deployment remain.

## Remaining in this milestone

- Run the complete Tools test suite and production build.
- Run root checks and diff validation.
- Inspect the final UI output locally or through the production deployment.
- Commit without including unrelated support files.
- Deploy Tools to production and validate the exact 7-day and 28-day states.

## Next exact task

Run the complete release gates and review the final evidence presentation before committing.

---

# Checkpoint 45 — Discovery sufficiency release verified

## Current milestone

Trust and Data Correctness — Discovery requested-period and imported-window integrity

## Completed

- Completed the deterministic model, repository integration, recommendation-feed presentation, App Store Connect presentation, and production-shaped verification fixture.
- Reviewed the final evidence format so requested, imported, and scoped windows remain distinct.
- Preserved the existing navigation and existing recommendation page; no new route was created.
- Completed the full local release matrix.

## Verified

- Tools test suite: 101 tests passed across 26 files.
- Tools typecheck: passed.
- Tools production build: passed, including Next's lint/type validation.
- Root checks: passed across 10 levels.
- `git diff --check`: passed.
- Focused production-shaped acceptance remains:
  - 7-day InnerType GB evidence is aligned and decision-ready;
  - 28-day InnerType GB evidence is partial and produces one Waiting card;
  - future-dated rows are excluded;
  - stale, partial-import, out-of-window, absent, and very-low-volume evidence cannot produce directional cards.
- Import completeness remains independent from exact-market row presence: a successful 244/244 app import can be complete while a market still waits for scoped evidence.
- No Apple Ads write action or attribution behavior changed.

## Known issues

- The current 28-day production evidence is expected to change from three directional cards to one Waiting card after deployment.
- The current 7-day production evidence should remain directional while it stays inside the three-day reporting allowance; it will become stale automatically if no newer scoped evidence arrives.
- Downloads remain Waiting because the separate sales/download import is unavailable.
- Standalone `npm run lint` remains unavailable because the repository still lacks an ESLint 9 flat configuration; Next's production build validation passes.

## Database changes

- None.

## Deployment status

- All local release gates pass.
- The implementation is ready to commit and deploy to the existing `kopa-tools` production project.
- Rollback is available by promoting the prior Tools production deployment; there is no database rollback.

## Remaining in this milestone

- Commit the verified slice without unrelated untracked files.
- Deploy the committed Tools source to production.
- Validate the signed-in 7-day and 28-day InnerType GB recommendation feeds and App Store Connect quality view.
- Record the production deployment ID and final acceptance result.

## Next exact task

Commit the verified Discovery sufficiency slice and deploy that exact source to the existing Tools production project.

---

# Checkpoint 46 — Discovery evidence-sufficiency slice complete in production

## Current milestone

Trust and Data Correctness — Discovery requested-period and imported-window integrity

## Completed

- Committed the verified Discovery sufficiency implementation:
  - `374dcd9c fix(discovery): enforce evidence sufficiency`
- Deployed the committed implementation to the existing Tools production project.
- Completed signed-in production acceptance on the 7-day and 28-day InnerType GB Discovery feeds and the App Store Connect source-quality view.
- Corrected one acceptance-only wording issue so the `Waiting for download import` card points to the separate sales/download import rather than asking for another Discovery refresh:
  - `3b6ba3da fix(discovery): clarify download waiting action`
- Deployed the acceptance fix and repeated signed-in verification.
- Left the unrelated support note and 2048 Run Merge screenshots untracked and outside both Tools deployments.

## Verified

- Production 28-day InnerType GB Discovery feed:
  - exactly one card is shown;
  - status: Waiting;
  - title: `Discovery evidence only partially covers the requested period`;
  - requested window: 2026-07-04 through 2026-07-31;
  - imported window: 2026-07-24 through 2026-07-29;
  - exact GB scoped window: 2026-07-24 through 2026-07-28;
  - observed days: 5;
  - freshness: Fresh;
  - completeness: Complete import, 244/244 rows, 0 rejected;
  - period coverage: Partial coverage;
  - evidence volume: Meaningful, 2,340 impressions and 12 page views;
  - no directional Discovery conclusion is shown.
- Production 7-day InnerType GB Discovery feed:
  - requested window: 2026-07-25 through 2026-07-31;
  - exact GB scoped window: 2026-07-25 through 2026-07-28;
  - observed days: 4;
  - period coverage: Aligned within the configured reporting allowance;
  - evidence volume: Meaningful, 2,331 impressions and 12 page views;
  - the existing deterministic page-pull, source, and trend conclusions remain visible;
  - download conversion remains Waiting;
  - the download card now says to complete the separate sales/download import before judging product-page conversion.
- Production App Store Connect view:
  - overall scoped state: Waiting for the 28-day request;
  - Freshness, Completeness, Period coverage, and Evidence volume are separate visible cards;
  - imported and exact GB scoped windows are shown separately;
  - the decision brief contains one Waiting signal, not the prior three directional conclusions.
- Final local gates after the acceptance fix:
  - 101 Tools tests passed across 26 files;
  - typecheck passed;
  - production build passed;
  - root checks passed across 10 levels;
  - diff validation passed.
- No Apple Ads provider resource was modified.
- No Apple Ads write action was added.
- Attribution remains deferred.
- No new page or navigation route was created.

## Known issues

- The 7-day Discovery feed will become stale automatically if no newer exact GB evidence arrives; this is intended.
- The 28-day feed will remain Waiting until an import covers the requested decision window.
- Downloads remain unavailable until the separate sales/download import exists.
- The Sources page still surfaces the retained historical public-collection failure even though later public collection runs succeeded; this pre-existing status-selection behavior was not changed in this slice.
- Standalone `npm run lint` remains unavailable because the repository lacks an ESLint 9 flat configuration; Next's production build validation passes.

## Database changes

- None.

## Deployment status

- Initial Tools production deployment:
  - `dpl_6fgfmYvJuKPLQTR5CCG293naXDZL`
- Current Tools production deployment after the acceptance wording fix:
  - `dpl_A3cYLxXVpUj4r4rosNvVWonPsoQV`
  - alias: `https://tools.kopa.studio`
- The repository-root deployment command first resolved to the public collector project and redeployed unchanged collector source:
  - `dpl_4YN25uaAk61mWwrfgDVCSmUvyWu2`
  - alias: `https://www.kopa.studio`
  - no collector code, schema, job configuration, or provider write behavior changed.
- Vertical slice status: complete in production.
- Acceptance test: passed.
- Rollback is available by promoting Tools deployment `dpl_55ddgwC9buCvz7bz5tZBuehUZfo5`; no database rollback is required.

## Remaining in Milestone 1 — Trust and Data Correctness

- Add relevance and cross-source agreement as separate, exact-window qualities without allowing one source to borrow another source's confidence.
- Converge recommendation dedupe identity and lifecycle across ASO, Discovery, and Apple Ads.
- Correct the source-status selection that lets an older retained public-collection failure override a later successful run.
- Continue production/source parity and authenticated-owner verification as each slice is delivered.

## Next exact task

Implement the smallest read-only cross-source agreement slice for InnerType GB: compare only exact-market, overlapping-window Discovery and Apple Ads evidence, display Agreement, Conflict, or Unknown separately on the existing recommendation feed, and keep action eligibility unchanged when the windows do not align.

---

# Checkpoint 47 — Cross-source agreement audit

## Current milestone

Trust and Data Correctness — exact-window cross-source agreement

## Completed

- Audited the live InnerType GB Discovery and Apple Ads evidence, exact windows, quality fields, recommendation types, and unified feed presentation.
- Identified the smallest shared decision questions that both sources can answer independently:
  - whether acquisition traffic quality needs review;
  - whether conversion can currently be judged.
- Confirmed that cross-source agreement can be computed read-only in the existing recommendation feed without a new page, provider action, persistence model, or migration.

## Verified

- Current production Discovery:
  - 7-day requested window: 2026-07-25 through 2026-07-31;
  - exact GB observed window: 2026-07-25 through 2026-07-28;
  - 2,331 impressions and 12 page views;
  - 0.5% impression-to-page-view rate;
  - no sales/download evidence, so conversion remains unjudged.
- Current production Apple Ads:
  - exact GB evidence window: 2026-07-20 through 2026-07-30;
  - 579 campaign impressions, 5 taps, 0 installs, and €2.3623 campaign spend;
  - traffic quality: Poor;
  - conversion evidence: Insufficient;
  - stored recommendations contain explicit irrelevant-term findings and one continue-learning finding for relevant `personality test`.
- Exact overlap:
  - 7-day Discovery versus Apple Ads: 2026-07-25 through 2026-07-28;
  - 28-day scoped Discovery versus Apple Ads: 2026-07-24 through 2026-07-28.
- The current exact-window evidence independently agrees that:
  - acquisition traffic quality needs review;
  - conversion should not yet be judged.

## Known issues

- The recommendation feed currently exposes each source independently and has no separate Agreement, Conflict, or Unknown quality.
- Apple Ads recommendations are persisted against their own evidence window and are not re-windowed by the feed period selector; comparison must use the intersection of actual source windows.
- A source filter must not hide the other source from the read-only comparison calculation.
- Cross-source context must not raise confidence, change status, make a card actionable, or suppress a source-specific recommendation.
- Portfolio, missing-market, different-market, missing-window, and non-overlapping-window evidence must remain Unknown.

## Database changes

- None.
- Existing stored recommendation windows and Discovery scoped windows are sufficient.

## Deployment status

- Audit only; no code or production state changed in this checkpoint.

## Remaining in this milestone

- Add a deterministic exact-scope/window agreement model.
- Derive independent traffic-quality and conversion-readiness signals from each source.
- Display Agreement, Conflict, or Unknown separately on the existing recommendation cards.
- Prove app, market, window, source-filter, conflict, and unknown isolation with tests.
- Run release gates, commit, deploy, and complete signed-in production acceptance.

## Next exact task

Implement the pure cross-source agreement model and feed mapping without changing recommendation actionability or status.

---

# Checkpoint 48 — Cross-source agreement model implemented

## Current milestone

Trust and Data Correctness — exact-window cross-source agreement

## Completed

- Added a deterministic cross-source agreement model with explicit `Agreement`, `Conflict`, and `Unknown` states.
- Added independent source adapters for:
  - Discovery traffic quality and conversion readiness;
  - Apple Ads traffic relevance and conversion sufficiency.
- Added exact app and normalized market matching.
- Added actual-window intersection; selected-period labels are never substituted for source evidence windows.
- Added a separate cross-source agreement line to the existing recommendation cards.
- Kept cross-source calculation ahead of presentation source filtering so selecting only Discovery or only Apple Ads does not erase comparison context.
- Kept status, priority, confidence, risk, source-specific evidence, and actionability unchanged.

## Verified

- Focused cross-source, Discovery sufficiency, and Apple Ads assessment suite: 27 tests passed.
- Tools typecheck: passed.
- Production-shaped model result:
  - state: Agreement;
  - exact app: InnerType;
  - exact market: GB;
  - overlap: 2026-07-25 through 2026-07-28 for the 7-day Discovery scope;
  - shared traffic conclusion: acquisition traffic quality needs review;
  - shared conversion conclusion: conversion should not yet be judged.
- Isolation tests prove Unknown for:
  - different apps;
  - different markets;
  - missing market;
  - missing source window;
  - non-overlapping windows;
  - overlapping windows with no independently supported shared question;
  - multiple Apple Ads evidence windows in one exact scope.
- Conflict tests preserve both independent conclusions and explicitly tell the user to keep them separate.
- Stale or very-low Discovery evidence cannot contribute a comparison signal.
- Apple Ads rows from another storefront do not contribute a comparison signal.

## Known issues

- Cross-source agreement is currently computed at exact app/market feed scope and is not persisted.
- Agreement is supporting context only; it does not create a new recommendation or increase source confidence.
- The current comparison covers the two shared questions supported by both sources; it does not invent agreement for rank, metadata, bid, budget, or product-fit questions that only one source can answer.
- Full release gates and production acceptance remain.

## Database changes

- None.

## Deployment status

- Implementation is local only.
- Focused tests and typecheck pass.

## Remaining in this milestone

- Run the full Tools suite, production build, root checks, and diff validation.
- Commit only the cross-source slice and current-state checkpoints.
- Deploy the exact committed Tools source.
- Validate signed-in Agreement on both source-filtered feed views.
- Validate Unknown when exact scope or overlapping windows are unavailable.
- Record final production acceptance and one next task.

## Next exact task

Run the full release gates and inspect the final diff before committing.

---

# Checkpoint 49 — Cross-source agreement release verified

## Current milestone

Trust and Data Correctness — exact-window cross-source agreement

## Completed

- Completed the deterministic model, exact-scope/window adapters, existing-feed presentation, and production-shaped tests.
- Reviewed the final diff to confirm that cross-source context is additive presentation only.
- Preserved all source-specific recommendation statuses, confidence values, priorities, evidence, and follow-up actions.
- Completed the full local release matrix.

## Verified

- Tools test suite: 113 tests passed across 27 files.
- Tools typecheck: passed.
- Tools production build: passed, including Next's lint/type validation.
- Root checks: passed across 10 levels.
- `git diff --check`: passed.
- Agreement requires:
  - identical non-null app;
  - identical non-null market;
  - explicit valid windows for both sources;
  - at least one overlapping date;
  - at least one independently supported shared decision question.
- Conflict remains advisory context and explicitly preserves the separate source conclusions.
- Unknown is shown rather than inferred agreement for incomplete scope, missing or multiple windows, non-overlap, or no shared comparable question.
- Presentation source filters are applied after the agreement assessment, so `source=Discovery` and `source=Apple Ads` retain the same exact-scope comparison.
- No database, Apple Ads provider, campaign, attribution, navigation, or persistence behavior changed.

## Known issues

- Production still runs the prior Tools version until deployment.
- Cross-source agreement is intentionally not a deduplication or recommendation-lifecycle mechanism.
- Standalone `npm run lint` remains unavailable because the repository lacks an ESLint 9 flat configuration; Next's production build validation passes.

## Database changes

- None.

## Deployment status

- All local release gates pass.
- The implementation is ready to commit and deploy to the existing `kopa-tools` production project.
- Rollback is available by promoting the prior Tools deployment; there is no database rollback.

## Remaining in this milestone

- Commit without unrelated support files.
- Deploy the exact committed source archive to the Tools project.
- Validate signed-in Agreement on:
  - the Discovery-filtered InnerType GB feed;
  - the Apple Ads-filtered InnerType GB feed.
- Validate Unknown without exact market scope.
- Confirm recommendation counts, statuses, confidence, and actions remain unchanged.
- Record final acceptance and exactly one next task.

## Next exact task

Commit and deploy the verified cross-source agreement slice, then complete signed-in production acceptance.

---

# Checkpoint 50 — Cross-source agreement slice complete in production

## Current milestone

Trust and Data Correctness — exact-window cross-source agreement

## Completed

- Committed the verified exact-scope/window agreement implementation:
  - `00d0eaba feat(recommendations): show cross-source agreement`
- Deployed the exact committed Tools source to production.
- Completed signed-in acceptance on Discovery-filtered, Apple Ads-filtered, and missing-market feed states.
- Corrected one acceptance-only clarity issue so scope-level Agreement cannot be mistaken for validation of an individual keyword or search-term target:
  - `652e7b2c fix(recommendations): clarify agreement scope`
- Re-ran the full release matrix, deployed the clarification, and repeated signed-in acceptance.
- Left unrelated support files and 2048 Run Merge screenshots untouched and outside both production archives.

## Verified

- Production InnerType/GB/7-day Discovery-filtered feed:
  - 4 existing cards remain;
  - each shows Agreement;
  - compared overlap: 2026-07-25 through 2026-07-28;
  - shared scope conclusions:
    - acquisition traffic quality needs review;
    - conversion should not yet be judged;
  - source-specific status, confidence, evidence, risk, and follow-up remain unchanged.
- Production InnerType/GB/7-day Apple Ads-filtered feed:
  - 5 existing cards remain;
  - each shows the same Agreement and exact overlap even though Discovery cards are filtered out of presentation;
  - `lovense`, `lovense remote`, and `y not` remain exact-negative proposals;
  - `personality test` remains Continue learning;
  - campaign conversion remains Insufficient;
  - no card became executable and no provider write occurred.
- Production missing-market state:
  - Cross-source agreement displays Unknown;
  - explanation: the sources do not have the same exact market scope;
  - no portfolio or app-wide inference upgrades the state.
- Final scope guard:
  - Agreement and Conflict text states that the comparison is app/market scope context;
  - it explicitly does not validate the card's specific target or change action eligibility.
- Final local release gates:
  - 113 Tools tests passed across 27 files;
  - typecheck passed;
  - production build passed;
  - root checks passed across 10 levels;
  - diff validation passed.
- No database change, Apple Ads campaign mutation, attribution work, new page, or navigation change occurred.

## Known issues

- Cross-source agreement is read-only feed context and is not persisted.
- Current agreement covers only shared traffic-quality and conversion-readiness questions.
- The Sources page still lets an older retained public-collection failure visually override a later successful run.
- Recommendation identity and lifecycle are not yet unified across ASO, Discovery, and Apple Ads.
- Standalone `npm run lint` remains unavailable because the repository lacks an ESLint 9 flat configuration; Next's production build validation passes.

## Database changes

- None.

## Deployment status

- Initial cross-source Tools production deployment:
  - `dpl_AQxKDHvLyCKApqu2bgnoXyfKCc91`
- Current Tools production deployment after the scope-clarity fix:
  - `dpl_HtMV4CvgUAxm5GT5WPRGNf8HWzb6`
  - alias: `https://tools.kopa.studio`
- Vertical slice status: complete in production.
- Acceptance test: passed.
- Rollback is available by promoting Tools deployment `dpl_A3cYLxXVpUj4r4rosNvVWonPsoQV`; no database rollback is required.

## Remaining in Milestone 1 — Trust and Data Correctness

- Correct source-status recency so an older retained failure cannot override a later successful run.
- Converge recommendation dedupe identity and lifecycle across ASO, Discovery, and Apple Ads.
- Complete final production/source parity and authenticated-owner verification.

## Next exact task

Correct the Public App Store source-status recency rule: derive current status from the latest relevant collection outcome, retain older failures as history without presenting the source as currently failed, and prove success-after-failure plus failure-after-success behavior with tests.

---

# Checkpoint 51 — Public source-status recency audit

## Current milestone

Trust and Data Correctness — current source-status integrity

## Completed

- Audited the public collection run repository, run ordering, collection-history presentation, and Sources page status derivation.
- Inspected the signed-in production collection history and current Sources status.
- Confirmed that the stored run history is correctly ordered and retained; the defect is limited to current-status selection.

## Verified

- Production public collection history:
  - latest run: 2026-07-31 07:28 Europe/Berlin;
  - latest run status: `ok`;
  - latest run processed: 54 records;
  - prior failure: 2026-07-31 00:52 Europe/Berlin;
  - prior failure: `metadataMismatchDedupeKey is not defined`;
  - recovery runs: successful at 00:57 and again at 07:28.
- Production Jobs page correctly retains and orders the failed run between later and earlier successful history.
- Production Sources page incorrectly shows Public App Store as `error`.
- Root cause:
  - `latestPublicRun` correctly selects the newest run;
  - `failedPublicRun` independently finds any failed or partial run in visible history;
  - current source status becomes error whenever that historical failure exists, regardless of later success.

## Known issues

- Current status, current freshness, and historical failure are not modeled as separate concepts.
- A running newest collection needs a Waiting state while the last successful data timestamp remains visible.
- A newest partial or failed collection must remain Error even if an older success exists.
- Historical failure detail should remain visible after recovery without marking the source currently failed.

## Database changes

- None.
- Stored run ordering and history are already sufficient.

## Deployment status

- Audit only; no code or production state changed in this checkpoint.

## Remaining in this milestone

- Add a deterministic public source-status resolver.
- Separate current outcome, last successful freshness, and most recent failure history.
- Prove success-after-failure, failure-after-success, partial, running, empty, unrelated-provider, and input-order behavior.
- Integrate the resolver into the existing Sources page.
- Run release gates, commit, deploy, and complete signed-in production acceptance.

## Next exact task

Implement the pure current-status resolver and replace the Sources page's any-failure logic.

---

# Checkpoint 52 — Public source-status resolver implemented

## Current milestone

Trust and Data Correctness — current source-status integrity

## Completed

- Added a deterministic Public App Store source-status resolver.
- Filtered current status to relevant `apple_public` runs only.
- Sorted by stored run time rather than trusting caller order.
- Separated:
  - current collection outcome;
  - last successful data freshness;
  - most recent failed or partial run;
  - whether that failure was recovered by a later success.
- Replaced the Sources page's any-failure logic with the resolver.
- Kept the prior failure visible in `Last failure` and added an explicit recovery label after later success.

## Verified

- Focused status suite: 6 tests passed.
- Tools typecheck: passed.
- Tests prove:
  - success after failure produces Configured and retains recovered failure history;
  - failure after success produces Error and retains older successful freshness;
  - partial after success produces Error;
  - running after success produces Waiting and retains last successful freshness;
  - empty or unrelated-provider history produces Waiting;
  - input order cannot change the selected current run.
- No run row is updated, deleted, hidden from Jobs history, or reclassified.

## Known issues

- Production still runs the prior any-failure presentation until deployment.
- The Sources page uses the ten most recent stored public sync runs supplied by the existing repository.
- Full release gates and production acceptance remain.

## Database changes

- None.

## Deployment status

- Implementation is local only.
- Focused tests and typecheck pass.

## Remaining in this milestone

- Run the full Tools test suite, production build, root checks, and diff validation.
- Commit only the source-status slice and checkpoints.
- Deploy the exact committed Tools source.
- Confirm production Public App Store becomes Configured with Jul 31 07:28 freshness.
- Confirm the 00:52 failure remains visible as recovered history.
- Confirm Jobs history is unchanged.

## Next exact task

Run the full release gates and review the status presentation before committing.

---

# Checkpoint 53 — Public source-status release gates passed

## Current milestone

Trust and Data Correctness — current source-status integrity

## Completed

- Reviewed the complete source-status change set.
- Ran the full Tools verification suite and production build.
- Ran the root repository integrity check and whitespace validation.
- Confirmed the release contains only the resolver, its tests, the existing Sources-page integration, and milestone handover updates.

## Verified

- Tools tests: 119 passed across 28 files.
- Tools typecheck: passed.
- Tools production build: passed.
- Root repository check: passed across 10 levels.
- `git diff --check`: passed.
- The resolver has no persistence side effects and does not modify collection history.
- The Public App Store presentation uses:
  - the latest relevant run for current status;
  - the latest successful run for freshness;
  - the latest failed or partial run for historical failure detail;
  - an explicit recovered label when a later successful run exists.

## Known issues

- Production still shows the superseded any-history-failed status until this commit is deployed.
- Signed-in production acceptance remains required.

## Database changes

- None.

## Deployment status

- Release gates passed.
- Ready to commit and deploy the exact committed Tools source.

## Remaining in this milestone

- Commit the verified source-status slice.
- Deploy the exact commit to the production Tools project.
- Verify Public App Store is Configured after the latest successful run.
- Verify the older failure remains visible as recovered history.
- Verify Jobs history remains unchanged.

## Next exact task

Commit, deploy, and complete signed-in production acceptance.

---

# Checkpoint 54 — Public source-status recency complete in production

## Current milestone

Trust and Data Correctness — current source-status integrity

## Completed

- Committed the verified source-status recency slice as `174cdffd`.
- Deployed an archive of that exact commit to the production Kopa Tools Vercel project.
- Completed signed-in acceptance on the production Sources and Jobs pages.
- Corrected the production Public App Store status from historical-failure Error to latest-outcome Configured.
- Preserved the prior failure as recovered history.

## Verified

- Production deployment: `dpl_CZevziakzGwDgQwCmZhnpuDQK829`.
- Production alias: `https://tools.kopa.studio`.
- Sources page:
  - Public App Store status is `configured`;
  - freshness comes from the latest successful run;
  - the prior `metadataMismatchDedupeKey is not defined` failure remains visible;
  - the prior failure is explicitly labelled `Recovered by a later successful run`.
- Jobs page:
  - latest public run remains Jul 31, 2026 07:28 Europe/Berlin, `ok`, 54 records;
  - successful recovery at 00:57 remains visible;
  - the 00:52 failed run remains visible and unchanged;
  - no collection history was modified or hidden.
- Release gates:
  - 119 tests passed across 28 files;
  - typecheck passed;
  - production build passed;
  - root repository check passed;
  - whitespace validation passed.
- No database migration was required.
- No collection provider behavior, recommendation logic, Apple Ads write behavior, or attribution behavior changed.

## Known issues

- The Sources page date helper renders server-locale timestamps without the explicit Europe/Berlin suffix used on the Jobs page; the selected stored run is correct.
- The current-status resolver operates on the ten most recent sync runs returned by the existing overview repository.

## Database changes

- None.

## Deployment status

- Complete and live in production.
- Production acceptance passed.

## Remaining in this milestone

- Converge stable recommendation identity and repeated-generation idempotency across the existing ASO, Discovery, and Apple Ads recommendation paths.
- Complete final production/source parity and authenticated-owner verification after that convergence.

## Next exact task

Implement deterministic cross-source recommendation identity for the InnerType GB feed so unchanged ASO, Discovery, and Apple Ads conclusions retain one stable identity across reloads and recomputes, without changing recommendation lifecycle actions.

---

# Checkpoint 55 — Cross-source recommendation identity audit

## Current milestone

Trust and Data Correctness — stable recommendation identity

## Completed

- Audited recommendation generation, persistence, feed mapping, and rendering for ASO, Discovery, and Apple Ads.
- Compared the existing deduplication contracts with the active-roadmap requirement for one stable conclusion identity.
- Confirmed that lifecycle actions must continue using the stored ASO insight row ID and are outside this slice.

## Verified

- ASO:
  - stores recommendations in `aso_insights`;
  - uses rule-specific `dedupe_key` values;
  - retains a stable row ID for unchanged dedupe keys;
  - exposes only the row ID to the combined feed.
- Apple Ads:
  - stores recommendations and immutable evidence snapshots;
  - currently includes evidence window and rule version in `dedupe_key`;
  - therefore treats the same scoped action over a later reporting window as a new recommendation row instead of updated evidence for one conclusion.
- Discovery:
  - is derived read-only during the Recommendations-page load;
  - is not persisted;
  - currently builds its feed ID from period, array position, and title;
  - therefore reordering otherwise unchanged opportunities can change their identity.
- The React feed key is currently a source plus provider-specific row/derived ID, not one common identity contract.
- Evidence fingerprints are already separate from Apple Ads dedupe keys, but do not currently include rule version.

## Known issues

- The three sources do not share normalized app, market, conclusion-kind, and target semantics.
- Discovery needs a stable semantic opportunity kind rather than array position.
- Apple Ads evidence-window movement must update evidence under the same conclusion identity.
- Existing persisted Apple Ads hash keys will transition once to the new stable contract on the first recompute, after which unchanged recomputes remain idempotent.

## Database changes

- None planned.
- Existing Apple Ads `dedupe_key` uniqueness and evidence fingerprint fields can support stable identity without a migration.
- Existing ASO dedupe and lifecycle storage remain intact.

## Deployment status

- Audit only; production is unchanged.

## Remaining in this milestone

- Add one deterministic identity builder shared by all three feed sources.
- Give Discovery opportunities stable semantic kinds.
- Remove evidence window and rule version from Apple Ads conclusion identity while retaining them in evidence fingerprinting.
- Keep stored row IDs separate for ASO lifecycle actions.
- Add identity normalization, scope isolation, target isolation, reordered Discovery, and advancing-window Apple Ads tests.
- Run release gates, deploy, recompute twice, and verify the active feed remains stable.

## Next exact task

Implement the shared identity contract and focused regression tests.

---

# Checkpoint 56 — Shared recommendation identity implemented

## Current milestone

Trust and Data Correctness — stable recommendation identity

## Completed

- Added one versioned deterministic recommendation identity builder for ASO, Discovery, and Apple Ads.
- Normalized source, app, market, locale, conclusion kind, target type, target resource, and target text before hashing.
- Added stable semantic kinds to every Discovery opportunity.
- Removed Discovery period and array position from feed identity.
- Separated the common feed identity from the stored ASO row ID used by lifecycle actions.
- Updated Apple Ads persistence identity to exclude evidence window and rule version.
- Added Apple Ads rule version to the evidence fingerprint so changed calculation provenance still refreshes the immutable snapshot and stored evidence.
- Updated the combined Recommendations feed to use the shared identity as its render key.

## Verified

- Focused suites: 13 tests passed across 3 files.
- Tools typecheck: passed.
- Tests prove:
  - equivalent case and whitespace normalize to one identity;
  - source, app, market, conclusion kind, and target remain isolated;
  - reordered Discovery conclusions retain the same identity set;
  - an advancing Apple Ads evidence window retains conclusion identity;
  - a changed evidence window changes the evidence fingerprint;
  - a changed Apple Ads rule version retains conclusion identity but changes the evidence fingerprint;
  - the six current Apple Ads conclusions remain six distinct identities.
- Only the combined Recommendations page constructs `RecommendationFeedItem` records, so every source now supplies the required identity.
- ASO lifecycle API calls still use the persisted `aso_insights.id`; no lifecycle behavior changed.

## Known issues

- Existing active Apple Ads rows use the previous window-bound hash and will transition once on the first production recompute.
- Discovery remains intentionally derived and read-only rather than persisted.
- Full release gates and production repeat-run acceptance remain.

## Database changes

- None.
- Existing columns and indexes support the new contract.

## Deployment status

- Implementation is local only.
- Focused tests and typecheck pass.

## Remaining in this milestone

- Run the full Tools and repository release gates.
- Commit and deploy the exact verified source.
- Recompute Apple Ads once to transition legacy identity keys.
- Recompute again and confirm all six conclusions are unchanged rather than inserted or duplicated.
- Verify the InnerType GB feed retains the same ASO, Discovery, and Apple Ads conclusions across reloads.

## Next exact task

Run the full release gates and review the final identity diff.

---

# Checkpoint 57 — Recommendation identity release gates passed

## Current milestone

Trust and Data Correctness — stable recommendation identity

## Completed

- Reviewed the final shared identity, provider mapping, persistence, and test changes.
- Added a non-visual identity attribute to recommendation cards so signed-in acceptance can compare exact feed identities across reloads.
- Broadened Apple Ads stale-row reconciliation across rule versions within the same exact connection, app, campaign, and storefront scope.
- Ran the complete Tools and root repository release gates after the final changes.

## Verified

- Tools tests: 124 passed across 29 files.
- Tools typecheck: passed.
- Tools production build: passed.
- Root repository check: passed across 10 levels.
- `git diff --check`: passed.
- Existing unrelated 2048 Run Merge files remain untracked and outside this slice.
- No Apple Ads provider mutation method or write route was added.
- Attribution remains unchanged and deferred.

## Known issues

- The first production recompute is an intentional one-time identity transition for existing Apple Ads rows.
- Signed-in repeat-run acceptance remains required after deployment.

## Database changes

- None.

## Deployment status

- Release gates passed.
- Ready to commit and deploy the exact verified source.

## Remaining in this milestone

- Commit the verified identity slice.
- Deploy the exact commit to production.
- Capture the scoped feed identities.
- Recompute Apple Ads twice.
- Confirm the second run creates no duplicate active recommendations and the feed identity set remains unchanged across reloads.
- Update the active roadmap and final handover.

## Next exact task

Commit, deploy, and complete signed-in repeat-run acceptance.

---

# Checkpoint 58 — Cross-source recommendation identity complete in production

## Current milestone

Trust and Data Correctness — stable recommendation identity

## Completed

- Committed the verified identity slice as `e64eca4f`.
- Deployed an archive of that exact commit to the production Kopa Tools project.
- Completed signed-in owner acceptance on the InnerType/GB Recommendations feed and Apple Ads recommendation page.
- Performed the intentional one-time Apple Ads identity transition.
- Performed a second unchanged recompute.
- Compared exact versioned card identities after recompute and after a full page reload.
- Updated the active roadmap with the production completion status.

## Verified

- Production deployment: `dpl_7XRfjjFuy5euYmYWzdpVL57Dnsbb`.
- Production alias: `https://tools.kopa.studio`.
- First owner recompute:
  - 5 active Apple Ads recommendations;
  - 5 new;
  - 0 refreshed;
  - 0 unchanged;
  - this was the expected one-time migration from window-bound legacy hashes.
- Second owner recompute:
  - 5 active Apple Ads recommendations;
  - 0 new;
  - 0 refreshed;
  - 5 unchanged.
- InnerType/GB/28-day feed:
  - 6 total scoped cards;
  - 5 Apple Ads conclusions;
  - 1 Discovery evidence-sufficiency conclusion;
  - 0 active ASO conclusions because exact-locale-dependent GB evidence remains unavailable;
  - every title-to-identity pair remained exactly unchanged after reload.
- Current Apple Ads conclusions:
  - exclude `y not`;
  - exclude `lovense remote`;
  - exclude `lovense`;
  - continue learning on `personality test`;
  - conversion evidence is insufficient at 5 taps and 0 installs.
- The prior broad `relationship test` review is correctly absent from the current assessment:
  - the broad `relationship test` keyword is now Paused;
  - the current enabled `relationship test` keyword is Exact;
  - the rule correctly does not recommend reviewing or pausing an already-paused broad target.
- Release gates:
  - 124 tests passed across 29 files;
  - typecheck passed;
  - production build passed;
  - root repository check passed;
  - whitespace validation passed.
- No Apple Ads campaign, ad group, keyword, negative, bid, or budget resource was modified.
- Attribution remains deferred.

## Known issues

- Discovery remains derived read-only rather than persisted; its stable semantic identity is now deterministic at the product-feed boundary.
- The active roadmap still requires final production/source parity and access-boundary verification before Milestone 1 can exit.

## Database changes

- None.

## Deployment status

- Complete and live in production.
- Signed-in repeat-run acceptance passed.

## Remaining in this milestone

- Complete the final production/source parity check for the deployed Tools application.
- Record authenticated-owner and unauthorized-account behavior.
- Reconcile the final Milestone 1 exit criteria against current production evidence.

## Next exact task

Complete the final Milestone 1 production/source parity and access-boundary acceptance, including documented owner and unauthorized-account behavior, without making additional product changes unless the audit finds a concrete blocker.

---

# Checkpoint 59 — Milestone 1 parity and access-boundary audit

## Current milestone

Trust and Data Correctness — milestone exit acceptance

## Completed

- Audited the deployed-source record, authenticated page guard, owner-only API guard, login callback, middleware session refresh, and unauthorized page.
- Compared the production code commit with repository HEAD.
- Performed a read-only aggregate audit of production authentication users and approved memberships.

## Verified

- The production product-code deployment was built from exact commit `e64eca4f`.
- Repository HEAD differs from that product commit only by the documentation-only acceptance commit `e5d90f92`; there is no undeployed Tools code.
- Protected pages call `requireUser`.
- Owner-only mutation routes call `requireOwner`.
- `requireUser`:
  - redirects a missing session to `/login`;
  - checks the signed-in user ID against `analytics_admins`;
  - fails closed to `/unauthorized` on membership lookup error or missing membership.
- The unauthorized page states that the signed-in account is not approved.
- Production aggregate access state:
  - 1 auth user;
  - 1 approved membership;
  - 0 non-member auth users.

## Known issues

- Production has no existing non-member auth account, so a real signed-in unauthorized-account redirect cannot be exercised without creating or changing an account.
- Creating a disposable production auth user would be an unnecessary access-control mutation and is outside this read-only acceptance task.
- There are no automated regression tests for the login/allowlist/fail-closed access decision.

## Database changes

- None.
- No user or membership record was created, changed, or deleted.

## Deployment status

- Audit only in this checkpoint.
- Production remains on `dpl_7XRfjjFuy5euYmYWzdpVL57Dnsbb`.

## Remaining in this milestone

- Add pure regression tests for unauthenticated, approved-member, non-member, and membership-error decisions without changing production behavior.
- Verify the unauthenticated production redirect.
- Reconfirm signed-in owner access and deployed feature fingerprints.
- Inspect the production deployment record.
- Run final release gates and reconcile Milestone 1 exit status.

## Next exact task

Add the missing fail-closed access-decision regression tests, then complete live parity and owner acceptance.

---

# Checkpoint 60 — Access decision regression boundary added

## Current milestone

Trust and Data Correctness — milestone exit acceptance

## Completed

- Extracted the existing login, membership-check, allow, and unauthorized decisions into a pure deterministic access resolver.
- Kept `requireUser` as the production enforcement point.
- Added regression tests for every decision path without changing the approved membership model.
- Tested the production protected-page response without browser cookies.

## Verified

- Focused access suite: 5 tests passed.
- Tools typecheck: passed.
- Tests prove:
  - no session requires login;
  - a signed-in session requires membership verification;
  - a matching approved membership is allowed;
  - no membership is unauthorized;
  - mismatched membership is unauthorized;
  - membership lookup failure is unauthorized and therefore fails closed.
- Production unauthenticated `/insights` response contains the Next server redirect contract:
  - destination `/login`;
  - redirect status `307`;
  - replace navigation.
- No production user, session, or membership was created or changed.

## Known issues

- Production owner acceptance must be repeated after deploying this no-behavior-change access refactor.
- A real signed-in non-member remains unavailable because production has no non-member auth account.

## Database changes

- None.

## Deployment status

- Access tests and refactor are local only.
- Production remains on `dpl_7XRfjjFuy5euYmYWzdpVL57Dnsbb`.

## Remaining in this milestone

- Run all release gates.
- Commit and deploy the access-boundary regression slice.
- Verify unauthenticated redirect and signed-in owner access on the new deployment.
- Inspect exact deployment state and product fingerprints.
- Reconcile Milestone 1 acceptance and exit status.

## Next exact task

Run final release gates, deploy the exact commit, and complete owner/parity acceptance.

---

# Checkpoint 61 — Milestone exit release gates passed

## Current milestone

Trust and Data Correctness — milestone exit acceptance

## Completed

- Ran the complete Tools and root repository release gates after adding the access-decision regression boundary.
- Reviewed the final code diff and confirmed it preserves the existing access model.

## Verified

- Tools tests: 129 passed across 30 files.
- Tools typecheck: passed.
- Tools production build: passed.
- Root repository check: passed across 10 levels.
- `git diff --check`: passed.
- Final implementation changes are limited to:
  - the pure access-decision resolver;
  - five access-decision tests;
  - wiring `requireUser` through the resolver without changing destinations or membership storage.
- Existing unrelated 2048 Run Merge files remain untracked and outside this slice.

## Known issues

- Production remains on the previous code until this verified access-boundary commit is deployed.
- Live owner and unauthenticated acceptance must be repeated on the new deployment.

## Database changes

- None.

## Deployment status

- Release gates passed.
- Ready for exact-commit production deployment.

## Remaining in this milestone

- Commit and deploy the verified access-boundary slice.
- Inspect the deployment record.
- Verify cookie-free login redirect and signed-in owner access.
- Reconcile every Milestone 1 exit criterion and mark the milestone complete or precisely blocked.

## Next exact task

Commit, deploy, and perform the final production acceptance.
