# 08 — Executive recommendation

2026-10-14 • Audit baseline `189d42b6` • Decision requested for a subsequent implementation phase

**Choose a selective rebuild of the data pipeline and simplify the current Next.js app. Preserve the database history and useful evidence logic. Buy a small amount of reliable organic rank data rather than build another scraper.**

## What is actually wrong?

The central issue is trust in the numbers, not the age of the frontend:

- “Keyword rank” is an iTunes Search position, not validated native App Store organic rank.
- Discovery import sums overlapping Apple report instances instead of replacing earlier data for the same date.
- Sales proceeds are summed without multiplying the report's per-unit proceeds by units; download classifications and IAP value are incomplete.
- Seven-day Apple Ads search-term totals can be stored against one day. Country totals, attribution metrics, currencies and capped datasets can also be mixed or truncated.
- Shared keyword editing can relabel history; deleting the last tracking link can cascade into historical observations.
- Collection is split between deployments, with incomplete daily coverage/recovery. The home page emphasizes record counts over comparable app performance.

These are verified source/contract defects. Their live historical impact has not been quantified because production data was not queried. Poor owner workflow and low practical value remain hypotheses to validate in a real-use pilot.

## Is the current tool worth keeping?

Yes. Keep Next.js/TypeScript, Supabase/Postgres/Auth, app identifiers and history, forms/tables, metadata diffs, stronger parser diagnostics, stable recommendation identities, experiment records and the evidence-export pattern. Existing checks pass **172 tests**, type checking and the production build. Lint fails because configuration is missing. The approved dependency check found **15 affected dependency nodes**, requiring scoped remediation and exposure assessment before release.

A localhost smoke check confirms process startup and rejection by secret-protected endpoints. It does **not** validate authenticated workflows or live source freshness. Without environment credentials, pages stream a loading shell and server configuration errors occur.

## Can scraping be solved reliably?

Public catalog lookup can remain useful. The current keyword collector cannot become authoritative organic rank by adding retries or deeper limits. Use one licensed observation source after a capped trial of real target terms/markets; retain timestamp, method, device/locale, depth and absent/failed states. Keep legacy iTunes history as a separate proxy series.

Apple's current Platform API adds legitimate relative popularity, suggestions, paid impression share and change history. Those are useful inputs, **not organic rank or exact organic installs**. Build a separate v1 adapter: current v5 endpoints, account context and response schema are different. Never treat vendor keyword-install estimates, popularity scores or Apple-estimated USD proceeds as exact first-party outcomes.

## What should we build?

A five-area internal growth desk: Portfolio, Keywords, Apple Ads, Experiments and Sources. One app/market context, a short list of evidence-backed actions, a weekly brief and read-only AI queries. Source-specific complete dates, currency and attribution definitions are part of the product, not hidden implementation detail.

Do not build a global crawler, market revenue model, enterprise BI suite, multi-tenant SaaS, support platform, autonomous bidder or automatic metadata publisher. Do not alter POIS onboarding or purchase behavior to serve Kopa analytics.

## Fastest credible path

First preserve/restore data, correct critical measurement contracts and patch the release baseline. In parallel within the next authorized phase, prove official Apple read access and one rank source. Start with one app/market and a trusted acquisition/paid-performance slice, then extend. Try a vendor + Apple-console weekly workflow before committing to custom features.

Planning estimate: **3–5 focused days to an initial trustworthy slice after access; 20–30 working days for the scoped V1**, with a 14-day real-use pilot partly overlapping. These are estimates; provider eligibility, historical repair and account delays may extend them. Proposed incremental infrastructure allowance is $25–75/month, plus an explicitly approved data subscription. Obtain an all-in API/credit quote; UI plan price alone is insufficient.

## Decisions and access needed

Confirm app IDs and priority storefronts; monthly data budget and provider/export rights; read-only Apple Ads adAccount access; ASC reader/vendor/report-request state; safe database backup/restore access and live migration inventory. RevenueCat/transaction access is optional later and must be verified separately. Choose an alert channel before enabling delivery.

No application rewrite, migration, deployment, advertising change, metadata publication, provider purchase or scheduled automation was performed. The audit package is the only repository addition. Start implementation only after this recommendation and scope are accepted.

Read next: [Code evidence](01_CODEBASE_AUDIT.md), [App Store data audit](02_APPSTORE_DATA_AUDIT.md), [API/source strategy](04_DATA_SOURCE_STRATEGY.md), [Architecture](06_ARCHITECTURE_DECISION.md), [Acceptance roadmap](07_IMPLEMENTATION_ROADMAP.md).
