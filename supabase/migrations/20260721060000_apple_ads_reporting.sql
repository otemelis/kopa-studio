create table if not exists public.apple_ads_daily_metrics (
 id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade, app_id uuid references public.aso_apps(id) on delete set null,
 campaign_id uuid references public.apple_ads_campaigns(id) on delete cascade, ad_group_id uuid references public.apple_ads_ad_groups(id) on delete cascade, keyword_id uuid references public.apple_ads_keywords(id) on delete cascade,
 metric_date date not null, country text not null default 'all', match_source text, impressions integer not null default 0, taps integer not null default 0, installs integer not null default 0, new_downloads integer not null default 0, redownloads integer not null default 0, spend numeric not null default 0, currency text, source_synced_at timestamptz not null default now(), raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(connection_id,campaign_id,ad_group_id,keyword_id,metric_date,country,match_source)
);
create index if not exists idx_apple_ads_daily_metrics_lookup on public.apple_ads_daily_metrics(connection_id,metric_date desc,campaign_id,ad_group_id);
alter table public.apple_ads_daily_metrics enable row level security; revoke all on public.apple_ads_daily_metrics from anon,authenticated;
