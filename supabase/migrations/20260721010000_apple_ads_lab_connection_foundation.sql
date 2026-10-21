-- Apple Ads Lab — Milestone 1 read-only connection foundation.
-- The existing platform is owner-only and has no organizations table yet, so
-- organization_id is intentionally nullable until a tenant model exists.

create table if not exists public.apple_ads_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  owner_user_id uuid not null,
  provider text not null default 'apple_ads' check (provider = 'apple_ads'),
  apple_ads_org_id text unique,
  apple_ads_org_name text,
  currency text,
  timezone text,
  permission_mode text not null default 'read_only' check (permission_mode in ('read_only', 'read_write')),
  credential_reference text not null default 'environment',
  status text not null default 'unconfigured' check (status in ('unconfigured', 'configured', 'healthy', 'error', 'disabled')),
  last_token_success_at timestamptz,
  last_api_success_at timestamptz,
  last_full_sync_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, apple_ads_org_id)
);

create table if not exists public.apple_ads_app_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  app_id uuid not null references public.aso_apps(id) on delete restrict,
  adam_id text not null,
  apple_app_name text,
  mapping_status text not null default 'confirmed' check (mapping_status in ('proposed', 'confirmed', 'error', 'unmapped')),
  mapped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, adam_id),
  unique (connection_id, app_id)
);

create index if not exists idx_apple_ads_connections_owner on public.apple_ads_connections(owner_user_id, created_at desc);
create index if not exists idx_apple_ads_app_mappings_app on public.apple_ads_app_mappings(app_id);

alter table public.apple_ads_connections enable row level security;
alter table public.apple_ads_app_mappings enable row level security;
revoke all on public.apple_ads_connections, public.apple_ads_app_mappings from anon, authenticated;
