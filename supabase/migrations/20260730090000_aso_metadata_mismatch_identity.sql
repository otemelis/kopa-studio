-- Give ASO insights the same explicit historical lifecycle used by the
-- recommendation model, then converge legacy metadata mismatch rows on one
-- active app-and-scope identity without deleting prior evidence.

alter table aso_insights
  drop constraint if exists aso_insights_status_check;

alter table aso_insights
  add constraint aso_insights_status_check
  check (status in ('active','dismissed','snoozed','completed','superseded'));

with ranked as (
  select
    id,
    row_number() over (
      partition by app_id, coalesce(lower(country), 'portfolio')
      order by created_at desc, id desc
    ) as position
  from aso_insights
  where rule_id = 'metadata_mismatch'
    and status = 'active'
)
update aso_insights as insight
set
  status = 'superseded',
  snoozed_until = null,
  note = 'Superseded automatically by the current app-and-scope metadata mismatch insight during identity migration.',
  updated_at = now()
from ranked
where insight.id = ranked.id
  and ranked.position > 1;

update aso_insights
set
  dedupe_key = 'metadata_mismatch:' || app_id::text || ':' || coalesce(lower(country), 'portfolio'),
  updated_at = now()
where rule_id = 'metadata_mismatch'
  and status = 'active';

create unique index if not exists idx_insights_metadata_mismatch_current
  on aso_insights (app_id, coalesce(lower(country), 'portfolio'))
  where rule_id = 'metadata_mismatch'
    and status = 'active';
