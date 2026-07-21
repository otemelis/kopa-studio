# Platform information architecture

## Target model

Kopa Tools is organized around six primary workspaces:

| Workspace | Purpose |
|---|---|
| Dashboard | Portfolio-level status, blockers and next actions |
| Apps | App records and store identity |
| ASO Intelligence | Keywords, rankings, competitors and markets |
| Apple Ads | Paid acquisition structure, reporting, search terms, planning and attribution |
| Actions | Recommendations and change history |
| Data & Integrations | Data sources, collection jobs and health |

Settings remains optional and should only be exposed when there is a real settings workflow.

## Current sidebar destinations

| Visible item | Current route | Sub-items |
|---|---|---|
| Dashboard | `/` | None |
| Apps | `/apps` | None |
| ASO Intelligence | `/aso` | Overview, Keywords, Competitors, Markets |
| Apple Ads | `/apple-ads-lab` | Overview, Campaigns, Keywords & Search Terms, Planner, Attribution |
| Actions | `/insights` | Recommendations, Change Log |
| Data & Integrations | `/app-store-connect` | Sources, Jobs, Health |

The sidebar keeps child menus expandable before navigation so a user can choose the intended destination before the page loads.

## Consolidation map

| Previous page | Current workspace destination | Route status |
|---|---|---|
| Overview | Dashboard | Preserved at `/` |
| Apps | Apps | Preserved at `/apps` |
| Keywords | ASO Intelligence -> Keywords | Preserved at `/keywords` |
| Rankings | ASO Intelligence -> Keywords | Preserved at `/rankings` |
| Competitors | ASO Intelligence -> Competitors | Preserved at `/competitors` |
| Localizations | ASO Intelligence -> Markets | Preserved at `/localizations` |
| App Store Connect | Data & Integrations -> Sources | Preserved at `/app-store-connect` |
| Data collection | Data & Integrations -> Jobs | Preserved at `/collection` |
| Apple Ads Lab | Apple Ads -> Overview | Preserved at `/apple-ads-lab` |
| Ads structure | Apple Ads -> Campaigns | Preserved at `/apple-ads-lab/structure` |
| Ads reporting | Apple Ads -> Campaigns / Overview | Preserved at `/apple-ads-lab/reporting` |
| Ads keyword intel | Apple Ads -> Keywords & Search Terms | Preserved at `/apple-ads-lab/keyword-intelligence` |
| Research Planner | Apple Ads -> Planner | Preserved at `/apple-ads-lab/research-planner` |
| Ads attribution | Apple Ads -> Attribution | Preserved at `/apple-ads-lab/attribution` |
| Ads recommendations | Actions -> Recommendations | Preserved at `/apple-ads-lab/recommendations` during migration |
| Insights | Actions -> Recommendations | Preserved at `/insights` |
| Experiments | Actions -> Change Log | Preserved at `/experiments` |
| Ads data quality | Data & Integrations -> Health | Preserved at `/apple-ads-lab/data-quality` |

## Global context

The current global context bar supports:

- App
- Market
- Period
- Data freshness label

Context is propagated through `app`, `country` and `period` query parameters by the sidebar and context bar.

## Routing policy

During this migration:

- Keep current routes working.
- Prefer moving visible navigation before deleting implementation pages.
- Add redirects only after the target workspace route has been verified in production.
- Do not merge data access logic blindly; compare old and new outputs first.

## Remaining IA work

- Decide whether `/rankings` becomes a tab inside `/keywords` or remains a direct compatibility route.
- Move App Store Connect storefront activity deeper into Markets once the data joins are complete.
- Decide whether `/apple-ads-lab/reporting` remains a direct page or becomes a Campaigns tab.
- Add explicit redirects only after production verification.
