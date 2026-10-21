BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT c.apple_campaign_id,c.name,m.metric_date,m.country,m.spend,m.currency,
       m.impressions,m.taps,m.installs,m.new_downloads,m.redownloads,m.source_synced_at,
       m.raw_payload->'totalInstalls' AS raw_total_installs,
       m.raw_payload->'tapInstalls' AS raw_tap_installs,
       m.raw_payload->'viewInstalls' AS raw_view_installs
FROM public.apple_ads_daily_metrics m
JOIN public.apple_ads_campaigns c ON c.id=m.campaign_id
WHERE m.metric_date BETWEEN '2026-10-11' AND '2026-10-14'
  AND m.ad_group_id IS NULL AND m.keyword_id IS NULL AND m.match_source IS NULL
ORDER BY m.metric_date,c.apple_campaign_id;
COMMIT;
