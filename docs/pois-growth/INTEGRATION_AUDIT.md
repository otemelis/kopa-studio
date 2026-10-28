# POIS Growth integration audit

Read-only inventory, 28 October 2026. This is evidence for the first Kopa Growth slice, not a claim that all acquisition and subscription sources are connected.

| Source | Verified access and result | Grain / dimensions | Latency and authority | Blocker |
| --- | --- | --- | --- | --- |
| POIS `form.events` | Supabase SQL read succeeded. `appstore` 1.0: 144 events, 7 installation IDs, 2 session IDs. `testflight` 1.1: 67 events, 1 installation ID, no session ID. Debug and older TestFlight rows also exist and must remain separate. | Event ID, anonymous installation ID, optional real-session ID, event name, properties, occurred/received time, app version, build channel. | Client-observed product behavior; latest production receive was 28 Oct 22:45 UTC at audit time. | Production 1.1 is not yet observed. Client purchase signals cannot establish payment. |
| Kopa private POIS reader | Existing `kopa_report_reader` has SELECT on the required `form.events` columns including `properties`, with no INSERT/UPDATE/DELETE. Existing server pool pins host, role, read-only transactions, TLS, timeout and row cap. | Server-only bounded query. | Live on request. | Do not send raw IDs or properties to browser. Never use the admin SQL connection in the page. |
| ASC Analytics | Existing `aso_storefront_metrics` loader is available in Kopa, but the POIS app currently has **no** rows. | Daily app/country/event/page/source aggregates. | Apple-authoritative when a report exists; delayed and possibly thresholded. | Impressions, product-page views, App Store Search downloads and CPP metrics are unavailable for POIS today, not zero. |
| ASC Sales & Trends | Existing `aso_daily_metrics` has 8 POIS rows dated 21–25 Oct, 8 sales-report units across AU, BE, DE, RO, SN and US; 1 AU unit. | Daily app/country units and proceeds. | Official Sales & Trends; distinct from first-time downloads. | Units are not unique people or necessarily first-time downloads. Rows with null proceeds currency do not support a currency amount. |
| Apple Ads | Existing Apple Ads API/import and `apple_ads_daily_metrics` tables are present. No POIS-mapped daily rows were found in the current Kopa query. The supplied official AU ad-group CSV has 72 impressions, 2 taps, 1 total install, 1 new download and EUR 0.83 spend for **21–27 Oct**, UTC. | Daily campaign rows when imported; supplied CSV is one seven-day aggregate. | Apple Ads attribution, not ASC downloads or product events. | Historical CSV is not imported to the current POIS daily table; do not show its totals as current or daily data. |
| RevenueCat / verified lifecycle | POIS client configuration still has `apiKey = nil`, selecting native StoreKit. `form.revenuecat_events` has 29 rows, all SANDBOX; `subscription_state` has zero rows. | Provider events/transaction chain if a verified production feed later exists. | No verified production subscription lifecycle today. | Trial, first charge, paid subscribers, renewals, refunds and ROAS remain unavailable. Sandbox rows are not customers. |
| Meta Ads | No Meta Ads integration in the Kopa source inspected, no matching Meta Ads table, and no official report supplied for this milestone. | — | Unavailable. | A future manual CSV must carry account, campaign, window, currency and import provenance; no synthetic zeros. |
| POIS website | Separate Vercel Web Analytics is collecting visits, as confirmed by the owner. | Website visitor/page view aggregates. | Vercel website measurement. | No authorized export or API feed is connected to Kopa; never join Vercel visitors to POIS installation IDs. |

## Event evidence and boundaries

Production 1.0 read-only checks found `app_opened(first_launch=true)` for 7 installation IDs; `airpods_state_changed(state=sensing)` for 2; `proof_cue_actually_played` for 2; 2 real `session_started` IDs; 1 `session_ended` with `tracked_seconds=27`; 1 installation ID viewing a non-preview paywall; no `purchase_completed` in the inspected production rows. These are small, observed cohorts, not representative conversion rates. First-open events may be missing for users who opted out or failed to upload. The event catalog in the current 1.1 source includes additional events, but 1.1 has only TestFlight/debug observations at this audit date, so its new definitions cannot be applied to production history.

The collector is receiving rows: 144 distinct production event IDs for 144 rows. This checks stored deduplication, not whether the client silently discarded rejected events. The existing POIS client issues around HTTP 200 partial rejection and recovered-session IDs still need release-specific verification; this Growth work does not change the iOS app or collector.

## Reproduction queries

Run read-only in the existing Supabase project. No identifiers need be exported.

```sql
select build_channel, app_version, count(*) events,
       count(distinct event_id) distinct_events,
       count(distinct installation_id) installations,
       count(distinct session_id) sessions, max(received_at) latest
from form.events group by 1,2 order by 1,2;

select event_name, properties->>'state' state,
       properties->>'first_launch' first_launch,
       properties->>'preview' preview,
       count(*) events, count(distinct installation_id) installations
from form.events
where build_channel='appstore' and app_version='1.0'
  and event_name in ('app_opened','airpods_state_changed',
                     'proof_cue_actually_played','paywall_viewed','purchase_completed')
group by 1,2,3,4 order by 1,2,3,4;
```

Kopa's existing owner-only `/pois-signals`, `/analytics?app=pois`, ASC and Apple Ads routes already enforce authentication. The new Growth page must use the same shell and source readers. No schema or permission change is needed for the first slice.
