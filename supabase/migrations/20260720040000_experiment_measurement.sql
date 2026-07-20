alter table public.aso_experiments
  add column if not exists evaluation_days integer not null default 14
    check (evaluation_days between 7 and 60),
  add column if not exists success_threshold numeric not null default 1
    check (success_threshold >= 0),
  add column if not exists success_threshold_unit text not null default 'percentage_points'
    check (success_threshold_unit in ('percent', 'percentage_points')),
  add column if not exists decision_recommendation text
    check (decision_recommendation in ('awaiting_data', 'winner', 'loser', 'inconclusive')),
  add column if not exists recommended_at timestamptz;
