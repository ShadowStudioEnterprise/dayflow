-- Dayflow foundation. Apply once with Supabase migrations.
-- All-day ranges use civil dates with an exclusive end_date.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  title text not null check (length(btrim(title)) between 1 and 300),
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  plain_text_content text not null default '',
  color text not null default 'default',
  is_pinned boolean not null default false,
  is_archived boolean not null default false
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  title text not null check (length(btrim(title)) between 1 and 300),
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  priority text not null default 'none' check (priority in ('none','low','medium','high','urgent')),
  start_at timestamptz,
  due_at timestamptz,
  due_date date,
  recurrence_rule text,
  completed_at timestamptz,
  check (num_nonnulls(due_at, due_date) <= 1)
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  title text not null check (length(btrim(title)) between 1 and 300),
  task_id uuid not null,
  position integer not null default 0 check (position >= 0),
  is_completed boolean not null default false,
  foreign key (user_id, task_id) references public.tasks(user_id, id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  title text not null check (length(btrim(title)) between 1 and 300),
  description text,
  start_at timestamptz,
  end_at timestamptz,
  start_date date,
  end_date date,
  timezone text not null,
  all_day boolean not null default false,
  location text,
  recurrence_rule text,
  check (
    (all_day and start_date is not null and end_date is not null and end_date > start_date and start_at is null and end_at is null)
    or (not all_day and start_at is not null and end_at is not null and end_at > start_at and start_date is null and end_date is null)
  )
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  title text not null check (length(btrim(title)) between 1 and 300),
  description text,
  task_id uuid,
  event_id uuid,
  note_id uuid,
  trigger_at timestamptz not null,
  recurrence_rule text,
  notification_enabled boolean not null default true,
  check (num_nonnulls(task_id, event_id, note_id) <= 1),
  foreign key (user_id, task_id) references public.tasks(user_id, id),
  foreign key (user_id, event_id) references public.events(user_id, id),
  foreign key (user_id, note_id) references public.notes(user_id, id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  name text not null check (length(btrim(name)) between 1 and 300),
  color text not null default 'default'
);

create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  title text not null check (length(btrim(title)) between 1 and 300)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  name text not null,
  platform text not null check (platform in ('web','android','ios','desktop')),
  push_token text,
  last_seen_at timestamptz not null default now()
);

create table public.entity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  source_type text not null check (source_type in ('note','task','event')),
  source_id uuid not null,
  target_type text not null check (target_type in ('note','task','event')),
  target_id uuid not null,
  check (source_type <> target_type or source_id <> target_id)
);

create table public.note_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  entity_id uuid not null,
  tag_id uuid not null,
  foreign key (user_id, entity_id) references public.notes(user_id, id),
  foreign key (user_id, tag_id) references public.tags(user_id, id)
);
create unique index note_tags_active on public.note_tags(user_id, entity_id, tag_id) where deleted_at is null;

create table public.task_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  entity_id uuid not null,
  tag_id uuid not null,
  foreign key (user_id, entity_id) references public.tasks(user_id, id),
  foreign key (user_id, tag_id) references public.tags(user_id, id)
);
create unique index task_tags_active on public.task_tags(user_id, entity_id, tag_id) where deleted_at is null;

create table public.event_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  entity_id uuid not null,
  tag_id uuid not null,
  foreign key (user_id, entity_id) references public.events(user_id, id),
  foreign key (user_id, tag_id) references public.tags(user_id, id)
);
create unique index event_tags_active on public.event_tags(user_id, entity_id, tag_id) where deleted_at is null;

create table public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (user_id, id),
  entity text not null check (entity in ('notes','tasks','events','reminders','subtasks','tags','inbox','devices','links','noteTags','taskTags','eventTags')),
  entity_id uuid not null,
  action text not null check (action in ('create','update','delete')),
  payload jsonb,
  retries integer not null default 0 check (retries >= 0)
);

-- Keep client timestamps when supplied; normal edits receive server time.
-- This is auditing, not conflict resolution. Phase 6 adds atomic LWW RPCs.
create function public.audit_entity_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'Entity ownership is immutable';
  end if;
  new.created_at := old.created_at;
  if new.updated_at = old.updated_at then new.updated_at := clock_timestamp(); end if;
  new.updated_at := greatest(new.updated_at, old.updated_at + interval '1 microsecond');
  new.version := greatest(new.version, old.version + 1);
  return new;
end;
$$;

create function public.validate_event_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone';
  end if;
  return new;
end;
$$;
create trigger validate_event_timezone before insert or update on public.events
for each row execute function public.validate_event_timezone();

-- Polymorphic relations still enforce ownership and target existence in SQL.
create function public.validate_entity_link() returns trigger
language plpgsql set search_path = '' as $$
declare
  source_exists boolean;
  target_exists boolean;
begin
  execute format('select exists(select 1 from public.%I where id = $1 and user_id = $2)', new.source_type || 's')
    into source_exists using new.source_id, new.user_id;
  execute format('select exists(select 1 from public.%I where id = $1 and user_id = $2)', new.target_type || 's')
    into target_exists using new.target_id, new.user_id;
  if not source_exists or not target_exists then raise exception 'Invalid entity link'; end if;
  return new;
end;
$$;
create trigger validate_entity_link before insert or update on public.entity_links
for each row execute function public.validate_entity_link();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 100));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
create trigger audit_update before update on public.profiles for each row execute function public.audit_entity_update();
create index profiles_owner_updated on public.profiles(user_id, updated_at);

alter table public.notes enable row level security;
create policy notes_select_own on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy notes_insert_own on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notes_update_own on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.notes from anon, authenticated;
grant select, insert, update on public.notes to authenticated;
create trigger audit_update before update on public.notes for each row execute function public.audit_entity_update();
create index notes_owner_updated on public.notes(user_id, updated_at);

alter table public.tasks enable row level security;
create policy tasks_select_own on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update_own on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.tasks from anon, authenticated;
grant select, insert, update on public.tasks to authenticated;
create trigger audit_update before update on public.tasks for each row execute function public.audit_entity_update();
create index tasks_owner_updated on public.tasks(user_id, updated_at);

alter table public.subtasks enable row level security;
create policy subtasks_select_own on public.subtasks for select to authenticated using ((select auth.uid()) = user_id);
create policy subtasks_insert_own on public.subtasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy subtasks_update_own on public.subtasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.subtasks from anon, authenticated;
grant select, insert, update on public.subtasks to authenticated;
create trigger audit_update before update on public.subtasks for each row execute function public.audit_entity_update();
create index subtasks_owner_updated on public.subtasks(user_id, updated_at);

alter table public.events enable row level security;
create policy events_select_own on public.events for select to authenticated using ((select auth.uid()) = user_id);
create policy events_insert_own on public.events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy events_update_own on public.events for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.events from anon, authenticated;
grant select, insert, update on public.events to authenticated;
create trigger audit_update before update on public.events for each row execute function public.audit_entity_update();
create index events_owner_updated on public.events(user_id, updated_at);

alter table public.reminders enable row level security;
create policy reminders_select_own on public.reminders for select to authenticated using ((select auth.uid()) = user_id);
create policy reminders_insert_own on public.reminders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy reminders_update_own on public.reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.reminders from anon, authenticated;
grant select, insert, update on public.reminders to authenticated;
create trigger audit_update before update on public.reminders for each row execute function public.audit_entity_update();
create index reminders_owner_updated on public.reminders(user_id, updated_at);

alter table public.tags enable row level security;
create policy tags_select_own on public.tags for select to authenticated using ((select auth.uid()) = user_id);
create policy tags_insert_own on public.tags for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tags_update_own on public.tags for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.tags from anon, authenticated;
grant select, insert, update on public.tags to authenticated;
create trigger audit_update before update on public.tags for each row execute function public.audit_entity_update();
create index tags_owner_updated on public.tags(user_id, updated_at);

alter table public.inbox enable row level security;
create policy inbox_select_own on public.inbox for select to authenticated using ((select auth.uid()) = user_id);
create policy inbox_insert_own on public.inbox for insert to authenticated with check ((select auth.uid()) = user_id);
create policy inbox_update_own on public.inbox for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.inbox from anon, authenticated;
grant select, insert, update on public.inbox to authenticated;
create trigger audit_update before update on public.inbox for each row execute function public.audit_entity_update();
create index inbox_owner_updated on public.inbox(user_id, updated_at);

alter table public.devices enable row level security;
create policy devices_select_own on public.devices for select to authenticated using ((select auth.uid()) = user_id);
create policy devices_insert_own on public.devices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy devices_update_own on public.devices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.devices from anon, authenticated;
grant select, insert, update on public.devices to authenticated;
create trigger audit_update before update on public.devices for each row execute function public.audit_entity_update();
create index devices_owner_updated on public.devices(user_id, updated_at);

alter table public.entity_links enable row level security;
create policy entity_links_select_own on public.entity_links for select to authenticated using ((select auth.uid()) = user_id);
create policy entity_links_insert_own on public.entity_links for insert to authenticated with check ((select auth.uid()) = user_id);
create policy entity_links_update_own on public.entity_links for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.entity_links from anon, authenticated;
grant select, insert, update on public.entity_links to authenticated;
create trigger audit_update before update on public.entity_links for each row execute function public.audit_entity_update();
create index entity_links_owner_updated on public.entity_links(user_id, updated_at);

alter table public.note_tags enable row level security;
create policy note_tags_select_own on public.note_tags for select to authenticated using ((select auth.uid()) = user_id);
create policy note_tags_insert_own on public.note_tags for insert to authenticated with check ((select auth.uid()) = user_id);
create policy note_tags_update_own on public.note_tags for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.note_tags from anon, authenticated;
grant select, insert, update on public.note_tags to authenticated;
create trigger audit_update before update on public.note_tags for each row execute function public.audit_entity_update();
create index note_tags_owner_updated on public.note_tags(user_id, updated_at);

alter table public.task_tags enable row level security;
create policy task_tags_select_own on public.task_tags for select to authenticated using ((select auth.uid()) = user_id);
create policy task_tags_insert_own on public.task_tags for insert to authenticated with check ((select auth.uid()) = user_id);
create policy task_tags_update_own on public.task_tags for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.task_tags from anon, authenticated;
grant select, insert, update on public.task_tags to authenticated;
create trigger audit_update before update on public.task_tags for each row execute function public.audit_entity_update();
create index task_tags_owner_updated on public.task_tags(user_id, updated_at);

alter table public.event_tags enable row level security;
create policy event_tags_select_own on public.event_tags for select to authenticated using ((select auth.uid()) = user_id);
create policy event_tags_insert_own on public.event_tags for insert to authenticated with check ((select auth.uid()) = user_id);
create policy event_tags_update_own on public.event_tags for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.event_tags from anon, authenticated;
grant select, insert, update on public.event_tags to authenticated;
create trigger audit_update before update on public.event_tags for each row execute function public.audit_entity_update();
create index event_tags_owner_updated on public.event_tags(user_id, updated_at);

alter table public.sync_operations enable row level security;
create policy sync_operations_select_own on public.sync_operations for select to authenticated using ((select auth.uid()) = user_id);
create policy sync_operations_insert_own on public.sync_operations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sync_operations_update_own on public.sync_operations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Hard deletes are reserved for a future privileged purge job.
revoke all on public.sync_operations from anon, authenticated;
grant select, insert, update on public.sync_operations to authenticated;
create trigger audit_update before update on public.sync_operations for each row execute function public.audit_entity_update();
create index sync_operations_owner_updated on public.sync_operations(user_id, updated_at);

create index tasks_owner_due on public.tasks(user_id, due_at) where deleted_at is null;
create index tasks_owner_due_date on public.tasks(user_id, due_date) where deleted_at is null;
create index subtasks_owner_parent on public.subtasks(user_id, task_id, position);
create index events_owner_start on public.events(user_id, start_at) where deleted_at is null;
create index events_owner_start_date on public.events(user_id, start_date) where deleted_at is null;
create index reminders_owner_trigger on public.reminders(user_id, trigger_at) where deleted_at is null;
create index sync_operations_owner_entity on public.sync_operations(user_id, entity, entity_id);
create unique index tags_owner_name on public.tags(user_id, lower(name)) where deleted_at is null;

-- Keep tombstones readable for future sync. UI repositories hide deleted rows.
-- Realtime publication and private Storage bucket are activated in their feature phases.
commit;
