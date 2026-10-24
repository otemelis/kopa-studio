# LoveType live signals — source and validation

The owner-only `/lovetype-signals` page reads only `public.events` in the existing Supabase project. Website rows use `app_id = 'lovetype-web'`; iOS app rows use `app_id = 'lovetype'`. Both reads require `environment = 'prod'`, use client event time for the rolling 7/28-day UTC window, and fail independently. A failed or incomplete read displays **unavailable**, never zero or a fixture.

Website visit counts use distinct temporary visit IDs on `page_view`. App active and step counts use distinct app installation IDs. These identifiers are different and cannot be joined. Website country is inferred from browser language. App Store tap events are website clicks, not downloads. `purchase_completed` is a client event, not verified sales or proceeds. `is_mock=true` and `is_preview=true` paywall events are excluded from production purchase measures.

The observed production website page view on 24 October omitted `page_index`, although the website notes describe it. Entry referrers and daily visit dates therefore use the earliest observed page view per visit ID, with missing-index coverage shown on the page. That is the first *observed* page, not proof that earlier pages were captured.

Exact duplicate event rows (same app, event name, installation/visit ID, session ID, client timestamp and properties) are excluded from activity counts. This is provisional because the shared table has no client event ID. The page exposes the excluded row count. A durable event-ID/idempotency fix belongs in the collector/app transport, not this read-only view.

Independent SQL control (run against the same 7-day window; compare when reviewing live results):

```sql
WITH source AS (
  SELECT app_id, event_name, anonymous_id, session_id, client_event_time, properties
  FROM public.events
  WHERE app_id IN ('lovetype', 'lovetype-web')
    AND environment = 'prod'
    AND client_event_time >= now() - interval '7 days'
), deduplicated AS (
  SELECT DISTINCT ON (app_id, event_name, anonymous_id, session_id, client_event_time, properties) *
  FROM source
)
SELECT app_id, count(*) AS deduplicated_events,
  count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'onboarding_started') AS onboarding_starts,
  count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'onboarding_completed') AS onboarding_completions,
  count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'test_started') AS test_starts,
  count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'test_completed') AS test_completions,
  count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'page_view') AS website_visits,
  count(*) FILTER (WHERE event_name = 'page_view') AS page_views,
  count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'app_store_tap') AS app_store_tap_visits
FROM deduplicated GROUP BY app_id;
```

At 2026-10-24 12:08 UTC the independent control returned 180 deduplicated app events, 3 onboarding starts, 3 completions, 3 test starters, 1 test completer; website 1 visit and 1 page view. The app had 240 raw rows, so 60 exact repeats were excluded. No production paywall or purchase events were present. This is an early production-tagged sample and may include developer testing.

New paywall context exists in the LoveType source but had not shipped in the observed app build. Validate on a new production build before interpreting paywall entry point or trigger-test comparisons. Genuine website-to-app attribution requires a shared authorized attribution mechanism or Apple-provided campaign source; time proximity is not identity evidence.
