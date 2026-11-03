# PASSPORT Signals checkpoint — 3 November 2026

The owner-only `/passport-signals` page is a source-separated launch view. It reads PASSPORT's existing aggregate event table through the approved read-only server credential, existing App Store Connect reporting rows through the current Kopa repository, and Vercel Web Analytics through its official read API when a dedicated server-side token is configured. It does not add a collector, schema, attribution join, or client-side secret.

## Reconciliation example

The 7-day selection on 3 November covers 28 October–3 November inclusive. The day is **device-local** for PASSPORT events, **UTC** for Vercel Web Analytics, and Apple-defined for App Store reporting. The current day is partial and uploads can arrive late.

| Visible measure | Independent source check | Current value | Definition |
| --- | --- | ---: | --- |
| App opens, App Store channel | `passport_analytics.daily_counts`, `build_channel='appstore'`, `event='app_opened'` | 10 | Aggregate events, not installations or people |
| First-stamp completions, App Store channel | Same table, `event='first_stamp_completed'` | 2 | Aggregate events, not an ordered conversion count |
| Stamps created, App Store channel | Same table, `event='stamp_created'` | 10 | Aggregate actions |
| Sales report units | `aso_daily_metrics`, PASSPORT app ID, `source='appstore_connect_sales'` | 7 | Official Sales and Trends units, not first-time downloads |
| Website visitors | Vercel `GET /v1/query/web-analytics/visits/count`, meetpassport project | 18 | Vercel's period-level deduplicated visitors |
| Website page views | Same Vercel response | 27 | Production page views |
| TestFlight 1.2 app opens / first stamps / flights logged | PASSPORT daily counts, `build_channel='testflight'`, `app_version='1.2'` | 1 / 1 / 1 | Instrumentation observations; never production adoption |

The website values were verified via the connected Vercel account. They appear in Kopa only when the server-side Vercel read credential is configured. Without it, the page explicitly says **Unavailable**. This check does not establish website-to-app attribution. The app table has no installation ID, so user-level conversion and retention are unavailable.

## Website access gate

Vercel's documented Web Analytics count and aggregate endpoints require an API bearer token. The current `kopa-tools` project has no such token. Create a **project-scoped** token for the `meetpassport` Vercel project, with an expiration and a name such as `kopa-passport-analytics`; do not create a full-account token. After separate owner approval for the credential grant, store it in the `kopa-tools` project as the secret environment variable `KOPA_VERCEL_ANALYTICS_TOKEN` for production and preview. Do not paste the token into Git, logs, chat, or a browser-facing variable. The page uses four read-only requests per load: count, daily, page and referrer aggregates. No website rows are copied into Supabase.

Vercel's UTM dimension returned HTTP 402 on this account, indicating Analytics Plus or Enterprise is required. Its custom-event API also returned HTTP 402, requiring Pro or Enterprise. The page marks UTM campaigns unavailable and does not claim website CTA counts; it incurs no upgrade cost. The website project has multiple domains, so Vercel project-level traffic is labeled as such rather than attributed to exactly one hostname.

## Release acceptance

Before production promotion: confirm the dedicated token can read the `meetpassport` project, verify the preview's website counts against Vercel for the same UTC window, verify the app and Sales values above against source SQL, check owner access and anonymous redirect, and inspect both light and dark mode. After 1.2 launches, verify that `appstore`/1.2 rows arrive; do not promote TestFlight counts into production or infer unique users.

Sources: [Vercel Web Analytics count API](https://vercel.com/docs/rest-api/web-analytics/counts-page-views), [aggregate API](https://vercel.com/docs/rest-api/web-analytics/aggregates-page-views), and [project-scoped token instructions](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token).
