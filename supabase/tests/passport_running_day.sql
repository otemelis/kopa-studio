\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema passport_analytics;
create table passport_analytics.daily_counts (
  day date not null, build_channel text not null, app_version text not null,
  event text not null, dims text not null, count bigint not null check (count > 0),
  updated_at timestamptz not null default now(),
  primary key (day, build_channel, app_version, event, dims)
);
grant usage on schema passport_analytics to service_role;
grant select, insert, update on passport_analytics.daily_counts to service_role;
\i supabase/migrations/20261114130821_passport_running_daily_counts.sql

-- Simulate an existing schema-1 aggregate. It must never be replaced.
insert into passport_analytics.daily_counts (day, build_channel, app_version, event, dims, count)
values (current_date, 'appstore', '1.3', 'app_opened', 'layout=regular', 5);

create temp table test_results (case_name text, response jsonb, total bigint);
insert into test_results
select 'first', public.passport_ingest_running_day(jsonb_build_object(
  'schema', 2, 'install_day_key', '3f0c1d9e-6a2b-4c8e-9d7f-1a2b3c4d5e6f',
  'build_channel', 'appstore', 'app_version', '1.3', 'days', jsonb_build_array(
    jsonb_build_object('day', current_date::text, 'counts', jsonb_build_object('app_opened|layout=regular', 2))))) ,
  (select count from passport_analytics.daily_counts where day=current_date and event='app_opened');
update test_results set total = (select count from passport_analytics.daily_counts where day=current_date and event='app_opened') where case_name='first';
insert into test_results
select 'retry', public.passport_ingest_running_day(jsonb_build_object(
  'schema', 2, 'install_day_key', '3f0c1d9e-6a2b-4c8e-9d7f-1a2b3c4d5e6f',
  'build_channel', 'appstore', 'app_version', '1.3', 'days', jsonb_build_array(
    jsonb_build_object('day', current_date::text, 'counts', jsonb_build_object('app_opened|layout=regular', 2))))) ,
  (select count from passport_analytics.daily_counts where day=current_date and event='app_opened');
update test_results set total = (select count from passport_analytics.daily_counts where day=current_date and event='app_opened') where case_name='retry';
insert into test_results
select 'higher', public.passport_ingest_running_day(jsonb_build_object(
  'schema', 2, 'install_day_key', '3f0c1d9e-6a2b-4c8e-9d7f-1a2b3c4d5e6f',
  'build_channel', 'appstore', 'app_version', '1.3', 'days', jsonb_build_array(
    jsonb_build_object('day', current_date::text, 'counts', jsonb_build_object('app_opened|layout=regular', 5))))) ,
  (select count from passport_analytics.daily_counts where day=current_date and event='app_opened');
update test_results set total = (select count from passport_analytics.daily_counts where day=current_date and event='app_opened') where case_name='higher';
insert into test_results
select 'older', public.passport_ingest_running_day(jsonb_build_object(
  'schema', 2, 'install_day_key', '3f0c1d9e-6a2b-4c8e-9d7f-1a2b3c4d5e6f',
  'build_channel', 'appstore', 'app_version', '1.3', 'days', jsonb_build_array(
    jsonb_build_object('day', current_date::text, 'counts', jsonb_build_object('app_opened|layout=regular', 3))))) ,
  (select count from passport_analytics.daily_counts where day=current_date and event='app_opened');
update test_results set total = (select count from passport_analytics.daily_counts where day=current_date and event='app_opened') where case_name='older';
insert into test_results
select 'second_install', public.passport_ingest_running_day(jsonb_build_object(
  'schema', 2, 'install_day_key', 'baceed0e-0f3f-426f-9bfa-3e781a4a74fd',
  'build_channel', 'appstore', 'app_version', '1.3', 'days', jsonb_build_array(
    jsonb_build_object('day', current_date::text, 'counts', jsonb_build_object('app_opened|layout=regular', 4))))) ,
  (select count from passport_analytics.daily_counts where day=current_date and event='app_opened');
update test_results set total = (select count from passport_analytics.daily_counts where day=current_date and event='app_opened') where case_name='second_install';

do $$ begin
  if (select array_agg(total order by array_position(array['first','retry','higher','older','second_install'],case_name)) from test_results)
     <> array[7,7,10,10,14]::bigint[] then raise exception 'aggregate totals failed'; end if;
  if (select array_agg((response->>'replaced')::int order by array_position(array['first','retry','higher','older','second_install'],case_name)) from test_results)
     <> array[0,0,1,0,0]::int[] then raise exception 'replacement counts failed'; end if;
  if has_function_privilege('anon', 'public.passport_ingest_running_day(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.passport_ingest_running_day(jsonb)', 'EXECUTE') then
    raise exception 'client role can execute RPC';
  end if;
end $$;
set role service_role;
select public.passport_ingest_running_day(jsonb_build_object(
  'schema', 2, 'install_day_key', '3f0c1d9e-6a2b-4c8e-9d7f-1a2b3c4d5e6f',
  'build_channel', 'appstore', 'app_version', '1.3', 'days', jsonb_build_array(
    jsonb_build_object('day', current_date::text, 'counts', jsonb_build_object('app_opened|layout=regular', 5)))))
  as service_role_retry;
reset role;
do $$ begin
  begin
    perform public.passport_ingest_running_day(jsonb_build_object(
      'schema', 2, 'install_day_key', '3f0c1d9e-6a2b-4c8e-9d7f-1a2b3c4d5e6f',
      'build_channel', 'testflight', 'app_version', '1.3', 'days', jsonb_build_array(
        jsonb_build_object('day', current_date::text, 'counts', jsonb_build_object('app_opened|layout=regular', 8)))));
    raise exception 'scope conflict was accepted';
  exception when sqlstate '22023' then null;
  end;
  if (select count from passport_analytics.daily_counts where day=current_date and build_channel='appstore' and event='app_opened') <> 14 then
    raise exception 'scope conflict changed totals';
  end if;
end $$;
table test_results;
