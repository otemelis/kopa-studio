# 04 — Data source strategy and official API assessment

As of 2026-10-14. **Use official owned-account data for acquisition/spend/value, one licensed source for observed organic ranks, and explicit measurement types for every estimate.** New Platform API endpoints were checked in Apple's public Markdown documentation after the HTML reference returned JavaScript shells. Documentation availability does not prove this owner's account can access every endpoint.

## Source contract registry

Every fact requires source/provider, API/parser version, app ID mapping, native dimensions, period/timezone, observed/processed/imported timestamps, quality, revision, and completeness. Store country and locale separately. Optional dimensions remain unknown; they are not fabricated from primary country.

| Source | Exactly what it measures | Dimensions to preserve | Freshness and limitations | Credentials / permissions |
|---|---|---|---|---|
| ASC Discovery Standard | Store impressions, page views and interaction counts; repeated events differ from unique counts | App, date, territory, event, page type, source type; native device/platform fields if present | Daily; documented completion within 3 days; newer instances can revise same dates; search source is not necessarily organic-only | Routine ASC Sales and Reports/Finance/Admin key for downloads; Admin to create requests |
| ASC Downloads | First-time downloads/redownloads by the report's download-type definition | App, date, territory, download type, source/page/device/platform fields supplied by report | Daily; completion within 2 days; not app-first-open telemetry or a per-keyword install report | Same Analytics Reports permissions |
| ASC Purchases | Aggregated purchases/refunds, sales and **estimated proceeds in USD** as defined by Apple | App/product, date, territory, purchase/source/page dimensions available in chosen Standard/Detailed report | Daily; completion within 2 days; privacy and revisions apply; not settled cash | Same report permissions |
| ASC Subscription State / Event | Aggregate subscription inventory and lifecycle changes | Subscription/group, territory, date and subscription/offer/platform dimensions supplied | Report-specific availability/completeness; State and Event have different grains and cannot be summed interchangeably | Analytics Reports reader; app/report coverage must be validated |
| Sales and Trends Summary | Units by transaction/product class; per-unit developer proceeds and native currency | Vendor, report date/frequency/version, product/parent app, product type, territory, proceeds currency | Latest available daily plus explicit historical retrieval; retain refunds and updates separately | ASC Sales and Reports or other supported reporting role, vendor number |
| Financial reports | Fiscal-period proceeds/financial reconciliation | Vendor, fiscal period, region, currency and product/accounting dimensions | Periodic; use for financial reconciliation, not daily campaign optimization | Finance-capable key and required report inputs; avoid granting Finance just for daily analytics |
| Apple Ads reports | Advertiser spend, delivery, tap/view attributed downloads and related performance | Account, app, campaign, group, keyword/ad/term, country, date, timezone, placement, match/claim definitions, currency | Daily imports with revisions; attribution maturity differs from metric date; suppressed search terms may prevent full reconciliation | API read-only user/OAuth scoped to approved ad accounts |
| Apple Ads Insights | Paid impression share and market-relative search-term popularity | App (impression share), country, term, genre (popularity), weekly/monthly/day period, share-slot option | Separate published periods/coverage, not exact query counts or organic rank | Approved scoped Ads API read access; actual account eligibility to verify |
| Licensed rank provider | Vendor observation of organic result order at a time and market/device context | App, term, storefront, requested/returned locale, device, observation time, depth, method, observed/absent/failed status | Daily priority series; gaps remain gaps; native-session agreement needs calibration | Server API key, plan/credit/storage/AI-use rights |
| Public catalog | Public app identity/name/description/version/ratings/price | Numeric ID, country, returned locale if explicit, timestamp | On request; incomplete metadata; no native-search ranking guarantee | No credential; current terms and gentle rate limits |
| RevenueCat / existing transaction source | Recorded subscription/purchase lifecycle and receipts, refunds; SDK/integration-dependent attribution | Project/app, customer/transaction, product, cohort, store, currency, acquisition fields actually linked | Webhooks/export refresh; refunds/late events and integration coverage matter | Separate read-only server/export access, webhook verification if later used |
| Existing product events | Instrumented behavior/events and client-reported signals | Product app mapping, event schema, environment, user/session, event/received timestamps | As received; capped current queries; not validated revenue or unique installs | Restricted read access to existing telemetry; minimize payloads |

Primary definitions: [Discovery](https://developer.apple.com/documentation/analytics-reports/app-store-discovery-and-engagement), [Downloads](https://developer.apple.com/documentation/analytics-reports/app-download), [Purchases](https://developer.apple.com/documentation/analytics-reports/app-store-purchase), [Subscription State](https://developer.apple.com/documentation/analytics-reports/subscription-state), [Subscription Event](https://developer.apple.com/documentation/analytics-reports/subscription-event), [Sales Summary](https://developer.apple.com/help/app-store-connect/reference/reporting/summary-sales-report), [Sales/Finance resources](https://developer.apple.com/documentation/appstoreconnectapi/sales-and-finance).

## Apple Ads: keep API generations separate

| Concern | Current Kopa adapter | Current Platform API contract |
|---|---|---|
| Version / host | Campaign Management API v5, `https://api.searchads.apple.com/api/v5` | Platform API v1, `https://api.ads.apple.com/v1` |
| Account context | `X-AP-Context: orgId=…` | `X-AP-Context: adAccountId=…` for account-scoped calls |
| Discovery | `data` ACL list interpreted as organizations | `/me`, `/acls`, organizations and ad accounts are distinct resources |
| Reports | `/reports/campaigns`, nested `reportingDataResponse.row` | `/reports/apps/{level}/query`, `result.rows`, `totalMetrics` and optional `granularMetrics` |
| Query envelope | `startTime/endTime`, `selector`, `pagination.limit` | `timeRange`, `filters`, `sorting`, `pagination.pageSize`, `fields`, `groupBy`, `options` |
| Implementation | Campaign reports + one page of search terms | Documented campaign/group/ad/keyword/search-term report families |
| State | Current code; authenticated operation not retested | New adapter must be independently validated; no base-URL-only migration |

Apple's [v5 targeting-keyword reference](https://developer.apple.com/documentation/apple_ads/find-targeting-keywords-in-a-campaign) explicitly marks Campaign Management API deprecated in favor of Platform API. A precise shutdown date was not established from the primary pages inspected; do not base a deadline on third-party claims. Source code: [apps/tools/src/lib/apple-ads/config.ts:9](/Users/otastemelis/Documents/kopa-studio/apps/tools/src/lib/apple-ads/config.ts:9), [apps/tools/src/lib/apple-ads/apple-ads-provider.ts:68](/Users/otastemelis/Documents/kopa-studio/apps/tools/src/lib/apple-ads/apple-ads-provider.ts:68).

Platform references: [Calling the API](https://developer.apple.com/documentation/apple-ads-platform-api/calling-apple-ads-platform-api), [Account/access model](https://developer.apple.com/documentation/apple-ads-platform-api/access-overview), [Reporting guide](https://developer.apple.com/documentation/apple-ads-platform-api/reports).

### Authentication, eligibility and rotation

Apple documents OAuth2 client credentials, an ES256-signed client secret, `scope=searchadsorg`, and access tokens valid for the returned lifetime (one-hour documented example). Client-secret expiry must be less than 180 days from issuance. Store key material and tokens only server-side, alert before expiration, and fail closed on account mismatch. Scope string alone does not enforce read-only access: use API user roles and Kopa's route allowlist.

An account administrator designates an API user with an appropriate role, including API Account Read Only. Enumerate ACLs and persist an explicitly approved adAccount ID. Registration requirements for a third-party service provider differ from accessing one's own organization; Kopa should remain an internal client. Do not create an ad account just because ACLs are empty.

Sources: [OAuth](https://developer.apple.com/documentation/apple-ads-platform-api/implementing-oauth-for-the-apple-ads-platform-api), [Apple Ads API access help](https://ads.apple.com/app-store/help/campaigns/0022-use-the-apple-ads-platform-api).

### Report retrieval and metric definitions

Documented App Store report routes cover campaigns, ad groups, ads, keywords and search terms under `/v1/reports/apps/*/query`. Preserve native response names and versions in raw storage, then map into canonical typed metrics. Examples in the campaign reference include `localSpend`, `impressions`, `taps`, `tapInstalls`, `totalInstalls`, `tapNewDownloads`, and `tapRedownloads`. Do not alias an available total to a missing tap measure.

Use the [campaign report schema](https://developer.apple.com/documentation/apple-ads-platform-api/Get-app-campaign-reports) for country breakdown and daily rows. Define derived rates precisely: TTR = taps/impressions; average CPT = spend/taps; tap CPA = spend/tap installs; total CPA = spend/total installs. A tap conversion rate cannot use total installs without changing its label/meaning. Zero denominator yields null. Sum only compatible currencies and grains; never add campaign totals to their keyword children.

[Reporting constraints](https://developer.apple.com/documentation/apple-ads-platform-api/reports) include maximum page size 5,000; daily spans at most 90 days; hourly spans at most 7 days with start within the last 365 days, unavailable for ad/search-term reports; weekly spans at least 14 days and monthly at least 90 days. A single-day request omits granularity and uses totalMetrics. These are request limits, **not a promise of complete historical retention**. The precise daily retention horizon remains an authenticated discovery item.

Search-term reports use ORTZ and permit device/country grouping; [the search-term reference](https://developer.apple.com/documentation/apple-ads-platform-api/Get-app-search-term-reports) documents their distinct constraints. Normalize cross-source comparisons only after preserving the original reporting timezone. Do not manufacture hourly allocation to convert an account-day total into UTC. Store a period rather than a day when the source actually returns a range total.

**Proposed retrieval policy:** import daily with a rolling 35-day overlap, covering standard 30-day tap attribution plus a small buffer; fetch older revisions/backfills by explicit checkpoints. This is an engineering policy, not Apple's immutability guarantee. Keep recent periods provisional and widen the revision window for preorder/report-specific attribution. Exact report latency, account history and restatement behavior must be observed before V1 acceptance.

[Apple's glossary](https://ads.apple.com/app-store/help-glossary) distinguishes tap-through and total CPA. [AdServices attribution](https://developer.apple.com/documentation/AdServices/AAAttribution/attributionToken%28%29) documents 30-day tap and 24-hour view eligibility for standard download attribution, plus special preorder cases. An AdServices record and aggregate Ads report need not reconcile exactly.

### Official discovery, popularity and impression share

[Insights](https://developer.apple.com/documentation/apple-ads-platform-api/insights-endpoints) provides two separate datasets:

- `/insights/apps/impression-share/query`: requires promotedObjectId, fixed UTC, daily up to 30 inclusive days or weekly up to four Sunday-start weeks. Preserve FIRST_SLOT versus ALL_SLOTS, share bounds, term/country/date, and paid share rank. Values above 90% are bucketed. None of this is organic rank.
- `/insights/apps/search-term-popularity/query`: weekly Sunday–Saturday or monthly, country/genre/term and period; optional within-genre rank and 1–100 or 1–5 relative popularity measures. Page through results. This supplies market-relative demand, not absolute searches or the app's installs.

The inspected [popularity endpoint](https://developer.apple.com/documentation/apple-ads-platform-api/Query-app-search-term-popularity-data) **does list `searchTerm` filters** (`EQUALS`, `IN`, `CONTAINS`, `STARTS_WITH`). Older third-party descriptions claiming no term filtering should not override the current reference. Filtering a dataset does not guarantee an arbitrary long-tail keyword exists. Missing term remains `unavailable`, not zero popularity. A numeric 1–100 genre score is not interchangeable with the vendor's 5–100 score or a suggestions score.

[Suggestions](https://developer.apple.com/documentation/apple-ads-platform-api/suggestions-endpoints) covers keyword, phrase, category and target-CPA suggestions. Keyword discovery is app/promoted-object scoped with optional countries/seeds; phrase/category discovery has SUGGESTION and SEARCH routes. Documented popularity is 0–100. Preserve the exact endpoint context and result fields; do not assert that its numeric score has the same country/time-series interpretation as Insights. Validate actual availability with the read-only account.

### Recommendations, writes and audit history

[Recommendations](https://developer.apple.com/documentation/apple-ads-platform-api/recommendations-endpoints) has stateful daily-budget and target-CPA query/apply/dismiss flows. Target CPA applies to Maximize Conversions App Store campaigns and is not a keyword bid. `BID` appears in an enum but has no dedicated recommendation endpoints in this documented version. Querying recommendations can be read-only; apply/dismiss are writes and are excluded from V1.

The Platform API documents campaign/ad-group/keyword/negative-keyword mutation resources. Their existence does not justify implementing them now. Later proposals must validate strategy, placement and status, not assume every campaign supports manual bid changes.

[Change History](https://developer.apple.com/documentation/apple-ads-platform-api/change-history-endpoints) provides grouped transaction summaries and field-level detail, with maximum six-month lookback. Request `options.metadata=latest` or `snapshot` to obtain detail IDs. Import regularly to preserve an internal timeline beyond upstream retention. Also maintain Kopa's own immutable approval/execution records; provider history alone cannot explain why a change was approved.

### Rate limits and operational constraints

[Rate-limit documentation](https://developer.apple.com/documentation/apple-ads-platform-api/rate-limits) describes RateLimit-Limit, Remaining and Reset headers; Reset is a relative duration. On 429 prefer Retry-After. Do not mistake example quota 100 for a universal account limit. Pace by account/resource, use bounded jittered retries, request deadlines, resumable pagination, and no concurrent duplicate imports. Persist request IDs and sanitized errors; never persist bearer tokens in raw request logs.

## App Store Connect implementation strategy

### Reports and corrections

Use `ONGOING` requests for continuing data and explicitly approved `ONE_TIME_SNAPSHOT` for available history. The [download guide](https://developer.apple.com/documentation/appstoreconnectapi/downloading-analytics-reports) documents 1–2 days for initial generation, multiple segments per instance, and stopped-due-to-inactivity states. Reader roles cannot create requests. Track report ID, granularity, instance, processing date, segment checksums/size, parser version, and download completeness.

**Critical replacement semantics:** Apple's [completeness/corrections guide](https://developer.apple.com/documentation/analytics-reports/data-completeness-corrections) says the newer processing-date instance replaces older records for an event date. Merge all segments of one selected instance, then atomically replace that app/report/date partition. Never add the same date across successive instances. Corrections can affect older finalized dates. Dates absent from a newly complete partition must not leave stale category rows behind.

Current Kopa sums overlapping instances (F02), fetches only four and ignores JSON:API next links. Correct this before reading trends. Retained raw payloads include some instance/segment provenance; determine whether it is enough to reconstruct affected dates. If not, re-download only available report partitions. Mark unrecoverable intervals, never fabricate backfills.

[Privacy guidance](https://developer.apple.com/documentation/analytics-reports/privacy) describes suppression/noise/crowd-anonymity measures by report. Missing rows are not necessarily zero; aggregated data may not reconcile across dimension cuts. Counts and unique counts have distinct aggregation rules; unique counts cannot be added across overlapping groups as unique people. Product conversion must use compatible definitions and windows; downloads/page views across unrelated report grains is only a labeled ratio, not automatically Apple's official conversion rate.

### Metadata, CPP and PPO

[Version localizations](https://developer.apple.com/documentation/appstoreconnectapi/app-store-version-localizations) exposes version-localized content such as description, keywords, promotional text and release notes. App name/subtitle are [App Info Localizations](https://developer.apple.com/documentation/appstoreconnectapi/app-info-localizations), a different resource. Model metadata by app, platform, version/state, exact locale and fetched time. “Country” does not select a unique metadata localization.

[Custom Product Pages](https://developer.apple.com/documentation/appstoreconnectapi/app-custom-product-pages) and [version experiments](https://developer.apple.com/documentation/appstoreconnectapi/app-store-version-experiments) provide management/read resources for custom pages and PPO experiments/treatments, including v2 experiment resources. Existence of a management API is not proof that every console result metric can be downloaded through it. First import read-only identities/state; link manual console exports/results until exact treatment-performance availability and entitlement are validated. Do not scrape authenticated console pages.

Separate ASC reader and metadata writer credentials. An App Manager/other appropriate metadata role would be needed for future approved publishing; verify exact resource permissions then. During this audit no request was created, experiment started or metadata edited.

## Subscription value and attribution

[RevenueCat Apple Search Ads integration](https://www.revenuecat.com/docs/integrations/attribution/apple-search-ads) documents AdServices collection, campaign/group segmentation and downstream subscription analysis. It requires the integration and attribution-token collection, not just an API key. Its current documentation flags attribution limitations for age/gender-targeted ad groups. Validate actual SDK/configuration and coverage in each app; **do not change POIS purchase lifecycle, RevenueCat integration, paywalls or onboarding as a side effect of Kopa work**.

RevenueCat [chart definitions](https://www.revenuecat.com/docs/dashboard-and-metrics/charts) are metric-specific. Extract the minimum export/webhook data necessary and record definition, currency, refunds, tax/commission treatment and acquisition attribution coverage. No existing RevenueCat connection was established from this repository.

| Value type | Acceptable presentation |
|---|---|
| Validated transaction amount | Actual recorded purchase/refund under its receipt/source definition; not necessarily settled developer cash |
| Sales/financial proceeds | Developer proceeds, native currency and report basis; distinguish estimates from finalized financial settlements |
| Apple's “Proceeds in USD” Analytics field | **Apple-estimated proceeds**, even though it is an official source |
| Provider competitor/keyword revenue | Vendor estimate, separate visual treatment and storage |
| Attributed revenue | Revenue joined to an acquisition cohort under a defined method/window and known coverage; not incrementality |
| Modeled LTV | Forecast with model version, horizon and uncertainty; excluded from V1 recommendations |

Do not subtract Ads installs from ASC downloads and label the remainder keyword-organic installs. Differences in reporting dates, redownloads, privacy, timezone, attribution and source inclusion invalidate that shortcut. ROAS is permitted later only for compatible spend/cohort value/currency/horizon and explicit attributed share.

## Refresh, cost and procurement policy

| Work | Proposed cadence | Cost/availability control |
|---|---|---|
| ASC reports | Daily; reprocess revised partitions; periodic available-history reconciliation | No API usage fee established in inspected docs; developer/account and infrastructure costs still apply |
| Ads reports/structure | Daily, rolling revisions; structure before dependent term mapping | Separate from advertising spend; rate/timeout budgets and account allowlist |
| Insights/suggestions | Weekly popularity periods and cached suggestions; daily/weekly paid share as needed | Only relevant app/markets; no implied universal keyword coverage |
| Rank source | Daily priority, lower cadence optional terms | Hard credit budget and no automatic overage/purchase |
| Competitor catalog | Daily or 2–3×/week, checksum changes | Few selected competitors/markets |
| RevenueCat | Later webhook/export import with idempotency | Existing entitlement/export costs and app integration verified first |

**Planning example, not a quote or measured bill:** 90 app/market/keyword rank series × 10 credits × 30 daily current pulls = 27,000 datapoint credits/month, plus request overhead. Batching five series per request would add approximately 540 requests/credits, subject to endpoint app/market grouping and actual returned data. A 30-day historical pull costs 10 + 29×1 = 39 credits/series, around 3,510 datapoint credits for 90 series, plus request overhead; that is a one-time backfill, not a replacement for daily fresh collection. Repeated overlapping historical polls incur repeated cost. These formulas use [documented AppTweak pricing](https://developers.apptweak.com/reference/pricing-table); confirm current billing before a trial. Popularity, search-result sets and competitors add separately.

For AppFollow, a single page at each of 3 apps × 2 markets × 30 days × 10 credits = 1,800 credits/month **only if** one call returns all tracked ranks for a market/day and the endpoint actually exposes the desired observations. Neither was validated here; pagination can multiply cost. API requests and app/term series are different billing units.

Infrastructure planning allowance: **$25–75/month incremental**, depending on existing Supabase/Vercel plans, retention, worker host and backups; not a vendor price quote. The data subscription may exceed infrastructure cost. Obtain the all-in quote and approve a monthly ceiling before enabling collection. Reuse current paid capacity if suitable; do not create a second database by default.

## Required decisions and remaining source gaps

Confirm app IDs/bundle IDs and primary storefronts; monthly data budget; API/export rights; selected provider and successful sample; API read-only account IDs/roles; ASC reader/vendor/report state; safe database snapshot and actual migration versions; retention and backup policy; RevenueCat/telemetry identity and access if value analysis is included later.

Remaining unknowns are deliberately not guessed: account-specific API eligibility, general Ads daily-history retention, exact new Insights retention/freshness beyond inspected constraints, vendor rank accuracy and rights, provider current entitlements, CPP/PPO downloadable result coverage, report/account-specific privacy effects, RevenueCat availability, and actual source freshness in production. These become milestone acceptance items, not assumptions hidden in code.
