-- Required because the existing recommendation table only stores prose summaries.
-- These additive fields preserve the scoped evidence/action contract and make
-- repeated assessment runs idempotent without creating a parallel system.
alter table public.apple_ads_recommendations
  add column if not exists storefront text,
  add column if not exists target_type text,
  add column if not exists target_text text,
  add column if not exists ad_group_id uuid references public.apple_ads_ad_groups(id) on delete set null,
  add column if not exists keyword_id uuid references public.apple_ads_keywords(id) on delete set null,
  add column if not exists evidence_window jsonb,
  add column if not exists observation text,
  add column if not exists diagnosis text,
  add column if not exists proposed_action text,
  add column if not exists review_condition text,
  add column if not exists evidence jsonb,
  add column if not exists evidence_quality jsonb,
  add column if not exists rule_version text,
  add column if not exists dedupe_key text,
  add column if not exists evidence_fingerprint text;

create unique index if not exists idx_apple_ads_recommendations_dedupe
  on public.apple_ads_recommendations(connection_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_apple_ads_recommendations_scope
  on public.apple_ads_recommendations(app_id, storefront, campaign_id, status, generated_at desc);
