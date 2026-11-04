# PASSPORT — early signals for consultant review

**Read on 4 November 2026.** This is an early, partial view of PASSPORT's launch, not a measure of market-wide demand. Keyword rankings and ASO keyword data are intentionally excluded. Sources are kept separate; none of the counts below identifies the same person across website, App Store, and app.

## What is observable

| Source and period | Observation | Interpretation and limit |
| --- | ---: | --- |
| Apple Sales and Trends, 29 Oct–2 Nov | **8 units** | Official reported units for PASSPORT. They are not verified first-time downloads or eight distinct people. The reporting table has one unit each in Brazil, Canada, Malta, Poland, Senegal and Uganda, and two in Germany. Latest available row: 2 Nov. |
| Apple Sales and Trends, same rows | **0 reported proceeds** | These eight unit rows carry zero proceeds. This does not establish that all PASSPORT products had zero sales outside the available report scope. |
| Production app telemetry, device-local days 29 Oct–3 Nov, version 1.0 | **29 app-open events** | Opens, not active users or installations; reported on four device-local days. The most recent event day is 3 Nov. |
| Production app telemetry, same scope | **11 onboarding-presented; 9 onboarding-completed; 10 first-stamp-completed events** | These are separate aggregate event totals, **not** an ordered user funnel or conversion rate. Repeats and late uploads cannot be joined to people. |
| Production app telemetry, same scope | **51 stamp-editor opens; 35 stamps created; 53 Journey opens** | Evidence that the core recording and exploration actions are occurring. These events do not establish how many people performed them. Seven photo-attachment events were also recorded. |

The clearest concentration is **3 November**: 19 of the 29 recorded app opens, 8 of the 10 first-stamp events, and 25 of the 35 stamp-created events were assigned to that device-local day. This is a useful prompt for checking what promotion, press, social discussion or word of mouth occurred around then; the telemetry does **not** identify the cause. Production event rows were uploaded as recently as **4 November, 18:54 UTC**. TestFlight activity, including version 1.2 testing, is excluded throughout.

## What cannot yet be concluded

- **Website reach and referrers:** Vercel Web Analytics is configured in Kopa's PASSPORT page, but a current source response could not be independently extracted for this report. No website figure is quoted here. The consultant should treat any website screenshot as a separately dated Vercel observation, not as an install or customer count.
- **App Store discovery:** Kopa's PASSPORT `aso_storefront_metrics` table returned **no App Store Connect Analytics rows** for 8 October–4 November. Impressions, product-page views and App Store Search acquisition are **unavailable**, not zero. Apple's report generation and import may lag.
- **Paid acquisition:** Kopa has **no PASSPORT-mapped Apple Ads campaign rows** in the checked reporting table. This is missing coverage in this report, not evidence that no advertising occurred.
- **Purchases and retention:** No verified paid-purchase or proceeds conversion, unique app-user count, user-level funnel, or retention cohort is supported by these aggregate events. App opens and first-stamp counts must not be divided to claim a conversion rate.
- **Sentiment:** Usage and downloads do not measure whether people liked the app. Compare this brief with actual reviews, support messages, interviews, or social comments; keep the date and audience of that feedback explicit.

## Consultant reading

PASSPORT has reached multiple storefronts and its core stamp experience is being used in the production build. The 3 November cluster is worth matching against dated qualitative feedback. The sample remains too small and incomplete to attribute traction to a channel, judge onboarding conversion, assess retention, or infer purchase intent. The most valuable next evidence is a fresh official App Store Connect Analytics instance, a dated Vercel website export, and a small set of direct user comments from the same period.

## Reproduction and definitions

The read-only check used Supabase project `dsjgbxkerucutrjltgws`. The app is Apple ID `6822753543`, mapped in Kopa to `aso_apps.id = 926ad3c6-c68d-4b70-9dd0-c0073916d771`. All SQL below is read-only. Event days are the app's **device-local** calendar days; Apple Sales and Trends has its own reporting dates. Do not join their daily rows as if time zones and definitions were identical.

```sql
SELECT date, country, source, SUM(downloads) AS units, SUM(proceeds) AS proceeds
FROM public.aso_daily_metrics
WHERE app_id = '926ad3c6-c68d-4b70-9dd0-c0073916d771'
  AND source = 'appstore_connect_sales'
  AND date BETWEEN '2026-10-08' AND '2026-11-04'
GROUP BY date, country, source ORDER BY date, country;

SELECT day, event, SUM(count) AS events
FROM passport_analytics.daily_counts
WHERE build_channel = 'appstore' AND app_version = '1.0'
  AND day BETWEEN '2026-10-29' AND '2026-11-04'
  AND event IN ('app_opened', 'onboarding_presented', 'onboarding_completed',
                'first_stamp_completed', 'stamp_editor_opened', 'stamp_created',
                'journey_opened', 'photos_attached')
GROUP BY day, event ORDER BY day, event;

SELECT COUNT(*) AS storefront_rows FROM public.aso_storefront_metrics
WHERE app_id = '926ad3c6-c68d-4b70-9dd0-c0073916d771'
  AND date BETWEEN '2026-10-08' AND '2026-11-04';

SELECT COUNT(*) AS mapped_campaigns FROM public.apple_ads_campaigns
WHERE app_id = '926ad3c6-c68d-4b70-9dd0-c0073916d771';
```

**Validation:** The Sales query returned eight one-unit rows totaling eight units and zero proceeds; the storefront and campaign counts each returned zero *rows*. The event totals and the 3 November concentration were independently checked with grouped day/event queries. Missing reporting rows are labeled unavailable above, not interpreted as zero business activity.
