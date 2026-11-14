-- PASSPORT schema-2 running daily totals. Schema-1 tables and RPCs are unchanged.
-- The per-day random token is retained for 35 days, matching the existing
-- on-device offline queue. Older retries are rejected rather than counted twice.
create table passport_analytics.running_daily_counts (
  install_day_key uuid not null,
  day date not null,
  build_channel text not null check (build_channel in ('debug', 'testflight', 'appstore')),
  app_version text not null check (app_version ~ '^[0-9]+(\.[0-9]+){0,2}$'),
  event text not null check (event ~ '^[a-z][a-z_]{2,48}$'),
  dims text not null check (length(dims) <= 300),
  count bigint not null check (count > 0 and count <= 100000),
  updated_at timestamptz not null default now(),
  primary key (install_day_key, event, dims)
);
create index running_daily_counts_day_idx on passport_analytics.running_daily_counts (day);
alter table passport_analytics.running_daily_counts enable row level security;
revoke all on passport_analytics.running_daily_counts from public, anon, authenticated;
grant select, insert, update, delete on passport_analytics.running_daily_counts to service_role;

-- The collector has already validated every event key and count. Restrict this
-- RPC to the server-side service role, and serialize uploads for one day token.
create function public.passport_ingest_running_day(payload jsonb)
returns jsonb language plpgsql set search_path = '' as $function$
declare
  token uuid := (payload->>'install_day_key')::uuid;
  sent_day date := (payload->'days'->0->>'day')::date;
  today_utc date := (now() at time zone 'UTC')::date;
  ch text := payload->>'build_channel';
  ver text := payload->>'app_version';
  key text;
  value jsonb;
  event_name text;
  dimensions text;
  incoming bigint;
  previous bigint;
  delta bigint;
  old_day date;
  old_channel text;
  old_version text;
  accepted integer := 0;
  replaced_count integer := 0;
begin
  if payload->>'schema' <> '2' or token is null
     or jsonb_typeof(payload->'days') <> 'array'
     or jsonb_array_length(payload->'days') <> 1
     or sent_day < today_utc - 35 or sent_day > today_utc + 1
     or ch not in ('debug', 'testflight', 'appstore')
     or ver !~ '^[0-9]+(\.[0-9]+){0,2}$' then
    raise exception 'invalid running day' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(token::text, 0));
  if exists (
    select 1 from passport_analytics.running_daily_counts
    where install_day_key = token
      and (day <> sent_day or build_channel <> ch or app_version <> ver)
  ) then
    raise exception 'day token scope conflict' using errcode = '22023';
  end if;
  for key, value in select * from pg_catalog.jsonb_each(payload->'days'->0->'counts') loop
    event_name := split_part(key, '|', 1);
    dimensions := coalesce(substr(key, length(event_name) + 2), '');
    incoming := (value)::text::bigint;
    if incoming < 1 or incoming > 100000 then
      raise exception 'invalid running count' using errcode = '22023';
    end if;
    select count into previous from passport_analytics.running_daily_counts
      where install_day_key = token and event = event_name and dims = dimensions for update;
    if found then
      delta := greatest(incoming - previous, 0);
      if delta > 0 then
        update passport_analytics.running_daily_counts
          set count = incoming, updated_at = now()
          where install_day_key = token and event = event_name and dims = dimensions;
        replaced_count := replaced_count + 1;
      end if;
    else
      insert into passport_analytics.running_daily_counts
        (install_day_key, day, build_channel, app_version, event, dims, count)
        values (token, sent_day, ch, ver, event_name, dimensions, incoming);
      delta := incoming;
    end if;
    if delta > 0 then
      insert into passport_analytics.daily_counts as t
        (day, build_channel, app_version, event, dims, count)
        values (sent_day, ch, ver, event_name, dimensions, delta)
        on conflict (day, build_channel, app_version, event, dims)
        do update set count = t.count + excluded.count, updated_at = now();
    end if;
    accepted := accepted + 1;
  end loop;
  -- Compacted values remain in daily_counts; the per-day token is discarded.
  delete from passport_analytics.running_daily_counts where day < today_utc - 35;
  return pg_catalog.jsonb_build_object('rows', accepted, 'replaced', replaced_count);
end;
$function$;
revoke all on function public.passport_ingest_running_day(jsonb) from public, anon, authenticated;
grant execute on function public.passport_ingest_running_day(jsonb) to service_role;
