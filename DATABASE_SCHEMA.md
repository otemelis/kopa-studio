# ASO database schema map

The migration retains the existing Supabase schema. Approximate volume and refresh frequency must be captured from production before any schema change.

| Table group | Purpose / owner | Source / refresh | Migration decision |
| --- | --- | --- | --- |
| `aso_apps`, `aso_app_storefronts` | tracked app catalogue | human + public store | retain |
| `aso_keywords`, `aso_keyword_groups`, `aso_app_keywords` | keyword strategy | human | retain |
| `aso_keyword_rank_snapshots`, `aso_keyword_search_results` | rank history and raw results | public collector / daily | retain |
| `aso_competitors`, `aso_competitor_snapshots` | competitor catalogue/history | human + public collector | retain |
| `aso_metadata_snapshots`, `aso_metadata_change_events` | metadata history/diffs | public collector | retain |
| `aso_daily_metrics`, `aso_storefront_metrics` | sales/discovery metrics | App Store Connect / daily | retain |
| `aso_reviews`, `aso_review_classifications` | review intelligence | public collector | retain |
| `aso_experiments` | measurement records | human | retain |
| `aso_insights` | deterministic recommendations | rule engine | retain |
| `aso_sync_runs`, `aso_sync_errors`, `aso_collection_locks` | worker observability / concurrency | collector | retain; normalize only after queue decision |
| `aso_platform_connections`, `aso_analytics_report_requests` | App Store Connect state | private integration | retain |

RLS currently allows `analytics_admins` to read ASO data and limits collector-only writes to the service role. Future tenancy fields must be introduced only at true ownership boundaries after a migration plan; no blanket `organization_id` change is planned.
