-- Creates three empty probe objects inside one transaction and ROLLS BACK all DDL.
-- This verifies creation-time privileges on the hosted server, not just ACL text.
begin;
set local statement_timeout = '20s';
do $audit$
declare
  stem text := 'dayflow_audit_' || replace(gen_random_uuid()::text, '-', '');
  table_oid oid;
  sequence_oid oid;
  function_oid oid;
  result jsonb;
begin
  execute format('create table public.%I (id integer)', stem || '_table');
  execute format('create sequence public.%I', stem || '_sequence');
  execute format('create function public.%I() returns integer language sql set search_path = '''' as ''select 1''', stem || '_function');
  table_oid := to_regclass('public.' || stem || '_table');
  sequence_oid := to_regclass('public.' || stem || '_sequence');
  function_oid := to_regprocedure('public.' || stem || '_function()');
  select jsonb_agg(jsonb_build_object(
    'role', rolname,
    'any_table_privilege', has_table_privilege(oid,table_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),
    'any_sequence_privilege', has_sequence_privilege(oid,sequence_oid,'SELECT,UPDATE,USAGE'),
    'function_execute', has_function_privilege(oid,function_oid,'EXECUTE'),
    'pass', has_table_privilege(oid,table_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')=(rolname='service_role')
      and has_sequence_privilege(oid,sequence_oid,'SELECT,UPDATE,USAGE')=(rolname='service_role')
      and has_function_privilege(oid,function_oid,'EXECUTE')=(rolname='service_role')
  ) order by rolname) into result from pg_roles where rolname in ('anon','authenticated','service_role');
  perform set_config('dayflow.audit_defaults',jsonb_build_object('captured_at',now(),'tests',result,'ddl_rolled_back',true)::text,true);
end
$audit$;
select current_setting('dayflow.audit_defaults')::jsonb as defaults;
rollback;
