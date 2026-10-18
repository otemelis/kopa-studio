-- Keep one ordered result-set snapshot per keyword, day, and source.
-- Existing rows retain their current source and contents.
alter table public.aso_keyword_search_results
  drop constraint if exists aso_keyword_search_results_keyword_id_captured_on_key;

alter table public.aso_keyword_search_results
  drop constraint if exists aso_keyword_search_results_keyword_day_source_key;

alter table public.aso_keyword_search_results
  add constraint aso_keyword_search_results_keyword_day_source_key
  unique (keyword_id, captured_on, source);

create index if not exists idx_keyword_search_results_source_history
  on public.aso_keyword_search_results (keyword_id, source, captured_at desc);
