-- SQL role impersonation, NOT a test of JWT signature validation or HTTP routing.
-- Existing subjects are held inside the transaction; no user IDs/content are returned.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '20s';
do $audit$
declare
  probe record;
  subject record;
  relation record;
  subjects uuid[];
  relations text[];
  expected_rows bigint;
  visible_rows bigint;
  foreign_rows bigint;
  result jsonb;
  results jsonb := '[]'::jsonb;
  outcome text;
  subject_index integer := 0;
  existing_subjects integer;
  synthetic_subject uuid;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  for probe in select * from (values
    ('anon_pull', 'anon', 'select public.dayflow_pull()', '42501'),
    ('anon_apply', 'anon', 'select public.dayflow_apply_operation(null)', '42501'),
    ('anon_register_push', 'anon', 'select public.dayflow_register_push(null,null,null)', '42501'),
    ('anon_candidates', 'anon', 'select public.dayflow_push_candidates(''ffffffff-ffff-ffff-ffff-ffffffffffff'')', '42501'),
    ('authenticated_candidates', 'authenticated', 'select public.dayflow_push_candidates(''ffffffff-ffff-ffff-ffff-ffffffffffff'')', '42501'),
    ('authenticated_claim', 'authenticated', 'select public.dayflow_claim_push(null,null,null,null)', '42501'),
    ('authenticated_internal_table', 'authenticated', 'select public.dayflow_table(''tasks'')', '42501'),
    ('authenticated_sync_records', 'authenticated', 'select 1 from public.sync_records limit 0', '42501'),
    ('authenticated_push_deliveries', 'authenticated', 'select 1 from public.push_deliveries limit 0', '42501'),
    ('anon_tasks', 'anon', 'select 1 from public.tasks limit 0', '42501'),
    ('authenticated_pull_without_subject', 'authenticated', 'select public.dayflow_pull()', '42501'),
    ('authenticated_apply_without_subject', 'authenticated', 'select public.dayflow_apply_operation(null)', '42501'),
    ('anon_handle_new_user_direct', 'anon', 'select public.handle_new_user()', '42501'),
    ('authenticated_handle_new_user_direct', 'authenticated', 'select public.handle_new_user()', '42501')
  ) p(label, role_name, sql, expected_state) loop
    perform set_config('role', probe.role_name, true);
    outcome := '00000';
    begin
      execute probe.sql;
    exception when others then outcome := sqlstate;
    end;
    perform set_config('role', 'postgres', true);
    results := results || jsonb_build_array(jsonb_build_object(
      'test', probe.label, 'sqlstate', outcome, 'expected_sqlstate', probe.expected_state,
      'pass', outcome = probe.expected_state));
  end loop;

  select array_agg(user_id) into subjects from (
    select user_id from public.profiles order by user_id limit 2
  ) existing;
  existing_subjects := coalesce(cardinality(subjects), 0);
  -- An absent subject must not see the existing accounts' rows. This is not a second real JWT.
  synthetic_subject := gen_random_uuid();
  while exists(select 1 from auth.users where id=synthetic_subject) loop
    synthetic_subject := gen_random_uuid();
  end loop;
  subjects := array_append(coalesce(subjects, array[]::uuid[]), synthetic_subject);
  select array_agg(c.relname::text order by c.relname) into relations
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and has_table_privilege('authenticated',c.oid,'SELECT');
  for subject in select unnest(subjects) as id loop
    subject_index := subject_index + 1;
    perform set_config('request.jwt.claim.sub', subject.id::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub',subject.id,'role','authenticated')::text, true);
    for relation in select unnest(relations) as name loop
      execute format('select count(*) from public.%I where user_id=$1', relation.name)
        into expected_rows using subject.id;
      perform set_config('role', 'authenticated', true);
      execute format('select count(*), count(*) filter (where user_id is distinct from auth.uid()) from public.%I', relation.name)
        into visible_rows, foreign_rows;
      perform set_config('role', 'postgres', true);
      results := results || jsonb_build_array(jsonb_build_object(
        'test', 'rls_subject_' || subject_index || '_' || relation.name,
        'has_own_rows', expected_rows>0,
        'pass', visible_rows=expected_rows and foreign_rows=0));
    end loop;
    perform set_config('role', 'authenticated', true);
    select public.dayflow_pull('0',100) into result;
    perform set_config('role', 'postgres', true);
    results := results || jsonb_build_array(jsonb_build_object(
      'test', 'pull_subject_' || subject_index,
      'has_changes', jsonb_array_length(result->'changes')>0,
      'pass', not exists(select 1 from jsonb_array_elements(result->'changes') change
        where change->'row'->>'user_id' is distinct from subject.id::text)));
  end loop;
  perform set_config('role', 'service_role', true);
  results := results || jsonb_build_array(jsonb_build_object(
    'test', 'service_role_bypasses_rls',
    'pass', not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and row_security_active(c.oid))));
  perform set_config('role', 'postgres', true);
  perform set_config('dayflow.audit_results',jsonb_build_object(
    'captured_at', now(), 'read_only', current_setting('transaction_read_only'),
    'subjects_tested',subject_index,'existing_subjects',existing_subjects,
    'synthetic_subjects',1,'tests',results)::text,true);
end
$audit$;
select current_setting('dayflow.audit_results')::jsonb as probes;
rollback;
