-- Persist the competitor resource explicitly, then converge legacy competitor
-- gap rows on one active app-plus-competitor-and-scope identity. Older evidence
-- remains available as superseded history.

alter table aso_insights
  add column if not exists competitor_id uuid references aso_competitors (id) on delete set null;

update aso_insights
set competitor_id = nullif(split_part(dedupe_key, ':', 3), '')::uuid
where rule_id = 'competitor_wins_high_priority_terms'
  and competitor_id is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by app_id, competitor_id, coalesce(lower(country), 'portfolio')
      order by created_at desc, id desc
    ) as position
  from aso_insights
  where rule_id = 'competitor_wins_high_priority_terms'
    and status = 'active'
    and competitor_id is not null
)
update aso_insights as insight
set
  status = 'superseded',
  snoozed_until = null,
  note = 'Superseded automatically by the current app-plus-competitor-and-scope insight during identity migration.',
  updated_at = now()
from ranked
where insight.id = ranked.id
  and ranked.position > 1;

update aso_insights
set
  dedupe_key = 'competitor_wins_high_priority_terms:' || app_id::text || ':' || competitor_id::text || ':' || coalesce(lower(country), 'portfolio'),
  updated_at = now()
where rule_id = 'competitor_wins_high_priority_terms'
  and status = 'active'
  and competitor_id is not null;

create unique index if not exists idx_insights_competitor_wins_current
  on aso_insights (app_id, competitor_id, coalesce(lower(country), 'portfolio'))
  where rule_id = 'competitor_wins_high_priority_terms'
    and status = 'active'
    and competitor_id is not null;
