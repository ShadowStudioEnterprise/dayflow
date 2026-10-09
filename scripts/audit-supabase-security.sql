-- Read-only catalog snapshot. Never selects application rows or secret values.
begin transaction isolation level repeatable read read only;
with
target_roles as (
  select oid, rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
         rolcanlogin, rolreplication, rolbypassrls
  from pg_roles where rolname in ('anon', 'authenticated', 'service_role')
),
app_relations as (
  select c.*, n.nspname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'graphql_public') and c.relkind in ('r', 'p', 'v', 'm', 'f')
),
app_functions as (
  select p.*, n.nspname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'graphql_public')
)
select jsonb_build_object(
  'captured_at', now(),
  'database', current_database(),
  'query_role', current_user,
  'server_version', current_setting('server_version'),
  'transaction_read_only', current_setting('transaction_read_only'),
  'roles', (select jsonb_agg(to_jsonb(r) - 'oid' order by rolname) from target_roles r),
  'memberships', (select coalesce(jsonb_agg(jsonb_build_object(
    'member', member_role.rolname, 'granted_role', parent.rolname,
    'inherit_option', m.inherit_option, 'set_option', m.set_option, 'admin_option', m.admin_option
  ) order by member_role.rolname, parent.rolname), '[]'::jsonb)
    from pg_auth_members m join pg_roles member_role on member_role.oid = m.member
    join pg_roles parent on parent.oid = m.roleid),
  'schemas', (select jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'role', r.rolname,
    'usage', has_schema_privilege(r.oid, n.oid, 'USAGE'),
    'create', has_schema_privilege(r.oid, n.oid, 'CREATE')
  ) order by n.nspname, r.rolname) from pg_namespace n cross join target_roles r
    where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'),
  'relations', (select jsonb_agg(jsonb_build_object(
    'schema', c.nspname, 'name', c.relname, 'kind', c.relkind,
    'owner', pg_get_userbyid(c.relowner), 'rls', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity, 'options', c.reloptions, 'acl', c.relacl::text,
    'privileges', (select jsonb_object_agg(r.rolname, jsonb_build_object(
      'select', has_table_privilege(r.oid,c.oid,'SELECT'),
      'insert', has_table_privilege(r.oid,c.oid,'INSERT'),
      'update', has_table_privilege(r.oid,c.oid,'UPDATE'),
      'delete', has_table_privilege(r.oid,c.oid,'DELETE'),
      'truncate', has_table_privilege(r.oid,c.oid,'TRUNCATE'),
      'references', has_table_privilege(r.oid,c.oid,'REFERENCES'),
      'trigger', has_table_privilege(r.oid,c.oid,'TRIGGER'),
      'maintain', has_table_privilege(r.oid,c.oid,'MAINTAIN'),
      'any_column_select', has_any_column_privilege(r.oid,c.oid,'SELECT'),
      'any_column_insert', has_any_column_privilege(r.oid,c.oid,'INSERT'),
      'any_column_update', has_any_column_privilege(r.oid,c.oid,'UPDATE')
    )) from target_roles r)
  ) order by c.nspname, c.relname) from app_relations c),
  'column_acl', (select coalesce(jsonb_agg(jsonb_build_object(
    'schema', c.nspname, 'table', c.relname, 'column', a.attname, 'acl', a.attacl::text
  ) order by c.nspname,c.relname,a.attnum), '[]'::jsonb)
    from app_relations c join pg_attribute a on a.attrelid=c.oid
    where a.attnum>0 and not a.attisdropped and a.attacl is not null),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname)
    from pg_policies p where schemaname in ('public','graphql_public')),
  'functions', (select jsonb_agg(jsonb_build_object(
    'schema', p.nspname, 'name', p.proname,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'arguments', pg_get_function_arguments(p.oid),
    'result', pg_get_function_result(p.oid), 'kind', p.prokind,
    'owner', pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
    'owner_bypassrls', (select rolbypassrls from pg_roles where oid=p.proowner),
    'owner_superuser', (select rolsuper from pg_roles where oid=p.proowner),
    'config', p.proconfig, 'acl', p.proacl::text,
    'definition_md5', md5(pg_get_functiondef(p.oid)),
    'source_md5', md5(replace(p.prosrc, chr(13), '')),
    'extension', (select e.extname from pg_depend d join pg_extension e on e.oid=d.refobjid
      where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'),
    'public_execute', exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee=0 and a.privilege_type='EXECUTE'),
    'execute', (select jsonb_object_agg(r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE')) from target_roles r)
  ) order by p.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from app_functions p),
  'default_acl', (select jsonb_agg(jsonb_build_object(
    'owner', pg_get_userbyid(d.defaclrole), 'schema', coalesce(n.nspname,'*'),
    'object_type', d.defaclobjtype, 'acl', d.defaclacl::text
  ) order by pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype)
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),
  'api_role_settings', (select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.rolname, 'setting', cfg
  )), '[]'::jsonb) from pg_db_role_setting s join pg_roles r on r.oid=s.setrole
    cross join lateral unnest(s.setconfig) cfg
    where cfg like 'pgrst.db_schemas=%' or cfg like 'pgrst.db_extra_search_path=%'),
  'migrations', (select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version)
    from supabase_migrations.schema_migrations)
) as audit;
rollback;
