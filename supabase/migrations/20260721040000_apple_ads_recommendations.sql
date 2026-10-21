create table if not exists public.apple_ads_decision_snapshots (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  data_window jsonb not null, metrics jsonb not null, aso_context jsonb not null default '{}'::jsonb, model_version text not null, rule_version text not null, created_at timestamptz not null default now()
);
create table if not exists public.apple_ads_recommendations (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.apple_ads_connections(id) on delete cascade,
  app_id uuid references public.aso_apps(id) on delete set null, campaign_id uuid references public.apple_ads_campaigns(id) on delete set null,
  recommendation_type text not null, source text not null check(source in ('rules','ai','hybrid')), status text not null default 'active' check(status in ('active','accepted','rejected','superseded','expired')),
  priority text not null check(priority in ('low','medium','high')), confidence integer not null check(confidence between 0 and 100), financial_risk integer not null check(financial_risk between 0 and 100),
  title text not null, evidence_summary text not null, deterministic_rationale text, ai_rationale text, snapshot_id uuid references public.apple_ads_decision_snapshots(id) on delete set null,
  generated_at timestamptz not null default now(), expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_apple_ads_recommendations_feed on public.apple_ads_recommendations(connection_id,status,generated_at desc);
alter table public.apple_ads_decision_snapshots enable row level security; alter table public.apple_ads_recommendations enable row level security;
revoke all on public.apple_ads_decision_snapshots, public.apple_ads_recommendations from anon, authenticated;
