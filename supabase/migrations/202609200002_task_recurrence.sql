-- Additive migration: preserve existing tasks and audit/ownership policies.
begin;
alter table public.tasks
  add column timezone text,
  add column recurrence_anchor text,
  add column next_occurrence_id uuid,
  add constraint tasks_next_occurrence_owner foreign key (user_id, next_occurrence_id) references public.tasks(user_id, id),
  add constraint tasks_not_own_successor check (next_occurrence_id is null or next_occurrence_id <> id);

create function public.validate_task_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.timezone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid task timezone';
  end if;
  return new;
end;
$$;
create trigger validate_task_timezone before insert or update on public.tasks
for each row execute function public.validate_task_timezone();
create index tasks_owner_status on public.tasks(user_id, status) where deleted_at is null;
commit;
