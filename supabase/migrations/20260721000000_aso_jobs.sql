-- Durable control-plane jobs. Existing aso_sync_runs remains the collector's
-- execution history; aso_jobs records a requested operation before work starts.
create table if not exists public.aso_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('collection')),
  app_id uuid references public.aso_apps(id) on delete set null,
  country text,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  trigger_source text not null default 'tools' check (trigger_source in ('tools','cron','retry')),
  progress integer not null default 0 check (progress between 0 and 100),
  retry_count integer not null default 0,
  error_message text,
  sync_run_id uuid references public.aso_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
alter table public.aso_jobs enable row level security;
revoke all on public.aso_jobs from anon, authenticated;
create unique index if not exists idx_aso_jobs_active_scope on public.aso_jobs (job_type, coalesce(app_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(country, '')) where status in ('queued','running');
create or replace function public.aso_claim_next_job() returns setof public.aso_jobs language plpgsql security definer set search_path = public as $$
declare claimed public.aso_jobs;
begin
  select * into claimed from public.aso_jobs where status = 'queued' order by created_at asc for update skip locked limit 1;
  if not found then return; end if;
  update public.aso_jobs set status = 'running', started_at = now(), progress = 1 where id = claimed.id returning * into claimed;
  return next claimed;
end;
$$;
revoke all on function public.aso_claim_next_job() from public, anon, authenticated;
grant execute on function public.aso_claim_next_job() to service_role;
