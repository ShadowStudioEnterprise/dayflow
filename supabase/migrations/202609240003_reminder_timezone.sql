-- Recurrence keeps the reminder's local wall-clock time across DST changes.
alter table public.reminders add column timezone text not null default 'UTC';
create trigger validate_reminder_timezone before insert or update on public.reminders
for each row execute function public.validate_event_timezone();
-- OS identifiers, scheduling status and permissions remain device-local.
