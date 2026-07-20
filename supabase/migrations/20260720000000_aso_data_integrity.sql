-- ASO data integrity: preserve historical observations while making all new
-- rank collection idempotent, and keep keyword strategy per app rather than
-- shared across every app that happens to track the same term.

alter table public.aso_app_keywords
  add column if not exists priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  add column if not exists group_id uuid references public.aso_keyword_groups (id) on delete set null,
  add column if not exists notes text,
  add column if not exists target_rank integer check (target_rank is null or target_rank >= 1),
  add column if not exists status text not null default 'active' check (status in ('active', 'paused')),
  add column if not exists updated_at timestamptz not null default now();

-- Copy the previous shared defaults once. New edits are stored on the link.
update public.aso_app_keywords ak
set
  priority = k.priority,
  group_id = k.group_id,
  notes = k.notes,
  updated_at = now()
from public.aso_keywords k
where ak.keyword_id = k.id;

alter table public.aso_keyword_rank_snapshots
  add column if not exists captured_on date,
  add column if not exists collection_key text;

-- Legacy rows retain their exact history. They are deliberately given unique
-- keys instead of being deleted or collapsed during this migration.
update public.aso_keyword_rank_snapshots
set captured_on = captured_at::date
where captured_on is null;

update public.aso_keyword_rank_snapshots
set collection_key = 'legacy:' || id::text
where collection_key is null;

alter table public.aso_keyword_rank_snapshots
  alter column captured_on set not null,
  alter column collection_key set not null;

create unique index if not exists idx_rank_snapshots_collection_key
  on public.aso_keyword_rank_snapshots (collection_key);

create index if not exists idx_rank_snapshots_freshness
  on public.aso_keyword_rank_snapshots (keyword_id, store_app_id, app_kind, captured_on desc);

-- A short database-backed lease prevents overlapping cron and manual runs
-- across separate Vercel instances. It expires automatically after a failed
-- invocation so collection can recover without human intervention.
create table if not exists public.aso_collection_locks (
  id boolean primary key default true check (id),
  holder text not null,
  acquired_at timestamptz not null default now(),
  lease_expires_at timestamptz not null
);

alter table public.aso_collection_locks enable row level security;

create or replace function public.aso_try_acquire_collection_lock(p_holder text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.aso_collection_locks (id, holder, acquired_at, lease_expires_at)
  values (true, p_holder, now(), now() + interval '6 minutes')
  on conflict (id) do update
    set holder = excluded.holder,
        acquired_at = excluded.acquired_at,
        lease_expires_at = excluded.lease_expires_at
    where public.aso_collection_locks.lease_expires_at <= now();

  return exists (
    select 1 from public.aso_collection_locks
    where id = true and holder = p_holder and lease_expires_at > now()
  );
end;
$$;

create or replace function public.aso_release_collection_lock(p_holder text)
returns boolean
language sql
security invoker
set search_path = public
as $$
  delete from public.aso_collection_locks
  where id = true and holder = p_holder;
  select true;
$$;

revoke all on table public.aso_collection_locks from anon, authenticated;
revoke all on function public.aso_try_acquire_collection_lock(text) from public, anon, authenticated;
revoke all on function public.aso_release_collection_lock(text) from public, anon, authenticated;
grant execute on function public.aso_try_acquire_collection_lock(text) to service_role;
grant execute on function public.aso_release_collection_lock(text) to service_role;
