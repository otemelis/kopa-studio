create table if not exists public.aso_analytics_report_requests (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null unique references public.aso_apps (id) on delete cascade,
  appstore_connect_request_id text not null unique,
  access_type text not null default 'ONGOING',
  status text not null default 'requested' check (status in ('requested', 'pending', 'active', 'error')),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aso_storefront_metrics (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.aso_apps (id) on delete cascade,
  date date not null,
  country text not null,
  event text not null,
  page_type text not null,
  source_type text not null,
  count integer not null,
  unique_count integer,
  import_key text not null unique,
  source text not null default 'appstore_connect_discovery',
  created_at timestamptz not null default now(),
  unique (app_id, date, country, event, page_type, source_type, source)
);

create index if not exists idx_storefront_metrics_series
  on public.aso_storefront_metrics (app_id, country, date desc);

alter table public.aso_analytics_report_requests enable row level security;
alter table public.aso_storefront_metrics enable row level security;
