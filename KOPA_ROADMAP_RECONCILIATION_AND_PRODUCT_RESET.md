# Kopa Tools — Roadmap Reconciliation and Product Reset

> **Product-reset brief.** Execution status is tracked in [`KOPA_CURRENT_STATE.md`](KOPA_CURRENT_STATE.md), and the active milestone sequence is in [`KOPA_ACTIVE_ROADMAP.md`](KOPA_ACTIVE_ROADMAP.md).

## Purpose

Kopa Tools has reached an important transition point.

The platform already collects meaningful data from:

- Public App Store sources
- Organic keyword tracking
- Competitor tracking
- App Store Connect
- Apple Ads
- Manual AppFollow screenshots
- Change Log records

However, the product currently exposes these systems as separate technical pages and does not yet turn the available evidence into a clear daily decision workflow.

The previous roadmap also contains unfinished technical work, including attribution-related milestones and other planned Apple Ads functionality. Some of that work was blocked because live Apple Ads delivery data did not yet exist.

Live Apple Ads data now exists.

Before continuing the old roadmap automatically, Codex must stop, reconcile the real project state, and create one authoritative product-led roadmap.

This document defines that process.

---

# 1. Immediate directive

Do not continue the next milestone from the old roadmap merely because it is listed as unfinished.

Do not begin attribution implementation.

Do not add more standalone pages.

Do not expand automation.

First complete a **Roadmap Reconciliation Milestone**.

The goals are:

1. Understand exactly what has been implemented
2. Verify what works in production
3. Identify work that is incomplete, blocked, obsolete, duplicated, or no longer strategically useful
4. Preserve valuable unfinished work
5. Defer attribution explicitly
6. Replace the fragmented roadmap with a new product-led roadmap
7. Make Kopa useful before making it more technically sophisticated

---

# 2. Product diagnosis

Kopa currently behaves more like an engineering control panel than an ASO decision product.

The data is present, but the owner still goes to AppFollow because AppFollow answers one question clearly:

> Where do I rank now, and what changed?

Kopa currently requires the owner to understand:

- Data sources
- Sync jobs
- Campaign structure
- Reporting pages
- Keyword tables
- Insights
- Recommendations
- Data quality
- Attribution setup
- App Store Connect reports
- Change logs

The next product phase must reorganize the system around the owner’s real questions:

1. Are rankings improving?
2. Which markets are gaining traction?
3. What changed after a metadata update?
4. Is Apple Ads finding relevant traffic?
5. What should I do next?
6. Is the data complete enough to trust the recommendation?

The primary product promise should become:

> Open Kopa and understand what changed, why it matters, and what to do next.

---

# 3. Roadmap Reconciliation Milestone

## 3.1 Required audit

Inspect the entire current repository before implementing new product work.

Read all relevant files, including:

- Existing roadmap files
- Current-state files
- Apple Ads Lab status files
- Migration status files
- Architecture documentation
- Database documentation
- Attribution documentation
- Job documentation
- Consolidation roadmap
- Change Log implementation
- Test documentation
- Deployment documentation
- Open TODOs
- Relevant migrations
- Relevant API routes
- Background jobs
- Recommendation logic
- Data-quality logic
- Production feature flags

Search for:

```text
TODO
FIXME
blocked
deferred
milestone
attribution
automation
recommendation
search term
reporting
data quality
migration
legacy
temporary
```

Do not infer implementation status from documentation alone.

Inspect the code and production-facing behavior.

---

## 3.2 Create an implementation inventory

Create:

`KOPA_IMPLEMENTATION_INVENTORY.md`

For every meaningful feature or milestone, record:

| Area | Planned | Implemented | Verified | Production status | Blocker | Decision |
|---|---|---|---|---|---|---|

Use only these decision states:

- `KEEP`
- `COMPLETE_NOW`
- `FIX_FIRST`
- `MERGE`
- `DEFER`
- `REMOVE_AFTER_MIGRATION`
- `OBSOLETE`
- `NEEDS_PRODUCT_DECISION`

At minimum include:

### Core ASO

- Apps
- Keyword tracking
- Ranking history
- Competitor tracking
- Localizations
- Insights
- Experiments / Change Log
- Data collection
- Public App Store scraper

### App Store Connect

- Authentication
- Report requests
- Discovery and Engagement parsing
- Storefront metrics
- Download data
- Error handling
- Data freshness

### Apple Ads

- OAuth
- Organization mapping
- App mapping
- Campaign sync
- Ad-group sync
- Keyword sync
- Negative-keyword sync
- Search Match mapping
- Reporting import
- Search-term import
- Keyword intelligence
- Recommendations
- Research Planner
- Write actions
- Guardrails
- Attribution
- Automation levels

### Platform

- Navigation
- Global context
- Job system
- Health monitoring
- Data quality
- Recommendation persistence
- Recommendation feedback
- Export review pack
- Authentication
- Multi-tenant readiness
- Testing
- Production deployment

---

## 3.3 Create one authoritative current-state file

Create:

`KOPA_CURRENT_STATE.md`

This must replace fragmented or contradictory status files as the primary handover document.

It must include:

- Current production URL
- Current deployed version
- Current database migration state
- Current navigation
- Working data sources
- Broken data sources
- Active jobs
- Manual-only workflows
- Known inaccurate fields
- Known incomplete fields
- Live Apple Ads campaign state
- Current app and market coverage
- Current recommendation capabilities
- Current tests
- Current deployment health
- Deferred work
- Next approved milestone

Other detailed status files may remain, but they must link back to `KOPA_CURRENT_STATE.md`.

---

## 3.4 Reconcile the old roadmap

Create:

`KOPA_ROADMAP_RECONCILIATION.md`

For every old milestone, classify it as:

- Completed and verified
- Completed but not verified
- Partially implemented
- Blocked by missing data
- Blocker now resolved
- Still blocked
- No longer strategically useful
- Superseded by the new roadmap
- Deferred

Explain the decision.

Do not delete the old roadmap.

Move it to an archive location or mark it as superseded.

Suggested structure:

```text
/docs/archive/
  ORIGINAL_ROADMAP.md
  APPLE_ADS_LAB_ORIGINAL_STATUS.md
```

Add a clear banner to archived files:

> Superseded. Do not use as the active implementation sequence.

---

# 4. Attribution decision

## 4.1 Attribution is deferred

Attribution is not cancelled.

It is deferred because the platform is not yet at the stage where attribution is the highest-value missing capability.

The current bottlenecks are:

- Rankings are not easy to understand
- Market comparisons are fragmented
- Recommendations can be inaccurate or generic
- Search-term evidence is not translated into clear actions
- Data scope can be inconsistent
- Data quality is not communicated clearly
- The owner does not know where to look
- App Store Connect parsing still needs trust
- Metadata-change monitoring is not yet a first-class workflow

Attribution should not be resumed until the product can reliably answer:

1. What changed?
2. Is the data trustworthy?
3. What action is recommended?
4. Why?
5. When should the result be reviewed?

## 4.2 Attribution resume conditions

Resume attribution only after all conditions are true:

- Today page is live
- Rankings page is clear and reliable
- Markets page is live
- Apple Ads search terms are classified correctly
- Recommendation engine handles insufficient evidence
- Recommendation deduplication works
- Market and locale scoping is correct
- App Store Connect reporting is trustworthy
- Change Log automatically creates measurement windows
- The owner has used the new workflow successfully for at least one metadata cycle
- There is enough Apple Ads install volume for attribution to add meaningful value

Until then:

- Preserve existing attribution schema and documentation
- Preserve the endpoint foundation
- Do not delete working attribution code
- Hide incomplete attribution from primary navigation
- Mark it `DEFERRED`
- Do not spend time polishing it

---

# 5. New product-led roadmap

## Product navigation target

Primary navigation:

```text
Today
Rankings
Markets
Apple Ads
Recommendations
Changes
```

Technical administration:

```text
Settings
  Apps
  Data Sources
  Jobs
  Health
  Integrations
```

Healthy integrations should be mostly invisible during normal product use.

---

# Milestone 1 — Trust and Data Correctness

## Goal

Make the existing data reliable enough to support decisions.

Do not redesign the entire interface during this milestone.

## Required work

### 1. Market and locale scoping

Every relevant row, metric, recommendation and export must have an explicit scope:

```text
organization
+ app
+ storefront
+ locale
+ date range
+ metadata version
```

Do not combine UK Apple Ads data with US metadata silently.

### 2. Search Match mapping

Fix and verify Apple Ads API v5 Search Match state.

Requirements:

- Use the actual API field
- Preserve raw payload
- Handle boolean, string and null safely
- Add a real response fixture
- Add regression tests
- Do not infer state from ad-group name
- Do not infer state from keyword count

### 3. Duplicate keyword logic

Do not classify the same keyword in different markets as a duplicate problem.

Scope duplicate detection by:

```text
organization
+ app
+ storefront
+ keyword
+ match type
+ traffic boundary
```

### 4. Negative-keyword warnings

Do not warn that Core Exact ad groups need negatives.

Only evaluate protective negatives for:

- Search Match discovery
- Broad discovery
- Overlapping traffic structures

### 5. App Store Connect parser

Fix Discovery and Engagement parsing.

Requirements:

- Preserve raw payload
- Validate columns
- Version the parser
- Add real fixtures
- Distinguish zero rows from parse failure
- Surface partial and failed states clearly

### 6. Localization coverage model

Track separately:

- Metadata localized
- Screenshot headline localized
- In-screenshot app UI localized
- Actual app UI localized
- Keywords tracked
- Apple Ads active
- App Store Connect data available

### 7. Evidence sufficiency

For every conclusion, evaluate:

- Freshness
- Completeness
- Volume
- Relevance
- Agreement between sources

Example:

```text
Traffic quality: Poor — High confidence
Store conversion: Unknown — Only 4 taps
Organic impact: Waiting — Metadata in review
Demand: Directional — AppFollow screenshot only
```

### 8. Recommendation deduplication

Deduplicate by:

```text
app
+ market
+ source
+ topic
+ evidence window
+ proposed action
```

### 9. Apple Ads search-term actions

Use the available live data.

The engine must be able to detect:

- Irrelevant search terms
- Terms that should be negative exact
- Broad keywords producing irrelevant traffic
- Relevant terms worth continuing
- Insufficient conversion evidence

The current live example should produce:

- Exclude `lovense`
- Exclude `lovense remote`
- Exclude `y not`
- Pause or review broad `relationship test`
- Continue learning on `personality test`
- Do not judge store conversion from four taps

## Definition of done

- Data scope is explicit
- Known logic defects are fixed
- App Store Connect parser is reliable
- Search Match state matches Apple Ads
- Recommendations distinguish insufficient evidence
- The current Apple Ads dataset generates the correct actions
- Tests cover each corrected rule

---

# Milestone 2 — Today Page

## Goal

Create one page that explains what is happening.

This becomes the default landing page.

## Header

```text
InnerType · United Kingdom · Since last visit
Metadata version 1.2 · In Review
Data fresh 28 minutes ago
```

## Sections

### What changed

Examples:

- Keyword moved
- Market visibility changed
- New search term appeared
- Metadata version submitted
- Campaign started or paused
- Download count changed
- Data source became stale

### What needs attention

Only blockers or material issues.

### What to do next

Maximum three actions.

Each action must include:

- Action
- Reason
- Evidence
- Confidence
- Review condition
- Link to detail

### Recent movement

Show:

- Ranking winners
- Ranking losers
- New search terms
- Market changes
- Recent Change Log entries

### Data status

Keep technical details collapsed unless there is a problem.

## Definition of done

The owner can open Kopa and understand the situation without opening another page.

---

# Milestone 3 — Rankings

## Goal

Make organic ranking monitoring as easy as AppFollow.

## Main table

| Keyword | Market | Current | 1d | 7d | 28d | Best | Demand | Metadata | Status |
|---|---|---:|---:|---:|---:|---:|---:|---|---|

## Required capabilities

- App selector
- Market selector
- Date comparison
- Rank buckets
- Winners and losers
- Top 10 / 25 / 50 / 100 counts
- Unranked keywords
- Metadata presence
- Demand score when available
- Trend sparkline
- Sticky header
- Pagination or virtualization
- Saved filters
- Row detail drawer

## Row drawer

Show:

- Ranking history
- Competitors
- Metadata presence
- Apple Ads evidence
- Related recommendations
- Change Log annotations
- Data freshness

## AppFollow role

Kopa remains the source of truth for rankings.

Manual AppFollow popularity values may be stored as directional demand signals only.

Do not present AppFollow popularity as search volume.

## Definition of done

The owner no longer needs AppFollow to understand rank movement.

---

# Milestone 4 — Metadata Change Monitoring

## Goal

Turn the Change Log into a measurement system.

When a metadata version is submitted or released, automatically create:

```text
Before period: previous 14 days
Indexing period: days 0–7
After period: days 8–28
```

Track:

- New keywords indexed
- Keywords lost
- Rank movement
- Top-25 count
- Top-100 count
- Impressions
- Product page views
- Downloads
- Conversion
- Market-level changes

Show annotations on ranking and acquisition charts.

Do not claim causality when multiple changes overlap.

## Definition of done

Version 1.2 can be monitored automatically without manual spreadsheet comparison.

---

# Milestone 5 — Markets

## Goal

Create one international strategy view.

## Main table

| Market | Visibility | Top 25 | Top 100 | Demand opportunity | Localization | Ads | Recommendation |
|---|---:|---:|---:|---|---|---|---|

## Market detail

Show:

- Ranking movement
- Local metadata
- Priority keywords
- Directional popularity
- Screenshot readiness
- App UI localization
- App Store Connect data
- Apple Ads state
- Current recommendation
- Change Log

## Required market readiness states

- Fully localized
- Metadata only
- Headlines localized
- In-screenshot UI not localized
- App UI not localized
- Tracking only
- Paid campaign active
- Data incomplete

## Definition of done

The owner can compare France, Germany, Brazil, Japan, UK and other markets from one screen.

---

# Milestone 6 — Apple Ads Decision Workspace

## Goal

Lead with diagnosis, not campaign structure.

## Campaign summary

Example:

```text
Campaign is delivering, but traffic quality is poor.

484 impressions
4 taps
0 installs
€1.97 spent

Relevant traffic: Low
Conversion evidence: Insufficient
Budget risk: Low
```

## Search-term table

| Search term | Source | Impressions | Taps | Relevance | Action |
|---|---|---:|---:|---|---|

## Required diagnostics

- Relevant versus irrelevant traffic
- Exact keyword delivery
- Broad discovery quality
- Search Match quality
- Insufficient sample warnings
- Spend risk
- Paid-to-organic opportunities
- Negative keyword candidates
- Continue / pause / exclude recommendations

Hide:

- API versions
- Organization IDs
- Internal mapping IDs
- Raw sync controls
- Technical job history

unless there is a problem.

## Definition of done

The owner can understand campaign quality and the next action from one page.

---

# Milestone 7 — Recommendations

## Goal

Create one prioritised cross-source action feed.

## Recommendation structure

Every recommendation must contain:

### Observation

What objectively happened?

### Diagnosis

What the system thinks it means.

### Action

Exactly what should be done.

### Confidence

How sure the system is.

### Review condition

When the recommendation should be checked again.

## Constraints

- Maximum three actions on Today
- No impossible recommendations
- Respect title/subtitle character limits
- Respect storefront scope
- Respect sample insufficiency
- Do not repeat the same recommendation
- Do not recommend all tracked keywords
- Prefer one prioritised decision over generic alerts

## Statuses

- New
- Accepted
- Rejected
- Snoozed
- Completed
- Inconclusive
- Superseded

## Definition of done

Recommendations are specific enough that the owner can act without interpreting raw tables.

---

# Milestone 8 — Technical Consolidation

## Goal

Move technical administration away from primary navigation.

Create Settings sections:

- Apps
- Data Sources
- Jobs
- Health
- Integrations

Use one user-facing `Refresh data` action.

Keep granular sync controls under Settings.

Merge or hide:

- Data collection
- Ads data quality
- Apple Ads connection setup
- App mapping
- Sync health
- Empty attribution page
- Empty reporting pages
- Empty experiment pages

Do not delete working functionality until replacement flows are verified.

---

# Milestone 9 — Attribution Reassessment

Do not begin automatically.

At the end of Milestone 8, create:

`ATTRIBUTION_READINESS_REVIEW.md`

Evaluate:

- Apple Ads install volume
- Attributed user volume
- Whether keyword-level attribution is operationally useful
- Whether existing app event instrumentation is complete
- Whether privacy and data-retention requirements are ready
- Whether attribution changes a real decision
- Estimated implementation effort
- Expected product value

Possible outcomes:

- Resume attribution
- Run a minimal attribution pilot
- Defer again
- Remove from near-term roadmap

Attribution should resume only if it answers a decision that Kopa cannot already answer.

---

# 6. Working method for Codex

At the beginning of every session:

1. Read `KOPA_CURRENT_STATE.md`
2. Read the active milestone
3. Confirm what is deployed
4. Inspect existing code before creating new components
5. Reuse working data and services
6. Implement the smallest complete vertical slice
7. Verify with production-like fixtures
8. Run tests
9. Update the current-state file
10. Update the roadmap status

Do not mark work complete because a page renders.

Verify:

- Data correctness
- Scope
- Empty states
- Partial states
- Error states
- Real evidence
- Product usefulness



---

# 7. Definition of reconciliation complete

The reconciliation is complete only when:

1. There is one authoritative current-state document
2. Every old milestone has a status
3. Attribution is explicitly deferred
4. Existing Apple Ads data is acknowledged
5. Known inaccuracies are documented
6. Old roadmap files are marked superseded
7. The new roadmap is active
8. No unfinished work is silently lost
9. No obsolete work remains in the active sequence
10. Codex can state exactly what to build next and why
