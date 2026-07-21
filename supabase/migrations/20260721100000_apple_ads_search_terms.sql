create table if not exists public.apple_ads_search_terms (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
 app_id uuid references public.aso_apps(id) on delete set null,
 campaign_id uuid references public.apple_ads_campaigns(id) on delete cascade,
 ad_group_id uuid references public.apple_ads_ad_groups(id) on delete set null,
 keyword_id uuid references public.apple_ads_keywords(id) on delete set null,
 search_term text not null,
 source_keyword_text text,
 match_source text,
 country text not null default 'all',
 metric_date date not null,
 impressions integer not null default 0,
 taps integer not null default 0,
 installs integer not null default 0,
 spend numeric not null default 0,
 currency text,
 intent_cluster text,
 product_fit text,
 suggested_action text,
 source_synced_at timestamptz not null default now(),
 raw_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(connection_id,campaign_id,ad_group_id,keyword_id,search_term,country,metric_date,match_source)
);

create index if not exists idx_apple_ads_search_terms_lookup
 on public.apple_ads_search_terms(connection_id,metric_date desc,campaign_id,ad_group_id);

create index if not exists idx_apple_ads_search_terms_term
 on public.apple_ads_search_terms(search_term);

alter table public.apple_ads_search_terms enable row level security;
revoke all on public.apple_ads_search_terms from anon,authenticated;
