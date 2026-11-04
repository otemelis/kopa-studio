-- Isolated local PostgreSQL fixture. Never run on the hosted project.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create table public.aso_apps(id uuid primary key);
create table public.aso_storefront_metrics(
  id uuid primary key default gen_random_uuid(), app_id uuid not null references public.aso_apps(id),
  date date not null, country text not null, event text not null, page_type text not null,
  source_type text not null, count integer not null, unique_count integer,
  import_key text not null unique, source text not null, parser_version text,
  raw_payload jsonb not null default '{}', created_at timestamptz not null default now(),
  unique(app_id,date,country,event,page_type,source_type,source)
);
create table public.aso_daily_metrics(
  id uuid primary key default gen_random_uuid(), app_id uuid not null references public.aso_apps(id),
  date date not null, country text not null, impressions integer, page_views integer,
  downloads integer, proceeds numeric, proceeds_currency text,
  import_key text not null unique, source text not null, parser_version text,
  raw_payload jsonb not null default '{}', created_at timestamptz not null default now(),
  unique(app_id,date,country,source)
);
insert into public.aso_apps values
  ('926ad3c6-c68d-4b70-9dd0-c0073916d771'),
  ('c6a04fc2-75ae-4c65-92fe-b696c9938413');
