alter table public.aso_analytics_report_requests
  add column if not exists last_result_state text,
  add column if not exists last_result_detail text,
  add column if not exists parser_version text,
  add column if not exists last_segment_count integer,
  add column if not exists last_source_row_count integer,
  add column if not exists last_imported_row_count integer,
  add column if not exists last_rejected_row_count integer,
  add column if not exists last_report_headers jsonb not null default '[]'::jsonb,
  add column if not exists last_issues jsonb not null default '[]'::jsonb,
  add column if not exists last_evidence_start date,
  add column if not exists last_evidence_end date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'aso_analytics_report_requests_result_state_check'
  ) then
    alter table public.aso_analytics_report_requests
      add constraint aso_analytics_report_requests_result_state_check
      check (last_result_state is null or last_result_state in ('success', 'zero', 'partial', 'error'));
  end if;
end
$$;

alter table public.aso_storefront_metrics
  add column if not exists parser_version text,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

alter table public.aso_daily_metrics
  add column if not exists parser_version text,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;
