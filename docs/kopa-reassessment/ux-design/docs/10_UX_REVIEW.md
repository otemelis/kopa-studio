# 10 — UX review and design decision

Design review date: 2026-10-14. Supplements the eight-part forensic audit; source-integrity findings remain valid. **Design exploration completed; owner approval and measured usability remain pending.**

## Product decision

Recommend **A · Fieldwork**, a light, chart-led analytics workspace. The reason to open Kopa should be a shorter evidence loop: notice a portfolio movement, compare exact keyword histories, inspect collection quality and dated changes, then record a scoped hypothesis without rebuilding context. That is a design hypothesis to test against the owner's AppFollow workflow, not a claim of an already measured win.

**B · Signal** is a coherent alternative: a denser cool-neutral workstation with the watchlist on the left and chart on the right. Its advantage is simultaneous row scanning and history inspection on a wide monitor. Fieldwork gives several histories, missing observations and comparator dates more room, especially at laptop widths. Both directions use the same fixture dataset and analytical logic. This is a choice of hierarchy and working style, not a comparison of different numbers.

| Direction | Composition | Best use | Tradeoff |
|---|---|---|---|
| A · Fieldwork — recommended | Wide history chart; linked table immediately below; contextual drawer | Several histories, event context, period comparison, laptop analysis | Some table rows require vertical scrolling |
| B · Signal | Table and chart share a horizontal workbench; compact navigation and type | Fast repeated row inspection on a wide display | Long terms and rich chart controls compete for width; stacks below 1150px |

[Open the six-screen design review](../review.html). [Fieldwork Keywords](../prototype/index.html?screen=keywords&direction=fieldwork). [Signal Keywords](../prototype/index.html?screen=keywords&direction=signal).

## What was actually evaluated

The authenticated deployed Kopa interface was reached using the existing browser session. Overview, Keywords, Apple Ads reporting, Change Log and Sources were inspected read-only. No mutations, job retries, theme changes or advertising actions were performed. This phase used the deployed interface rather than starting a local copy that might connect to production services. That deliberately differs from the directive's suggested local run; visual evaluation did occur. The prior audit's code/build evidence was read as the architectural constraint.

Five current-screen captures were retained privately in the working evidence folder. Two header-cropped captures are included here: [Overview](evidence/current-overview.jpg), [Sources](evidence/current-sources.jpg). These are real current-interface evidence; they are **not** prototype fixtures. Other raw captures include account-header information and are not redistributed in this package.

Vendor evaluation used current public help pages and their illustrative screenshots. AppFollow's rank-history image was inspected, including the large chart, aligned tooltip and competitor context; its illustrated dates are older than the help-page update. AppTweak's public chart screenshot was inspected in its help page and shows dated release markers and competitor histories. Authenticated vendor workflows were **not** exercised. An AppFollow navigation reached a login screen; no credentials or entitlement changes were attempted. No owner A/B session has occurred.

## Current Kopa defects

| Priority | Observed structure / evidence | Analytical consequence | Proposed response |
|---|---|---|---|
| P0 | Overview leads with record counts and operational freshness; recommendations redirect elsewhere; no central acquisition trend | The owner cannot begin with “what changed?” | Compact defensible metrics, large daily history, app rows and at most three next investigations |
| P0 | Keywords repeats global and local app/storefront controls, then presents a wide table with no visible hero history | A rank change cannot be inspected in place; duplicate filters create scope doubt | One context bar, linked selection, large chart and drawer |
| P0 | Current “Not ranked” presentation collapses outcomes | Absence, failed collection and unsupported history can look equivalent | Distinct observation states and coverage beside every decision |
| P0 | Ads reporting presents totals, coverage and daily rows rather than an interactive trend | Spend investigation requires mentally reconstructing time | Focused single-unit trend modes and campaign-to-term drilldown |
| P0 | Ads header says Last 28 days while visible coverage spans a much broader interval and ALL market | Date and market scope cannot be trusted from the header alone | Query contract must return applied scope, complete window and native dimensions; never infer country allocation |
| P1 | Change Log consists of dated cards; hypothesis text is disconnected from plotted evidence | Interventions are hard to compare with rank behavior | Clickable event overlay and lightweight experiment capture from the active chart |
| P1 | Sources mixes a useful status matrix with broad configuration cards, diagnostics and Discovery detail | Operational detail competes with analytical work; “configured” can be mistaken for useful coverage | Compact scope-specific reliability matrix; deeper diagnostics in a drawer |
| P1 | Navigation spreads related work across Dashboard, Analytics, Apps and nested operational groups | The owner must know internal module names | Five destinations: Overview, Keywords, Apple Ads, Experiments, Sources |

These are interface observations, not a new reconciliation of production metrics. The audit already establishes that legacy iTunes positions, overlapping ASC reports, Sales money and Ads date/country attribution require source repairs. A polished chart cannot validate those facts.

## Public reference workflows and what Kopa should learn

AppFollow documents selecting table keywords into rank history, keeping country/time filters in view, sparklines, grouping and table controls. Its export documentation on the same page also warns that interface filtering/sorting is not reflected in the file. Kopa should retain its own precise selected-scope export contract. [AppFollow Keyword Tracking, updated 17 June 2026](https://support.appfollow.io/hc/en-us/articles/360020831817-Keyword-Tracking).

AppFollow documents dated chart annotations, a useful way to inspect updates without navigating away. Kopa must distinguish a recorded change from a causal explanation. [AppFollow chart annotations](https://support.appfollow.io/hc/en-us/articles/4404723819281-Enable-Chart-Annotations).

AppTweak documents tracked-list history, competitors, ranking distribution and full-period comparisons. This supports treating comparison as a primary analysis mode. Its modeled keyword installs and visibility measures require provider labels; they cannot be recast as official observations. [AppTweak Monitor Performance, updated 7 July 2026](https://help.apptweak.com/en/articles/4056742-monitor-performance-keywords).

AppTweak's public history example places release markers directly on trends and exposes competitor selection. This is a useful visual reference for preserving event context. [AppTweak organic growth history, updated 7 July 2026](https://help.apptweak.com/en/articles/4062052-monitor-your-organic-installs-impressions-growth-over-time).

AppTweak's Ads dashboard documents scorecards, trend views and campaign/country breakdowns. Kopa's version must carry account timezone, native currency and attribution definition into the chart and export. [AppTweak Apple Ads dashboard](https://help.apptweak.com/en/articles/10449713-using-the-dashboard-for-apple-ads).

These patterns are documented or visually inspected public examples, not verified current account entitlements, performance benchmarks or proof that Kopa is faster.

## Review outcome sought

Approve Fieldwork's hierarchy, linked keyword selection, comparison treatment and evidence drawer, or select Signal and identify which analytical task benefits from its density. Decide whether default history should open with two keywords or a saved owner view. Confirm whether comparisons should default on. Only then authorize the production vertical slice described in document 13.
