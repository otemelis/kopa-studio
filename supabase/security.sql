-- Run in the Supabase SQL editor after creating your Auth user.
-- This makes analytics readable only by users explicitly added to analytics_admins.

create table if not exists public.analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.analytics_admins enable row level security;
alter table public.analytics_events enable row level security;
alter table public.events enable row level security;

revoke all on table public.analytics_admins from anon, authenticated;
grant select on table public.analytics_events to authenticated;
grant select on table public.events to authenticated;
revoke all on table public.analytics_events from anon;
revoke all on table public.events from anon;

grant select on table public.analytics_admins to authenticated;

drop policy if exists "admins can read own membership" on public.analytics_admins;
create policy "admins can read own membership"
on public.analytics_admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "approved admins can read analytics" on public.analytics_events;
create policy "approved admins can read analytics"
on public.analytics_events
for select
to authenticated
using (
  exists (
    select 1
    from public.analytics_admins admins
    where admins.user_id = auth.uid()
  )
);

drop policy if exists "approved admins can read shared events" on public.events;
create policy "approved admins can read shared events"
on public.events
for select
to authenticated
using (
  exists (
    select 1
    from public.analytics_admins admins
    where admins.user_id = auth.uid()
  )
);

-- Add an administrator by email after creating them in Authentication > Users.
-- Replace the email, then run this statement in the SQL editor:
-- insert into public.analytics_admins (user_id)
-- select id from auth.users where lower(email) = lower('YOUR_LOGIN_EMAIL');

-- Confirm which accounts have access (safe to run in the SQL editor):
-- select users.email, admins.created_at
-- from public.analytics_admins admins
-- join auth.users users on users.id = admins.user_id;
