create table if not exists public.apple_ads_campaigns (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  app_id uuid references public.aso_apps(id) on delete set null, apple_campaign_id text not null, adam_id text not null,
  name text not null, status text not null, serving_status text, bidding_strategy text, daily_budget_amount numeric, currency text,
  countries_or_regions jsonb not null default '[]'::jsonb, start_time timestamptz, end_time timestamptz, source_modified_at timestamptz,
  source_synced_at timestamptz not null default now(), is_deleted boolean not null default false, raw_payload jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(connection_id, apple_campaign_id)
);
create index if not exists idx_apple_ads_campaigns_connection_app on public.apple_ads_campaigns(connection_id, app_id);
alter table public.apple_ads_campaigns enable row level security;
revoke all on public.apple_ads_campaigns from anon, authenticated;

create table if not exists public.apple_ads_sync_runs (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  resource_type text not null check(resource_type in ('campaigns')), status text not null default 'queued' check(status in ('queued','running','completed','partial','failed')),
  rows_inserted integer not null default 0, rows_updated integer not null default 0, pagination_count integer not null default 0, error_message text,
  created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz
);
create unique index if not exists idx_apple_ads_campaign_sync_active on public.apple_ads_sync_runs(connection_id, resource_type) where status in ('queued','running');
alter table public.apple_ads_sync_runs enable row level security;
revoke all on public.apple_ads_sync_runs from anon, authenticated;
