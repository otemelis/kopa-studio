# Kopa Tools current state

Status: authoritative handover
Last verified: 2026-07-29
Active roadmap: [KOPA_ACTIVE_ROADMAP.md](KOPA_ACTIVE_ROADMAP.md)
Detailed inventory: [KOPA_IMPLEMENTATION_INVENTORY.md](KOPA_IMPLEMENTATION_INVENTORY.md)

When another status document conflicts with this file, this file wins.

## Production and deployment

- Product URL: `https://tools.kopa.studio`
- Vercel project: `kopa-tools`
- Current production deployment: `dpl_6xvYrtUDhwgueWt4FfXaKqsEhUVg`
- Deployment URL: `https://kopa-tools-5ky1rk0kd-otemelis-projects.vercel.app`
- Deployment state: Ready
- Created: 2026-07-29
- Repository audit revision: `0b9b3b0d` (`feat(tools): improve ads evidence and audit AppFollow`)
- Production/source parity: verified for the Apple Ads evidence, App Store Connect parser-integrity, GB market-readiness, and recommendation-scope slices.
- Public site/collector: separate root Vercel project at `www.kopa.studio`; current production deployment `dpl_DtCQqG7QUeHC9x3k9cejk5JMci84`

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
