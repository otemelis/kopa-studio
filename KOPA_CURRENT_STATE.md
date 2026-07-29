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
