# Kopa ASO Console UI/UX Milestones

## Product Principle

Kopa is an operating console for a small app studio, not a generic analytics dashboard. Every view should answer one of three questions quickly:

1. What changed?
2. Does it need action?
3. What is the next smallest useful action?

The visual system stays dark and calm, but operational data, warnings, and primary actions must have noticeably stronger contrast than supporting context.

## Audit

### Global Shell and Analytics

**What is working**

- The workspace has a clear separation between product analytics and ASO.
- Metrics, funnels, and daily activity are already available without changing tools.

**Problems**

- The global navigation does not explain the current app scope or data freshness well enough.
- Metric cards can dominate the first viewport without identifying a decision to make.
- Analytics has no shared date-range control, comparison period, or route from a funnel issue into a concrete action.

**Recommendation**

- Keep a compact app scope and freshness indicator in the console header.
- Add a shared date range with a previous-period comparison.
- Link meaningful drop-offs to an insight or experiment draft rather than leaving analytics as a dead end.

### Portfolio

**What is working**

- Portfolio gives a useful app-level summary and storefront-country context.

**Problems**

- The app table is an inventory view, not an action-oriented overview.
- There is no sorting or filtering for a multi-app portfolio.
- Country data and app data compete for attention even when one side has no useful data.

**Recommendation**

- Add portfolio sorting by downloads, conversion, keyword risk, and open insights.
- Make a row open an app-focused ASO context, preserving selected app across tabs.
- Collapse or de-emphasize country data when Discovery reporting is not active.

### Weekly Briefing

**What is working**

- A weekly decision-first view is the right home for ASO.
- The action/watchlist split is useful.

**Problems**

- Actions are text rows without an explicit state, due date, or direct route to the source evidence.
- Alert preferences are operational settings mixed into a decision page.

**Recommendation**

- Turn the briefing list into an action queue with Open, Snoozed, and Done states.
- Provide direct links to the relevant keyword, review cluster, competitor change, or experiment.
- Move alert preferences to a small settings panel or a dedicated section of Sync.

### Keywords

**Problems**

- A long list is impossible to operate without search, filters, and sort order.
- Add and edit forms were below the entire table, making common work depend on scrolling.
- There is no quick way to isolate high-priority declines, a country, or unranked terms.

**Implemented in Milestone 1**

- Search by keyword or app.
- Filter by country, priority, and movement.
- Sort by priority, rank, movement, or term.
- Show the active result count.
- Open add and edit forms above the table; neither requires scrolling through results.

**Next recommendation**

- Add saved views such as `High-priority declines`, `Unranked`, and `US opportunity`.
- Add a group column and bulk priority/pause actions once term volume grows further.

### Insights

**What is working**

- Insight cards contain observation, interpretation, evidence, and a recommendation.

**Problems**

- Every card has equal visual weight, so high-priority work does not lead strongly enough.
- There are no filters for priority, app, source, or status.
- The four available actions make fast triage feel cluttered.

**Recommendation**

- Add a compact filter bar and default to high/medium active insights.
- Make `Create experiment` the sole primary action; place completion, snooze, and dismissal in an overflow menu.
- Add a one-line action state and link back to the original evidence.

### Experiments

**What is working**

- The pre/post comparison and decision recommendation are valuable foundations.

**Problems**

- The creation form is long, below the table, and asks for too much before a test can be logged.
- The table does not prioritize the tests currently running or awaiting a decision.
- There is no strong connection back to the originating insight or forward to the next action.

**Recommendation**

- Open a focused create/edit surface from the top of the view.
- Default the table to `Running`, `Monitoring`, and `Awaiting decision`.
- Add links between an insight, its experiment, the result, and the recorded follow-up.

### Competitors

**What is working**

- Change feed, rank battlefield, contested terms, and tracked competitors cover the right categories.

**Problems**

- The view has four equally weighted sections, making it hard to find the one important change.
- Adding a competitor is below a long set of data sections.
- There is no way to filter competitor movements by app, change type, or date.

**Recommendation**

- Lead with a compact `Important changes` queue, then the battlefield.
- Put `Add competitor` at the top and open its form immediately.
- Add filters for app, metadata change type, and only changes since the previous briefing.

### Reviews

**What is working**

- Rating trend, low-review topics, and recent public reviews are the right inputs.

**Problems**

- Long review cards are difficult to scan.
- There is no filter by rating, country, app version, or topic.
- Topic counts do not explain whether a problem is worsening or newly introduced.

**Recommendation**

- Use a denser review list with expandable detail.
- Add rating, country, version, and topic filters.
- Show topic movement versus the prior 30 days and link significant topics to an insight or release task.

### Sync and Data Health

**What is working**

- The new Data Health overview distinguishes keyword freshness from pending Apple reports.
- App Store Connect status and collection history are visible.

**Problems**

- Connection setup, report provisioning, manual sync, and collection history are mixed together.
- The user must understand Apple report terminology to know what to do next.

**Recommendation**

- Separate `Connections`, `Collection health`, and `History` into clear bands.
- Present exactly one recommended next action based on current state.
- Keep the technical run log collapsed by default unless a run failed.

## Milestones

### Milestone 1: Keyword Operations

Status: implemented

- Search, filter, sort, and result count.
- Above-table add/edit workflow.
- Dark high-contrast operational styling.

### Milestone 2: Action-Oriented Core Views

Status: in progress

- Portfolio sorting and app scope: implemented.
- Insight filters and lighter triage actions: implemented.
- Experiment queue, focused creation flow, and source/result links: next in this milestone.

### Milestone 3: Evidence and Change Intelligence

Status: in progress

- Competitor filtering and important-change queue: implemented.
- Review filters and topic movement: implemented.
- Metadata timeline aligned with visibility and conversion changes: next in this milestone.

### Milestone 4: Trust and Operating Rhythm

Status: complete

- Briefing freshness, weekly action queue, and direct evidence links: implemented.
- Sync recommendation with a direct recovery or collection action: implemented.
- Shared freshness treatment across the operational views: implemented.

### Milestone 5: Validation

Status: in progress

- Review each authenticated page with real data at desktop and mobile sizes.
- Test add/edit/filter/sort flows with a portfolio of at least 100 keywords.
- Remove controls that do not support a regular weekly ASO workflow.
- Live validation finding: shared freshness now requires recent keyword coverage, not only a successful sync run.
