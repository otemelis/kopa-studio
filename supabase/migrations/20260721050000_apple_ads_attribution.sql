create table if not exists public.apple_ads_attribution (
 id uuid primary key default gen_random_uuid(), connection_id uuid references public.apple_ads_connections(id) on delete set null, app_id uuid not null references public.aso_apps(id) on delete cascade,
 installation_key text not null, campaign_id text, ad_group_id text, keyword_id text, ad_id text, attribution_state text, received_at timestamptz not null default now(), expires_at timestamptz, raw_payload jsonb not null, created_at timestamptz not null default now(), unique(app_id,installation_key)
);
alter table public.apple_ads_attribution enable row level security; revoke all on public.apple_ads_attribution from anon,authenticated;
