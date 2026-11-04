-- REVIEW ONLY. Do not apply without the owner's explicit schema/permission approval.
-- Atomic Apple Analytics partition replacement; one app + source Date + report type.
create table if not exists public.aso_analytics_partition_state (
  app_id uuid not null references public.aso_apps(id) on delete cascade,
  date date not null,
  source text not null check (source in ('appstore_connect_discovery', 'appstore_connect_downloads')),
  processing_date date not null,
  payload_hash text not null,
  storefront_rows integer not null,
  daily_rows integer not null,
  imported_at timestamptz not null default now(),
  primary key (app_id, date, source)
);
alter table public.aso_analytics_partition_state enable row level security;
revoke all on public.aso_analytics_partition_state from public, anon, authenticated;
grant select, insert, update, delete on public.aso_analytics_partition_state to service_role;

create or replace function public.aso_replace_analytics_partition(p jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $fn$
declare
  v_app uuid;
  v_date date;
  v_source text;
  v_processing date;
  v_hash text;
  v_old public.aso_analytics_partition_state%rowtype;
  v_store_count integer;
  v_daily_count integer;
  v_inserted boolean;
begin
  if jsonb_typeof(p) <> 'object'
     or (select count(*) from jsonb_object_keys(p)) <> 7
     or not (p ?& array['app_id','date','source','processing_date','payload_hash','storefront_rows','daily_rows'])
     or jsonb_typeof(p->'storefront_rows') <> 'array'
     or jsonb_typeof(p->'daily_rows') <> 'array' then
    raise exception 'invalid partition shape' using errcode = '22023';
  end if;
  v_app := (p->>'app_id')::uuid;
  v_date := (p->>'date')::date;
  v_source := p->>'source';
  v_processing := (p->>'processing_date')::date;
  v_hash := p->>'payload_hash';
  if v_app <> '926ad3c6-c68d-4b70-9dd0-c0073916d771'::uuid
     or v_source not in ('appstore_connect_discovery','appstore_connect_downloads')
     or v_date::text <> p->>'date' or v_processing::text <> p->>'processing_date'
     or v_processing < v_date or v_processing > current_date + 2
     or v_date < current_date - 35
     or v_hash !~ '^[0-9a-f]{64}$'
     or jsonb_array_length(p->'storefront_rows') > 5000
     or jsonb_array_length(p->'daily_rows') > 500 then
    raise exception 'invalid partition bounds' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'storefront_rows') r
             where r->>'app_id' <> v_app::text or r->>'date' <> v_date::text or r->>'source' <> v_source)
     or exists (select 1 from jsonb_array_elements(p->'daily_rows') r
             where r->>'app_id' <> v_app::text or r->>'date' <> v_date::text
                or r->>'source' <> case when v_source='appstore_connect_downloads' then 'appstore_connect_first_time_downloads' else v_source end) then
    raise exception 'partition row scope mismatch' using errcode = '22023';
  end if;
  -- The state row serializes concurrent revisions for exactly this app/date/source.
  insert into public.aso_analytics_partition_state(app_id,date,source,processing_date,payload_hash,storefront_rows,daily_rows)
  values(v_app,v_date,v_source,v_processing,v_hash,0,0)
  on conflict (app_id,date,source) do nothing returning true into v_inserted;
  select * into v_old from public.aso_analytics_partition_state
    where app_id=v_app and date=v_date and source=v_source for update;
  if v_old.processing_date > v_processing then
    raise exception 'stale Apple processing revision' using errcode = '22023';
  end if;
  if v_inserted is not true and v_old.processing_date = v_processing and v_old.payload_hash = v_hash then
    return jsonb_build_object('state','unchanged','storefront_rows',v_old.storefront_rows,'daily_rows',v_old.daily_rows);
  end if;
  if v_inserted is not true and v_old.processing_date = v_processing and v_old.payload_hash <> v_hash then
    raise exception 'conflicting same-date Apple revision' using errcode = '22023';
  end if;
  delete from public.aso_storefront_metrics where app_id=v_app and date=v_date and source=v_source;
  delete from public.aso_daily_metrics where app_id=v_app and date=v_date
    and source=case when v_source='appstore_connect_downloads' then 'appstore_connect_first_time_downloads' else v_source end;
  insert into public.aso_storefront_metrics(app_id,date,country,event,page_type,source_type,count,unique_count,import_key,source,parser_version,raw_payload)
  select app_id,date,country,event,page_type,source_type,count,unique_count,import_key,source,parser_version,raw_payload
  from jsonb_to_recordset(p->'storefront_rows') as x(app_id uuid,date date,country text,event text,page_type text,source_type text,count integer,unique_count integer,import_key text,source text,parser_version text,raw_payload jsonb);
  get diagnostics v_store_count = row_count;
  insert into public.aso_daily_metrics(app_id,date,country,impressions,page_views,downloads,proceeds,proceeds_currency,import_key,source,parser_version,raw_payload)
  select app_id,date,country,impressions,page_views,downloads,proceeds,proceeds_currency,import_key,source,parser_version,raw_payload
  from jsonb_to_recordset(p->'daily_rows') as x(app_id uuid,date date,country text,impressions integer,page_views integer,downloads integer,proceeds numeric,proceeds_currency text,import_key text,source text,parser_version text,raw_payload jsonb);
  get diagnostics v_daily_count = row_count;
  update public.aso_analytics_partition_state set processing_date=v_processing,payload_hash=v_hash,
    storefront_rows=v_store_count,daily_rows=v_daily_count,imported_at=now()
    where app_id=v_app and date=v_date and source=v_source;
  return jsonb_build_object('state','replaced','storefront_rows',v_store_count,'daily_rows',v_daily_count);
end;
$fn$;
revoke all on function public.aso_replace_analytics_partition(jsonb) from public, anon, authenticated;
grant execute on function public.aso_replace_analytics_partition(jsonb) to service_role;
