-- Isolated local fixture assertions; run after LOCAL_REPLACE_PARTITION_TEST.sql and reviewed RPC SQL.
do $test$
declare
  passport uuid := '926ad3c6-c68d-4b70-9dd0-c0073916d771';
  pois uuid := 'c6a04fc2-75ae-4c65-92fe-b696c9938413';
  d date := current_date - 1;
  initial jsonb;
  revised jsonb;
  n integer;
begin
  insert into public.aso_storefront_metrics(app_id,date,country,event,page_type,source_type,count,import_key,source)
  values(pois,d,'us','Impression','No page','App Store search',9,'pois-preserve','appstore_connect_discovery');
  initial := jsonb_build_object('app_id',passport,'date',d,'source','appstore_connect_discovery',
    'processing_date',current_date,'payload_hash',repeat('a',64),
    'storefront_rows',jsonb_build_array(
      jsonb_build_object('app_id',passport,'date',d,'country','us','event','Impression','page_type','No page','source_type','App Store browse','count',10,'unique_count',null,'import_key','passport-old','source','appstore_connect_discovery','parser_version','test','raw_payload','{}'::jsonb),
      jsonb_build_object('app_id',passport,'date',d,'country','de','event','Impression','page_type','No page','source_type','App Store search','count',2,'unique_count',null,'import_key','passport-keep','source','appstore_connect_discovery','parser_version','test','raw_payload','{}'::jsonb)),
    'daily_rows',jsonb_build_array(jsonb_build_object('app_id',passport,'date',d,'country','us','impressions',10,'page_views',0,'downloads',null,'proceeds',null,'proceeds_currency',null,'import_key','passport-daily','source','appstore_connect_discovery','parser_version','test','raw_payload','{}'::jsonb)));
  perform public.aso_replace_analytics_partition(initial);
  select count(*) into n from public.aso_storefront_metrics where app_id=passport and date=d;
  if n <> 2 then raise exception 'initial partition failed'; end if;
  revised := jsonb_set(initial,'{processing_date}',to_jsonb((current_date+1)::text));
  revised := jsonb_set(revised,'{payload_hash}',to_jsonb(repeat('b',64)));
  revised := jsonb_set(revised,'{storefront_rows}',jsonb_build_array(
    jsonb_build_object('app_id',passport,'date',d,'country','de','event','Impression','page_type','No page','source_type','App Store search','count',7,'unique_count',null,'import_key','passport-keep','source','appstore_connect_discovery','parser_version','test','raw_payload','{}'::jsonb)));
  perform public.aso_replace_analytics_partition(revised);
  select count(*) into n from public.aso_storefront_metrics where import_key='passport-old';
  if n <> 0 then raise exception 'disappeared row survived revision'; end if;
  select count(*) into n from public.aso_storefront_metrics where import_key='passport-keep' and count=7;
  if n <> 1 then raise exception 'revised value absent'; end if;
  perform public.aso_replace_analytics_partition(revised);
  select count(*) into n from public.aso_storefront_metrics where import_key='pois-preserve';
  if n <> 1 then raise exception 'other app was changed'; end if;
  begin
    perform public.aso_replace_analytics_partition(initial);
    raise exception 'stale revision was accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.aso_replace_analytics_partition(jsonb_set(revised,'{storefront_rows,0,app_id}',to_jsonb(pois::text)));
    raise exception 'cross-app row was accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.aso_replace_analytics_partition(jsonb_set(revised,'{app_id}',to_jsonb(pois::text)));
    raise exception 'non-PASSPORT partition was accepted';
  exception when sqlstate '22023' then null; end;
  if has_function_privilege('anon','public.aso_replace_analytics_partition(jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.aso_replace_analytics_partition(jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.aso_replace_analytics_partition(jsonb)','EXECUTE') then
    raise exception 'RPC execution grants are not service-role only';
  end if;
  if has_table_privilege('anon','public.aso_analytics_partition_state','SELECT')
     or has_table_privilege('authenticated','public.aso_analytics_partition_state','SELECT')
     or not has_table_privilege('service_role','public.aso_analytics_partition_state','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'partition-state grants are not service-role only';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.aso_analytics_partition_state'::regclass) then
    raise exception 'partition-state RLS is off';
  end if;
  select count(*) into n from public.aso_storefront_metrics where app_id=passport and date=d;
  if n <> 1 then raise exception 'invalid transaction changed partition'; end if;
end;
$test$;
