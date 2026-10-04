begin;
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}={0,1}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}={0,2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
create table public.push_deliveries (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  occurrence_at timestamptz not null,
  lease uuid not null default gen_random_uuid(),
  attempted_at timestamptz not null default now(),
  attempts integer not null default 1,
  accepted_at timestamptz,
  primary key (subscription_id, reminder_id, occurrence_at)
);
alter table public.push_subscriptions enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_subscriptions, public.push_deliveries from public, anon, authenticated;
grant all on public.push_subscriptions, public.push_deliveries to service_role;
grant select, delete on public.push_subscriptions to authenticated;
create policy push_read on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy push_delete on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

-- Fixed provider allowlist prevents using the sender as an arbitrary HTTP proxy.
create function public.dayflow_push_endpoint(p_endpoint text) returns boolean
language sql immutable set search_path = '' as $$
  select length(p_endpoint) <= 2048 and p_endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|updates\.push\.services\.mozilla\.org|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]#]+$'
$$;
create function public.dayflow_register_push(p_endpoint text, p_p256dh text, p_auth text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or not public.dayflow_push_endpoint(p_endpoint) then
    raise exception 'Invalid push subscription';
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
  if v_id is null then raise exception 'Subscription belongs to another account'; end if;
  return v_id;
end $$;

-- Keyset pagination; only accounts with active browser subscriptions are scanned.
create function public.dayflow_push_candidates(p_after uuid default '00000000-0000-0000-0000-000000000000') returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(batch) order by batch.id), '[]'::jsonb) from (
    select r.*, s.subscriptions from public.reminders r
    cross join lateral (
      select jsonb_agg(to_jsonb(s)) as subscriptions from public.push_subscriptions s where s.user_id = r.user_id
    ) s
    where r.id > p_after and r.deleted_at is null and r.notification_enabled
      and r.trigger_at <= now() and (r.recurrence_rule is not null or r.trigger_at >= now() - interval '5 minutes')
      and s.subscriptions is not null
    order by r.id limit 100
  ) batch
$$;
create function public.dayflow_claim_push(p_subscription uuid, p_reminder uuid, p_version integer, p_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_lease uuid;
begin
  if p_at > now() or p_at < now() - interval '5 minutes' or not exists (
    select 1 from public.reminders r join public.push_subscriptions s on s.user_id = r.user_id
    where r.id = p_reminder and s.id = p_subscription and r.version = p_version
      and r.deleted_at is null and r.notification_enabled and p_at >= s.created_at
      and p_at >= r.updated_at
  ) then return null; end if;
  insert into public.push_deliveries(subscription_id, reminder_id, occurrence_at)
    values(p_subscription, p_reminder, p_at)
    on conflict(subscription_id, reminder_id, occurrence_at) do update
      set lease = gen_random_uuid(), attempted_at = now(), attempts = public.push_deliveries.attempts + 1
      where public.push_deliveries.accepted_at is null and public.push_deliveries.attempts < 3
        and public.push_deliveries.attempted_at < now() - interval '90 seconds'
    returning lease into v_lease;
  return v_lease;
end $$;
revoke all on function public.dayflow_push_endpoint(text), public.dayflow_register_push(text,text,text), public.dayflow_push_candidates(uuid), public.dayflow_claim_push(uuid,uuid,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.dayflow_register_push(text,text,text) to authenticated;
grant execute on function public.dayflow_push_candidates(uuid), public.dayflow_claim_push(uuid,uuid,integer,timestamptz) to service_role;
commit;
