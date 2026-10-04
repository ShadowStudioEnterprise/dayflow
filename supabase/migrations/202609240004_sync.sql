-- Additive sync protocol: existing rows are retained and bootstrapped into the journal.
begin;
create table public.sync_heads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seq bigint not null default 0
);
create table public.sync_changes (
  user_id uuid not null references auth.users(id) on delete cascade,
  seq bigint not null,
  entity text not null,
  row_data jsonb not null,
  stamp jsonb not null,
  primary key(user_id, seq)
);
create table public.sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  seq bigint not null,
  stamp jsonb not null,
  primary key(user_id, entity, entity_id)
);
alter table public.sync_operations add column result jsonb;
alter table public.sync_heads enable row level security;
alter table public.sync_changes enable row level security;
alter table public.sync_records enable row level security;
create policy sync_heads_read on public.sync_heads for select to authenticated using ((select auth.uid()) = user_id);
create policy sync_changes_read on public.sync_changes for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.sync_heads, public.sync_changes, public.sync_records from public, anon, authenticated;
grant select on public.sync_heads, public.sync_changes to authenticated;

create function public.dayflow_table(p_entity text) returns text
language sql immutable set search_path = '' as $$
  select case p_entity when 'tasks' then 'tasks' when 'notes' then 'notes'
    when 'events' then 'events' when 'reminders' then 'reminders' when 'subtasks' then 'subtasks'
    when 'tags' then 'tags' when 'inbox' then 'inbox' when 'devices' then 'devices'
    when 'links' then 'entity_links' when 'noteTags' then 'note_tags'
    when 'taskTags' then 'task_tags' when 'eventTags' then 'event_tags' end
$$;
revoke all on function public.dayflow_table(text) from public, anon, authenticated;

-- All comparison timestamps have millisecond precision, matching JS/IndexedDB.
create function public.dayflow_wins(a jsonb, b jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select b is null or row((a->>'at')::timestamptz, (a->>'version')::integer, (a->>'deleted')::boolean, a->>'tie')
    > row((b->>'at')::timestamptz, (b->>'version')::integer, (b->>'deleted')::boolean, b->>'tie')
$$;
revoke all on function public.dayflow_wins(jsonb, jsonb) from public, anon, authenticated;

create function public.dayflow_append(p_entity text, p_row jsonb, p_stamp jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_seq bigint; v_user uuid := (p_row->>'user_id')::uuid;
begin
  -- Row lock held to transaction end: sequences cannot become visible out of commit order for a user.
  insert into public.sync_heads(user_id, last_seq) values(v_user, 1)
    on conflict(user_id) do update set last_seq = public.sync_heads.last_seq + 1
    returning last_seq into v_seq;
  insert into public.sync_changes values(v_user, v_seq, p_entity, p_row, p_stamp);
  insert into public.sync_records values(v_user, p_entity, (p_row->>'id')::uuid, v_seq, p_stamp)
    on conflict(user_id, entity, entity_id) do update set seq = excluded.seq, stamp = excluded.stamp;
  return v_seq;
end $$;
revoke all on function public.dayflow_append(text, jsonb, jsonb) from public, anon, authenticated;

create function public.dayflow_capture() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_stamp jsonb; v_entity text;
begin
  v_entity := case tg_table_name when 'entity_links' then 'links' when 'note_tags' then 'noteTags'
    when 'task_tags' then 'taskTags' when 'event_tags' then 'eventTags' else tg_table_name end;
  v_stamp := nullif(current_setting('dayflow.sync_stamp', true), '')::jsonb;
  if v_stamp is null then
    v_stamp := jsonb_build_object('at', date_trunc('milliseconds', new.updated_at), 'version', new.version,
      'deleted', new.deleted_at is not null, 'tie', gen_random_uuid()::text);
  end if;
  perform public.dayflow_append(v_entity, to_jsonb(new), v_stamp);
  return new;
end $$;
revoke all on function public.dayflow_capture() from public, anon, authenticated;

create or replace function public.audit_entity_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id then raise exception 'Entity ownership is immutable'; end if;
  new.created_at := old.created_at;
  if nullif(current_setting('dayflow.sync_stamp', true), '') is null then
    if new.updated_at = old.updated_at then new.updated_at := clock_timestamp(); end if;
    new.updated_at := greatest(new.updated_at, old.updated_at + interval '1 microsecond');
  end if;
  new.version := greatest(new.version, old.version + 1);
  return new;
end $$;

do $$
declare v_entity text; v_table text; v_row jsonb;
begin
  foreach v_entity in array array['tasks','notes','events','reminders','subtasks','tags','inbox','devices','links','noteTags','taskTags','eventTags'] loop
    v_table := public.dayflow_table(v_entity);
    for v_row in execute format('select to_jsonb(t) from public.%I t order by user_id, id', v_table) loop
      perform public.dayflow_append(v_entity, v_row, jsonb_build_object('at', date_trunc('milliseconds', (v_row->>'updated_at')::timestamptz),
        'version', (v_row->>'version')::integer, 'deleted', v_row->>'deleted_at' is not null, 'tie', '00000000-0000-0000-0000-000000000000'));
    end loop;
    execute format('create trigger sync_capture after insert or update on public.%I for each row execute function public.dayflow_capture()', v_table);
    -- Atomic RPC is now the only client mutation path. RLS still governs reads.
    execute format('revoke insert, update on public.%I from authenticated, anon', v_table);
  end loop;
end $$;
revoke insert, update on public.sync_operations from authenticated, anon;

create function public.dayflow_apply_operation(p_operation jsonb) returns jsonb
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
  v_at := date_trunc('milliseconds', (v_row->>'updated_at')::timestamptz);
  if v_at is null or (v_row->>'created_at')::timestamptz is null or (v_row->>'version')::integer is null
    or (v_row->>'version')::integer < 1 or (v_row->>'created_at')::timestamptz > v_at then
    raise exception 'Invalid audit data' using errcode = '22023'; end if;
  if v_at > clock_timestamp() + interval '5 minutes' then raise exception 'DAYFLOW_CLOCK_SKEW' using errcode = '22023'; end if;
  if (v_action = 'delete') <> (v_row->>'deleted_at' is not null) then raise exception 'Invalid tombstone' using errcode = '22023'; end if;
  v_stamp := jsonb_build_object('at', v_at, 'version', (v_row->>'version')::integer,
    'deleted', v_row->>'deleted_at' is not null, 'tie', v_id::text);
  execute format('select to_jsonb(t) from public.%I t where id = $1 and user_id = $2', v_table) into v_current using v_entity_id, v_user;
  select stamp into v_old_stamp from public.sync_records where user_id = v_user and entity = v_entity and entity_id = v_entity_id;
  v_accepted := public.dayflow_wins(v_stamp, v_old_stamp);
  if v_accepted then
    -- Normalized audit data; creation is immutable on an update.
    v_row := v_row || jsonb_build_object('updated_at', v_at, 'created_at', coalesce(v_current->'created_at', v_row->'created_at'));
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

create function public.dayflow_pull(p_after text default '0', p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_changes jsonb; v_after bigint; v_cursor bigint;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_after := p_after::bigint;
  if v_after is null or v_after < 0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid cursor or page size' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('seq', seq::text, 'entity', entity, 'row', row_data, 'stamp', stamp) order by seq), '[]'::jsonb), max(seq)
    into v_changes, v_cursor from (select * from public.sync_changes where user_id = v_user and seq > v_after order by seq limit p_limit) page;
  return jsonb_build_object('changes', v_changes, 'cursor', coalesce(v_cursor, v_after)::text, 'serverTime', clock_timestamp());
end $$;
revoke all on function public.dayflow_pull(text, integer) from public, anon;
grant execute on function public.dayflow_pull(text, integer) to authenticated;

-- Realtime is a wake-up signal. The durable journal remains the source of truth.
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sync_heads;
  end if;
end $$;
commit;
