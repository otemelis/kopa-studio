-- Kopa ASO Intelligence — RLS policies.
-- Run after supabase/migrations/20260719000000_aso_intelligence.sql and
-- after supabase/security.sql (this reuses the analytics_admins table that
-- file creates). Same trust model as the existing analytics console: any
-- user in analytics_admins can read everything and write the "human input"
-- tables directly from the browser via PostgREST + their session token.
-- Collector/engine output tables (rankings, reviews, sync history, snapshots)
-- are read-only here — only the service-role key (used exclusively inside
-- api/aso/collect.js, never sent to the browser) can write to those.

-- ── Tables writable directly by admins from the console ──────────────────

do $$
declare
  t text;
  writable text[] := array[
    'aso_apps',
    'aso_app_storefronts',
    'aso_keyword_groups',
    'aso_keywords',
    'aso_app_keywords',
    'aso_competitors',
    'aso_experiments',
    'aso_insights',
    'aso_alert_preferences'
  ];
begin
  foreach t in array writable loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('revoke all on table public.%I from anon', t);

    execute format('drop policy if exists "admins can read %1$s" on public.%1$s', t);
    execute format(
      'create policy "admins can read %1$s" on public.%1$s for select to authenticated using (exists (select 1 from public.analytics_admins a where a.user_id = auth.uid()))',
      t
    );

    execute format('drop policy if exists "admins can write %1$s" on public.%1$s', t);
    execute format(
      'create policy "admins can write %1$s" on public.%1$s for insert to authenticated with check (exists (select 1 from public.analytics_admins a where a.user_id = auth.uid()))',
      t
    );

    execute format('drop policy if exists "admins can update %1$s" on public.%1$s', t);
    execute format(
      'create policy "admins can update %1$s" on public.%1$s for update to authenticated using (exists (select 1 from public.analytics_admins a where a.user_id = auth.uid())) with check (exists (select 1 from public.analytics_admins a where a.user_id = auth.uid()))',
      t
    );

    execute format('drop policy if exists "admins can delete %1$s" on public.%1$s', t);
    execute format(
      'create policy "admins can delete %1$s" on public.%1$s for delete to authenticated using (exists (select 1 from public.analytics_admins a where a.user_id = auth.uid()))',
      t
    );
  end loop;
end $$;

-- ── Tables read-only to admins; written only by the collection job ───────
-- (service-role key bypasses RLS entirely, so no policy is needed for it)

do $$
declare
  t text;
  readonly text[] := array[
    'aso_keyword_rank_snapshots',
    'aso_keyword_search_results',
    'aso_metadata_snapshots',
    'aso_metadata_change_events',
    'aso_competitor_snapshots',
    'aso_daily_metrics',
    'aso_reviews',
    'aso_review_classifications',
    'aso_sync_runs',
    'aso_sync_errors',
    'aso_csv_imports',
    'aso_platform_connections'
  ];
begin
  foreach t in array readonly loop
    execute format('grant select on table public.%I to authenticated', t);
    execute format('revoke all on table public.%I from anon', t);

    execute format('drop policy if exists "admins can read %1$s" on public.%1$s', t);
    execute format(
      'create policy "admins can read %1$s" on public.%1$s for select to authenticated using (exists (select 1 from public.analytics_admins a where a.user_id = auth.uid()))',
      t
    );
  end loop;
end $$;

-- Note: aso_metadata_change_events and aso_daily_metrics also accept manual
-- entries from the console (recording a change event, CSV import rows) even
-- though most of their rows come from the collector. Manual writes to those
-- two go through api/aso/collect.js's sibling endpoints in a later pass —
-- for this pass they are read-only from the client, matching what's
-- actually built (metadata history / CSV import UI are deferred).
