-- Kopa ASO Intelligence — schema.
-- All tables live in the hub Supabase project (the one /admin logs into).
-- Access pattern: server-side only, via the service-role key. RLS is enabled
-- on every table with NO policies, so the anon/publishable key can never
-- read or write ASO data; the service-role key bypasses RLS by design.

create extension if not exists pgcrypto;

-- ── Apps ────────────────────────────────────────────────────────────────

create table if not exists aso_apps (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  store_app_id text not null,
  bundle_id text,
  name text not null,
  subtitle text,
  developer text,
  description text,
  icon_url text,
  category text,
  primary_country text not null default 'us',
  current_version text,
  release_notes text,
  rating numeric,
  rating_count integer,
  price numeric,
  currency text,
  store_url text,
  languages jsonb,
  screenshot_urls jsonb,
  last_store_update_at timestamptz,
  source text not null default 'public_store',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, store_app_id)
);

create table if not exists aso_app_storefronts (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references aso_apps (id) on delete cascade,
  country text not null,
  is_primary boolean not null default false,
  metadata_localised boolean not null default false,
  screenshots_localised boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (app_id, country)
);

-- ── Keywords ────────────────────────────────────────────────────────────

create table if not exists aso_keyword_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'core' check (
    kind in ('core','genre','competitor','brand','long_tail','localised','experimental')
  ),
  created_at timestamptz not null default now()
);

create table if not exists aso_keywords (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  country text not null,
  language text,
  group_id uuid references aso_keyword_groups (id) on delete set null,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  notes text,
  created_at timestamptz not null default now(),
  unique (term, country)
);

create table if not exists aso_app_keywords (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references aso_apps (id) on delete cascade,
  keyword_id uuid not null references aso_keywords (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (app_id, keyword_id)
);

-- ── Competitors ─────────────────────────────────────────────────────────

create table if not exists aso_competitors (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references aso_apps (id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios','android')),
  store_app_id text not null,
  name text not null,
  icon_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (app_id, platform, store_app_id)
);

create table if not exists aso_competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references aso_competitors (id) on delete cascade,
  captured_at timestamptz not null default now(),
  name text not null,
  subtitle text,
  developer text,
  icon_url text,
  rating numeric,
  rating_count integer,
  price numeric,
  current_version text,
  release_notes text,
  screenshot_urls jsonb,
  checksum text not null,
  source text not null default 'public_store'
);

create index if not exists idx_competitor_snapshots_lookup
  on aso_competitor_snapshots (competitor_id, captured_at desc);

-- ── Rankings ────────────────────────────────────────────────────────────

create table if not exists aso_keyword_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references aso_keywords (id) on delete cascade,
  store_app_id text not null,
  app_kind text not null check (app_kind in ('owned','competitor')),
  captured_at timestamptz not null default now(),
  -- null = not ranked within result_depth. Never 0.
  rank integer check (rank is null or rank >= 1),
  found boolean not null,
  result_depth integer not null,
  previous_rank integer,
  change_7d integer,
  change_30d integer,
  best_rank integer,
  collection_status text not null default 'ok' check (collection_status in ('ok','partial','failed')),
  checksum text,
  source text not null default 'public_store'
);

create index if not exists idx_rank_snapshots_series
  on aso_keyword_rank_snapshots (keyword_id, store_app_id, captured_at desc);

create table if not exists aso_keyword_search_results (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references aso_keywords (id) on delete cascade,
  captured_at timestamptz not null default now(),
  captured_on date not null default current_date,
  results jsonb not null,
  result_depth integer not null,
  checksum text not null,
  source text not null default 'public_store',
  -- one stored result set per keyword per day keeps collection idempotent
  unique (keyword_id, captured_on)
);

-- ── Metadata history ────────────────────────────────────────────────────

create table if not exists aso_metadata_snapshots (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references aso_apps (id) on delete cascade,
  competitor_id uuid references aso_competitors (id) on delete cascade,
  country text not null,
  captured_at timestamptz not null default now(),
  name text not null,
  subtitle text,
  description text,
  icon_url text,
  screenshot_urls jsonb,
  current_version text,
  release_notes text,
  price numeric,
  checksum text not null,
  source text not null default 'public_store',
  check (app_id is not null or competitor_id is not null)
);

create index if not exists idx_metadata_snapshots_app
  on aso_metadata_snapshots (app_id, country, captured_at desc);

create table if not exists aso_metadata_change_events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references aso_apps (id) on delete cascade,
  competitor_id uuid references aso_competitors (id) on delete cascade,
  country text,
  change_type text not null,
  field text,
  old_value text,
  new_value text,
  happened_at timestamptz not null default now(),
  note text,
  origin text not null default 'manual' check (origin in ('detected','manual')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  check (app_id is not null or competitor_id is not null)
);

create index if not exists idx_change_events_app
  on aso_metadata_change_events (app_id, happened_at desc);

-- ── First-party metrics ─────────────────────────────────────────────────

create table if not exists aso_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references aso_apps (id) on delete cascade,
  date date not null,
  country text not null default 'all',
  impressions integer,
  page_views integer,
  downloads integer,
  proceeds numeric,
  import_key text not null unique,
  source text not null,
  created_at timestamptz not null default now(),
  unique (app_id, date, country, source)
);

create index if not exists idx_daily_metrics_series
  on aso_daily_metrics (app_id, country, date desc);

-- ── Reviews ─────────────────────────────────────────────────────────────

create table if not exists aso_reviews (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references aso_apps (id) on delete cascade,
  review_ref text not null,
  country text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  author text,
  version text,
  language text,
  reviewed_at timestamptz not null,
  developer_response text,
  response_status text not null default 'none' check (response_status in ('none','drafted','responded')),
  internal_status text not null default 'new' check (internal_status in ('new','reviewed','actioned')),
  internal_note text,
  source text not null default 'public_store',
  created_at timestamptz not null default now(),
  unique (app_id, review_ref)
);

create index if not exists idx_reviews_app_date on aso_reviews (app_id, reviewed_at desc);

create table if not exists aso_review_classifications (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references aso_reviews (id) on delete cascade unique,
  topics jsonb not null,
  sentiment text not null check (sentiment in ('negative','neutral','positive')),
  method text not null default 'rules',
  classified_at timestamptz not null default now()
);

-- ── Experiments ─────────────────────────────────────────────────────────

create table if not exists aso_experiments (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references aso_apps (id) on delete cascade,
  title text not null,
  hypothesis text,
  change_type text not null,
  country text not null default 'all',
  old_variant text,
  new_variant text,
  target_metric text not null default 'conversion'
    check (target_metric in ('impressions','page_views','downloads','conversion')),
  secondary_metrics jsonb,
  start_date date,
  end_date date,
  status text not null default 'planned' check (
    status in ('planned','running','monitoring','won','lost','inconclusive','reverted')
  ),
  result text,
  conclusion text,
  next_action text,
  asset_refs jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Insights ────────────────────────────────────────────────────────────

create table if not exists aso_insights (
  id uuid primary key default gen_random_uuid(),
  rule_id text not null,
  app_id uuid references aso_apps (id) on delete cascade,
  keyword_id uuid references aso_keywords (id) on delete cascade,
  experiment_id uuid references aso_experiments (id) on delete cascade,
  country text,
  title text not null,
  observation text not null,
  interpretation text not null,
  recommendation text not null,
  evidence jsonb not null,
  comparison_window text not null,
  confidence text not null check (confidence in ('low','medium','medium_high','high')),
  impact text not null check (impact in ('low','medium','high')),
  effort text not null check (effort in ('low','medium','high')),
  priority text not null check (priority in ('low','medium','high')),
  status text not null default 'active' check (status in ('active','dismissed','snoozed','completed')),
  snoozed_until timestamptz,
  dedupe_key text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insights_status on aso_insights (status, created_at desc);
create index if not exists idx_insights_dedupe on aso_insights (dedupe_key, created_at desc);

-- ── Sync observability ──────────────────────────────────────────────────

create table if not exists aso_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  trigger text not null default 'manual' check (trigger in ('manual','cron')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','partial','failed')),
  processed integer not null default 0,
  succeeded integer not null default 0,
  failed integer not null default 0,
  warnings integer not null default 0,
  retries integer not null default 0,
  summary jsonb,
  error text
);

create index if not exists idx_sync_runs_recent on aso_sync_runs (provider, started_at desc);

create table if not exists aso_sync_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references aso_sync_runs (id) on delete cascade,
  item text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists aso_csv_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  kind text not null default 'daily_metrics',
  rows_total integer not null,
  rows_imported integer not null,
  rows_rejected integer not null,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists aso_platform_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('appstore_connect','google_play')),
  status text not null default 'unconfigured' check (status in ('unconfigured','configured','error')),
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists aso_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── RLS: deny-all for anon/authenticated; service-role bypasses ─────────

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'aso\_%' escape '\'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
