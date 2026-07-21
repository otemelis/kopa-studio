-- Milestone 2: read-only ad-group and keyword structure storage.
alter table public.apple_ads_sync_runs drop constraint if exists apple_ads_sync_runs_resource_type_check;
alter table public.apple_ads_sync_runs add constraint apple_ads_sync_runs_resource_type_check check(resource_type in ('campaigns','structure'));
create table if not exists public.apple_ads_ad_groups (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  campaign_id uuid not null references public.apple_ads_campaigns(id) on delete cascade, apple_ad_group_id text not null,
  name text not null, status text not null, serving_status text, default_bid_amount numeric, currency text, search_match_enabled boolean,
  source_modified_at timestamptz, source_synced_at timestamptz not null default now(), is_deleted boolean not null default false, raw_payload jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(connection_id, apple_ad_group_id)
);
create table if not exists public.apple_ads_keywords (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  campaign_id uuid not null references public.apple_ads_campaigns(id) on delete cascade, ad_group_id uuid not null references public.apple_ads_ad_groups(id) on delete cascade,
  apple_keyword_id text not null, keyword_text text not null, normalized_keyword text not null, match_type text, status text, serving_status text,
  bid_amount numeric, currency text, source_modified_at timestamptz, source_synced_at timestamptz not null default now(), is_deleted boolean not null default false, raw_payload jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(connection_id, apple_keyword_id)
);
create table if not exists public.apple_ads_negative_keywords (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  campaign_id uuid not null references public.apple_ads_campaigns(id) on delete cascade, ad_group_id uuid references public.apple_ads_ad_groups(id) on delete cascade,
  apple_negative_keyword_id text not null, keyword_text text not null, normalized_keyword text not null, match_type text, status text,
  source_modified_at timestamptz, source_synced_at timestamptz not null default now(), is_deleted boolean not null default false, raw_payload jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(connection_id, apple_negative_keyword_id)
);
create index if not exists idx_apple_ads_keywords_lookup on public.apple_ads_keywords(connection_id, normalized_keyword, match_type);
create index if not exists idx_apple_ads_negative_keywords_lookup on public.apple_ads_negative_keywords(connection_id, normalized_keyword);
alter table public.apple_ads_ad_groups enable row level security; alter table public.apple_ads_keywords enable row level security; alter table public.apple_ads_negative_keywords enable row level security;
revoke all on public.apple_ads_ad_groups, public.apple_ads_keywords, public.apple_ads_negative_keywords from anon, authenticated;
