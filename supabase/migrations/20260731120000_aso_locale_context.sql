-- Preserve exact App Store locale context when a structured source supplies
-- it. Existing country-only evidence remains intentionally unknown.

alter table aso_metadata_snapshots
  add column if not exists locale text;

alter table aso_metadata_change_events
  add column if not exists locale text;

alter table aso_insights
  add column if not exists locale text;

drop index if exists idx_insights_metadata_mismatch_current;

update aso_insights
set
  status = 'superseded',
  snoozed_until = null,
  note = 'Superseded because the historical language-dependent conclusion has no exact App Store locale context.',
  updated_at = now()
where rule_id in (
    'metadata_mismatch',
    'keyword_opportunity',
    'keyword_rising_after_change',
    'keyword_declined_after_removal'
  )
  and status = 'active'
  and locale is null;

create unique index if not exists idx_insights_metadata_mismatch_current
  on aso_insights (
    app_id,
    coalesce(lower(country), 'portfolio'),
    coalesce(lower(locale), 'unknown')
  )
  where rule_id = 'metadata_mismatch'
    and status = 'active';

create index if not exists idx_metadata_snapshots_locale
  on aso_metadata_snapshots (app_id, country, locale, captured_at desc);
