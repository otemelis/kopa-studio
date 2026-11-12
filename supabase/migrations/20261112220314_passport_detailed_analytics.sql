-- PASSPORT 1.3 opt-in events. Apply only after owner review and a restorable backup.
-- Existing anonymous daily_counts and ingest RPCs are deliberately unchanged.
create table passport_analytics.detailed_install_tokens (
  install_id uuid primary key,
  token_sha256 text not null check (token_sha256 ~ '^[0-9a-f]{64}$'),
  rate_window_at timestamptz not null default now(),
  batches_this_window integer not null default 0 check (batches_this_window between 0 and 60),
  created_at timestamptz not null default now()
);

create table passport_analytics.passport_detailed_events (
  event_id uuid primary key,
  schema_version smallint not null default 1 check (schema_version = 1),
  install_id uuid not null references passport_analytics.detailed_install_tokens(install_id) on delete cascade,
  session_id uuid not null,
  event_name text not null,
  occurred_at timestamptz not null,
  app_version text not null,
  build_number text not null,
  build_channel text not null check (build_channel in ('appstore', 'testflight', 'debug')),
  device_layout text not null,
  screen_id text not null,
  control_id text not null,
  properties jsonb not null check (jsonb_typeof(properties) = 'object'),
  event_document jsonb not null check (jsonb_typeof(event_document) = 'object'),
  received_at timestamptz not null default now()
);
create index passport_detailed_events_install_idx on passport_analytics.passport_detailed_events(install_id);
create index passport_detailed_events_event_time_idx on passport_analytics.passport_detailed_events(event_name, occurred_at);
create index passport_detailed_events_channel_time_idx on passport_analytics.passport_detailed_events(build_channel, occurred_at);

alter table passport_analytics.detailed_install_tokens enable row level security;
alter table passport_analytics.passport_detailed_events enable row level security;
revoke all on passport_analytics.detailed_install_tokens from public, anon, authenticated;
revoke all on passport_analytics.passport_detailed_events from public, anon, authenticated;
grant usage on schema passport_analytics to service_role;
grant select, insert, update, delete on passport_analytics.detailed_install_tokens to service_role;
grant select, insert, delete on passport_analytics.passport_detailed_events to service_role;

-- A single transaction serializes each installation and returns per-event acknowledgement.
-- Only the service-role Edge Function can invoke these RPCs; the browser has no grants.
create function public.passport_detailed_ingest(p_install uuid, p_hash text, p_events jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, passport_analytics as $$
declare
  old_hash text;
  window_at timestamptz;
  batch_count integer;
  item jsonb;
  existing jsonb;
  accepted jsonb := '[]'::jsonb;
  duplicates jsonb := '[]'::jsonb;
  rejected jsonb := '[]'::jsonb;
  eid uuid;
  inserted uuid;
begin
  if p_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) < 1
     or jsonb_array_length(p_events) > 50 then raise exception 'invalid detailed batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_install::text, 0));
  select token_sha256, rate_window_at, batches_this_window into old_hash, window_at, batch_count
    from passport_analytics.detailed_install_tokens where install_id = p_install for update;
  if old_hash is not null and old_hash <> p_hash then return jsonb_build_object('forbidden', true); end if;
  if old_hash is null then
    insert into passport_analytics.detailed_install_tokens(install_id, token_sha256, batches_this_window)
      values (p_install, p_hash, 1);
  elsif window_at <= now() - interval '1 hour' then
    update passport_analytics.detailed_install_tokens set rate_window_at = now(), batches_this_window = 1 where install_id = p_install;
  elsif batch_count >= 60 then
    return jsonb_build_object('rate_limited', true);
  else
    update passport_analytics.detailed_install_tokens set batches_this_window = batches_this_window + 1 where install_id = p_install;
  end if;
  for item in select value from jsonb_array_elements(p_events) loop
    eid := (item->>'event_id')::uuid;
    if (item->>'install_id')::uuid <> p_install then raise exception 'mixed installation batch'; end if;
    inserted := null;
    insert into passport_analytics.passport_detailed_events
        (event_id,install_id,session_id,event_name,occurred_at,app_version,build_number,build_channel,device_layout,screen_id,control_id,properties,event_document)
      values (eid,p_install,(item->>'session_id')::uuid,item->>'event_name',(item->>'occurred_at')::timestamptz,
        item->>'app_version',item->>'build_number',item->>'build_channel',item->>'device_layout',
        item->>'screen_id',item->>'control_id',item->'properties',item)
      on conflict (event_id) do nothing returning event_id into inserted;
    if inserted is not null then
      accepted := accepted || to_jsonb(eid::text);
    else
      select event_document into existing from passport_analytics.passport_detailed_events where event_id = eid;
      if existing = item then duplicates := duplicates || to_jsonb(eid::text);
      else rejected := rejected || jsonb_build_array(jsonb_build_object('event_id', eid::text, 'code', 'conflicting_duplicate')); end if;
    end if;
  end loop;
  return jsonb_build_object('schema_version',1,'accepted',accepted,'duplicates',duplicates,'rejected',rejected);
end $$;
revoke all on function public.passport_detailed_ingest(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.passport_detailed_ingest(uuid,text,jsonb) to service_role;

create function public.passport_detailed_erase(p_install uuid, p_hash text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, passport_analytics as $$
declare old_hash text;
begin
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid token hash'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_install::text, 0));
  select token_sha256 into old_hash from passport_analytics.detailed_install_tokens where install_id = p_install for update;
  if old_hash is not null and old_hash <> p_hash then return jsonb_build_object('forbidden', true); end if;
  delete from passport_analytics.detailed_install_tokens where install_id = p_install;
  return jsonb_build_object('schema_version',1,'erased',true);
end $$;
revoke all on function public.passport_detailed_erase(uuid,text) from public, anon, authenticated;
grant execute on function public.passport_detailed_erase(uuid,text) to service_role;

-- Server-only Kopa role: no browser grant, no write grant. Aggregation and
-- threshold suppression are enforced by the Kopa query, not a raw-data API.
grant usage on schema passport_analytics to kopa_report_reader;
grant select on passport_analytics.passport_detailed_events to kopa_report_reader;
create policy kopa_detailed_select on passport_analytics.passport_detailed_events
  for select to kopa_report_reader using (true);
