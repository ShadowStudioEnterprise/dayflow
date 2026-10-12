begin;

-- Operational aggregates contain no account IDs, endpoints, payloads or secrets.
create table public.push_dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','succeeded','partial','failed')),
  scanned integer not null default 0 check (scanned >= 0),
  recurrence_failures integer not null default 0 check (recurrence_failures >= 0),
  window_expired integer not null default 0 check (window_expired >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  error_code text check (error_code in ('dispatch_error','time_budget','metrics_error'))
);
create index push_runs_started on public.push_dispatch_runs(started_at);
create table public.push_attempt_metrics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.push_dispatch_runs(id) on delete cascade,
  attempted_at timestamptz not null,
  occurrence_at timestamptz not null,
  outcome text not null check (outcome in ('accepted','rejected','endpoint_expired','transport_error','generation_error')),
  sent boolean not null,
  http_status integer check (http_status between 100 and 599),
  accepted_at timestamptz,
  dispatch_delay_ms bigint not null check (dispatch_delay_ms >= 0),
  provider_duration_ms bigint not null check (provider_duration_ms >= 0),
  check ((outcome = 'accepted') = (accepted_at is not null)),
  check (outcome <> 'accepted' or (sent and http_status between 200 and 299)),
  check (outcome <> 'generation_error' or not sent)
);
create index push_attempt_time on public.push_attempt_metrics(attempted_at);
create table public.push_cron_ticks (
  id bigint generated always as identity primary key,
  tick_at timestamptz not null default clock_timestamp(),
  request_id bigint unique,
  state text not null check (state in ('idle','queued','succeeded','failed','timeout','missing')),
  http_status integer,
  observed_at timestamptz
);
create index push_ticks_time on public.push_cron_ticks(tick_at);
create table public.push_operational_alerts (
  code text primary key check (code in ('cron_stale','dispatch_stale','cron_http_failure','dispatch_failure','send_failures','send_delay','endpoint_expirations','window_expirations')),
  active boolean not null,
  opened_at timestamptz not null,
  last_seen_at timestamptz not null,
  resolved_at timestamptz,
  observed_value numeric
);
create table public.push_monitor_settings (
  id boolean primary key default true check (id),
  stale_seconds integer not null default 180 check (stale_seconds between 120 and 3600),
  failure_count integer not null default 3 check (failure_count > 0),
  delay_ms integer not null default 90000 check (delay_ms > 0),
  expiration_count integer not null default 3 check (expiration_count > 0)
);
insert into public.push_monitor_settings(id) values (true);

alter table public.push_dispatch_runs enable row level security;
alter table public.push_attempt_metrics enable row level security;
alter table public.push_cron_ticks enable row level security;
alter table public.push_operational_alerts enable row level security;
alter table public.push_monitor_settings enable row level security;
revoke all on public.push_dispatch_runs, public.push_attempt_metrics, public.push_cron_ticks,
  public.push_operational_alerts, public.push_monitor_settings from public, anon, authenticated;
grant all on public.push_dispatch_runs, public.push_attempt_metrics, public.push_cron_ticks,
  public.push_operational_alerts, public.push_monitor_settings to service_role;
revoke all on sequence public.push_cron_ticks_id_seq from public, anon, authenticated;
grant usage, select on sequence public.push_cron_ticks_id_seq to service_role;

create view public.dayflow_push_metrics_hourly with (security_invoker = true) as
with attempts as (
  select date_trunc('hour', attempted_at) as hour,
    count(*) as attempts, count(*) filter (where sent) as sends,
    count(*) filter (where outcome = 'accepted') as provider_accepted,
    count(*) filter (where outcome in ('rejected','transport_error','generation_error')) as send_failures,
    count(*) filter (where outcome = 'endpoint_expired') as expired_endpoints,
    round(avg(dispatch_delay_ms) filter (where sent), 2) as avg_dispatch_delay_ms,
    max(dispatch_delay_ms) filter (where sent) as max_dispatch_delay_ms,
    round(avg(provider_duration_ms) filter (where sent), 2) as avg_provider_duration_ms
  from public.push_attempt_metrics group by 1
), runs as (
  select date_trunc('hour', started_at) as hour, count(*) as runs,
    count(*) filter (where status = 'running') as unfinished_runs,
    count(*) filter (where status = 'failed') as failed_runs,
    count(*) filter (where error_code = 'metrics_error') as metrics_error_runs,
    sum(scanned) as scanned, sum(window_expired) as dispatch_window_expired,
    sum(recurrence_failures) as recurrence_failures
  from public.push_dispatch_runs group by 1
)
select coalesce(a.hour,r.hour) as hour, coalesce(r.runs,0) as runs,
  coalesce(r.unfinished_runs,0) as unfinished_runs, coalesce(r.failed_runs,0) as failed_runs,
  coalesce(r.metrics_error_runs,0) as metrics_error_runs,
  coalesce(r.scanned,0) as scanned, coalesce(a.attempts,0) as attempts,
  coalesce(a.sends,0) as sends, coalesce(a.provider_accepted,0) as provider_accepted,
  coalesce(a.send_failures,0) as send_failures, coalesce(a.expired_endpoints,0) as expired_endpoints,
  coalesce(r.dispatch_window_expired,0) as dispatch_window_expired,
  coalesce(r.recurrence_failures,0) as recurrence_failures,
  a.avg_dispatch_delay_ms, a.max_dispatch_delay_ms, a.avg_provider_duration_ms,
  null::bigint as visualized, null::bigint as provider_message_ttl_expired
from attempts a full join runs r using(hour);
revoke all on public.dayflow_push_metrics_hourly from public, anon, authenticated;
grant select on public.dayflow_push_metrics_hourly to service_role;

create function public.dayflow_push_alert(p_code text, p_active boolean, p_value numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_active then
    insert into public.push_operational_alerts(code,active,opened_at,last_seen_at,observed_value)
    values(p_code,true,clock_timestamp(),clock_timestamp(),p_value)
    on conflict(code) do update set active=true,
      opened_at=case when public.push_operational_alerts.active then public.push_operational_alerts.opened_at else excluded.opened_at end,
      last_seen_at=excluded.last_seen_at, resolved_at=null, observed_value=p_value;
  else
    update public.push_operational_alerts set active=false, resolved_at=clock_timestamp(),
      last_seen_at=clock_timestamp(),observed_value=p_value where code=p_code and active;
  end if;
end $$;

create function public.dayflow_monitor_push() returns void
language plpgsql security definer set search_path = '' as $$
declare cfg public.push_monitor_settings; v numeric; has_subscriptions boolean;
begin
  if not pg_try_advisory_xact_lock(120007) then return; end if;
  select * into cfg from public.push_monitor_settings where id;
  if not found then raise exception 'Push monitor settings missing'; end if;
  -- Read response metadata only: no HTTP body, headers, endpoint or token.
  if to_regclass('net._http_response') is not null then
    execute $query$
      update public.push_cron_ticks t set
        state=case when r.timed_out then 'timeout' when r.error_msg is not null or r.status_code is null or r.status_code >= 400 then 'failed' else 'succeeded' end,
        http_status=r.status_code, observed_at=clock_timestamp()
      from net._http_response r where t.request_id=r.id and t.state in ('queued','missing')
    $query$;
  end if;
  update public.push_cron_ticks set state='missing',observed_at=clock_timestamp()
    where state='queued' and tick_at<clock_timestamp()-interval '2 minutes';
  select extract(epoch from clock_timestamp()-max(tick_at)) into v from public.push_cron_ticks;
  perform public.dayflow_push_alert('cron_stale',coalesce(v,cfg.stale_seconds+1)>cfg.stale_seconds,v);
  select exists(select 1 from public.push_subscriptions) into has_subscriptions;
  select extract(epoch from clock_timestamp()-max(started_at)) into v from public.push_dispatch_runs;
  perform public.dayflow_push_alert('dispatch_stale',has_subscriptions and coalesce(v,cfg.stale_seconds+1)>cfg.stale_seconds,v);
  select count(*) into v from public.push_cron_ticks where tick_at>clock_timestamp()-interval '15 minutes' and state in ('failed','timeout','missing');
  perform public.dayflow_push_alert('cron_http_failure',v>0,v);
  select count(*) into v from public.push_dispatch_runs where started_at>clock_timestamp()-interval '15 minutes' and (status='failed' or recurrence_failures>0 or (status='running' and started_at<clock_timestamp()-interval '2 minutes'));
  perform public.dayflow_push_alert('dispatch_failure',v>0,v);
  select count(*) into v from public.push_attempt_metrics where attempted_at>clock_timestamp()-interval '15 minutes' and outcome in ('rejected','transport_error','generation_error');
  perform public.dayflow_push_alert('send_failures',v>=cfg.failure_count,v);
  select coalesce(max(dispatch_delay_ms),0) into v from public.push_attempt_metrics where attempted_at>clock_timestamp()-interval '15 minutes' and sent;
  perform public.dayflow_push_alert('send_delay',v>cfg.delay_ms,v);
  select count(*) into v from public.push_attempt_metrics where attempted_at>clock_timestamp()-interval '15 minutes' and outcome='endpoint_expired';
  perform public.dayflow_push_alert('endpoint_expirations',v>=cfg.expiration_count,v);
  select coalesce(sum(window_expired),0) into v from public.push_dispatch_runs where started_at>clock_timestamp()-interval '15 minutes';
  perform public.dayflow_push_alert('window_expirations',v>=cfg.expiration_count,v);
  delete from public.push_dispatch_runs where started_at<clock_timestamp()-interval '14 days';
  delete from public.push_cron_ticks where tick_at<clock_timestamp()-interval '14 days';
end $$;
revoke all on function public.dayflow_push_alert(text,boolean,numeric), public.dayflow_monitor_push() from public,anon,authenticated;
grant execute on function public.dayflow_monitor_push() to service_role;
notify pgrst, 'reload schema';
commit;
