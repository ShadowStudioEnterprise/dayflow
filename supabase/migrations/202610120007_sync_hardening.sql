-- Server revisions are independent of author conflict stamps. No journal rewrite.
begin;
create or replace function public.audit_entity_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id then raise exception 'Entity ownership is immutable'; end if;
  new.created_at := old.created_at;
  if nullif(current_setting('dayflow.sync_stamp', true), '') is null then
    if new.updated_at = old.updated_at then new.updated_at := clock_timestamp(); end if;
    new.updated_at := greatest(new.updated_at, old.updated_at + interval '1 microsecond');
  end if;
  new.version := old.version + 1;
  return new;
end $$;

create or replace function public.dayflow_apply_operation(p_operation jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_id uuid; v_entity text; v_entity_id uuid; v_action text; v_table text;
  v_row jsonb; v_current jsonb; v_stamp jsonb; v_old_stamp jsonb; v_receipt public.sync_operations;
  v_columns text; v_names text[]; v_result jsonb; v_change jsonb; v_accepted boolean; v_at timestamptz;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_operation is null or jsonb_typeof(p_operation) <> 'object' or octet_length(p_operation::text) > 2097152 then
    raise exception 'Invalid operation size' using errcode = '22023'; end if;
  v_id := (p_operation->>'id')::uuid; v_entity := p_operation->>'entity';
  v_entity_id := (p_operation->>'entityId')::uuid; v_action := p_operation->>'action'; v_row := p_operation->'row';
  v_table := public.dayflow_table(v_entity);
  if v_id is null or v_entity_id is null or v_table is null or v_action is null or v_action not in ('create','update','delete')
    or jsonb_typeof(v_row) is distinct from 'object' then raise exception 'Invalid operation' using errcode = '22023'; end if;
  if (v_row->>'user_id')::uuid is distinct from v_user or (v_row->>'id')::uuid is distinct from v_entity_id then
    raise exception 'Invalid operation owner' using errcode = '42501'; end if;
  -- Same-account writes are serialized, including competing creates and idempotent retries.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 74321));
  select * into v_receipt from public.sync_operations where id = v_id;
  if found then
    if v_receipt.user_id <> v_user or v_receipt.entity <> v_entity or v_receipt.entity_id <> v_entity_id
      or v_receipt.action <> v_action or v_receipt.payload is distinct from v_row then
      raise exception 'Operation ID already used' using errcode = '22023'; end if;
    if v_receipt.result is null then raise exception 'Legacy receipt requires review' using errcode = '22023'; end if;
    return v_receipt.result;
  end if;
  select array_agg(attname::text order by attnum) into v_names from pg_catalog.pg_attribute
    where attrelid = ('public.' || v_table)::regclass and attnum > 0 and not attisdropped;
  if exists(select 1 from jsonb_object_keys(v_row) k where not(k = any(v_names))) then
    raise exception 'Unknown data fields' using errcode = '22023'; end if;
  -- Require stable ISO instants; PostgreSQL also accepts relative literals like 'now'.
  if coalesce(v_row->>'updated_at', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$'
    or coalesce(v_row->>'created_at', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$'
    or (v_row->>'deleted_at' is not null and v_row->>'deleted_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$') then
    raise exception 'Invalid audit data' using errcode = '22023'; end if;
  v_at := date_trunc('milliseconds', (v_row->>'updated_at')::timestamptz);
  if v_at is null or (v_row->>'created_at')::timestamptz is null or (v_row->>'version')::integer is null
    or not isfinite(v_at) or not isfinite((v_row->>'created_at')::timestamptz)
    or (v_row->>'version')::integer < 1 or (v_row->>'created_at')::timestamptz > v_at then
    raise exception 'Invalid audit data' using errcode = '22023'; end if;
  if v_at > clock_timestamp() + interval '5 minutes' then raise exception 'DAYFLOW_CLOCK_SKEW' using errcode = '22023'; end if;
  if v_row->>'deleted_at' is not null and (not isfinite((v_row->>'deleted_at')::timestamptz)
    or (v_row->>'deleted_at')::timestamptz <> v_at) then
    raise exception 'Invalid audit data' using errcode = '22023'; end if;
  if (v_action = 'delete') <> (v_row->>'deleted_at' is not null) then raise exception 'Invalid tombstone' using errcode = '22023'; end if;
  v_stamp := jsonb_build_object('at', v_at, 'version', (v_row->>'version')::integer,
    'deleted', v_row->>'deleted_at' is not null, 'tie', v_id::text);
  execute format('select to_jsonb(t) from public.%I t where id = $1 and user_id = $2', v_table) into v_current using v_entity_id, v_user;
  select stamp into v_old_stamp from public.sync_records where user_id = v_user and entity = v_entity and entity_id = v_entity_id;
  v_accepted := public.dayflow_wins(v_stamp, v_old_stamp);
  if v_accepted then
    -- Normalized audit data; creation is immutable on an update.
    v_row := v_row || jsonb_build_object('version', 1, 'updated_at', v_at, 'created_at', coalesce(v_current->'created_at', v_row->'created_at'));
    select string_agg(format('%I', name), ',') into v_columns from unnest(v_names) name;
    perform set_config('dayflow.sync_stamp', v_stamp::text, true);
    if v_current is null then
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', v_table, v_columns, v_columns, v_table) using v_row;
    else
      execute format('update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where id = $2 and user_id = $3', v_table, v_columns, v_columns, v_table) using v_row, v_entity_id, v_user;
    end if;
    perform set_config('dayflow.sync_stamp', '', true);
  end if;
  select jsonb_build_object('seq', c.seq::text, 'entity', c.entity, 'row', c.row_data, 'stamp', c.stamp) into v_change
    from public.sync_records r join public.sync_changes c on c.user_id = r.user_id and c.seq = r.seq
    where r.user_id = v_user and r.entity = v_entity and r.entity_id = v_entity_id;
  v_result := jsonb_build_object('operationId', v_id, 'accepted', v_accepted, 'change', v_change);
  insert into public.sync_operations(id, user_id, entity, entity_id, action, payload, result)
    values(v_id, v_user, v_entity, v_entity_id, v_action, p_operation->'row', v_result);
  return v_result;
end $$;
revoke all on function public.dayflow_apply_operation(jsonb) from public, anon;
grant execute on function public.dayflow_apply_operation(jsonb) to authenticated;


create or replace function public.dayflow_register_push(p_endpoint text, p_p256dh text, p_auth text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or public.dayflow_push_endpoint(p_endpoint) is distinct from true
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}={0,1}$'
    or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}={0,2}$' then
    raise exception 'Invalid push subscription' using errcode = '22023';
  end if;
  -- Serialize the per-account device limit, including concurrent registrations.
  perform 1 from auth.users where id = v_user for update;
  if not exists(select 1 from public.push_subscriptions where endpoint = p_endpoint and user_id = v_user)
    and (select count(*) from public.push_subscriptions where user_id = v_user) >= 10 then
    raise exception 'Push device limit reached';
  end if;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values(v_user, p_endpoint, p_p256dh, p_auth)
    on conflict(endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, updated_at = now()
      where public.push_subscriptions.user_id = v_user
    returning id into v_id;
  if v_id is null then raise exception 'Invalid push subscription' using errcode = '22023'; end if;
  return v_id;
end $$;


-- RPC-only entities: remove dormant write policies and inherited PUBLIC DML.
do $$
declare v_table text;
begin
  foreach v_table in array array['tasks','notes','events','reminders','subtasks','tags','inbox','devices','entity_links','note_tags','task_tags','event_tags','sync_operations'] loop
    execute format('revoke insert, update, delete on public.%I from public, anon, authenticated', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_insert_own', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_update_own', v_table);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke all on tables from public;
alter default privileges for role postgres in schema public revoke all on sequences from public;
revoke all on function public.audit_entity_update() from public, anon, authenticated;
revoke all on function public.dayflow_register_push(text,text,text) from public, anon;
grant execute on function public.dayflow_register_push(text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
