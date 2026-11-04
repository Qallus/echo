-- Super Admin batch D: Dashboard, Analytics, Reports, Automation, Settings.
-- * admin_dashboard gains pipeline, inbox, task and booking numbers.
-- * admin_series: one metric bucketed by day/week/month/year (Analytics).
-- * admin_report: tables for Reports; saved_reports keeps named reports.
-- * automation_rules: trigger -> conditions -> actions. Database triggers
--   queue runs for CRM, booking and inbox events wherever they come from;
--   /api/cron/comms queues the time-based ones and runs everything due.
-- * platform_settings "organization": name, contact details, time zone.

-- ---------------------------------------------------------------------------
-- Organization settings (the time zone sets what "today" means below)
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value) values ('organization', '{
  "name": "Qallus LLC", "legalName": "", "email": "", "phone": "", "address": "Arizona", "website": "", "timezone": "America/Phoenix"
}') on conflict (key) do nothing;
create policy "settings_insert_organization" on public.platform_settings for insert to authenticated
  with check (key = 'organization' and private.staff_can('settings.manage'));
create policy "settings_update_organization" on public.platform_settings for update to authenticated
  using (key = 'organization' and private.staff_can('settings.manage'))
  with check (key = 'organization' and private.staff_can('settings.manage'));

create function private.org_timezone() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(value ->> 'timezone', '') from public.platform_settings where key = 'organization'), 'America/Phoenix');
$$;
revoke execute on function private.org_timezone() from public, anon;
grant execute on function private.org_timezone() to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now());
  tz text := private.org_timezone();
  today date := (now() at time zone tz)::date;
  open_stages text[] := array['new_working', 'contacted', 'qualified', 'opportunity', 'proposal', 'negotiation'];
begin
  if not private.staff_can('dashboard.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_users_30d', (select count(distinct created_by) from public.recordings where created_at > now() - interval '30 days'),
    'business_workspaces', (select count(*) from public.workspaces where not is_personal),
    'recordings', (select count(*) from public.recordings where deleted_at is null),
    'recordings_month', (select count(*) from public.recordings where created_at >= month_start),
    'minutes_month', (select coalesce(round(sum(duration_sec) / 60.0), 0) from public.recordings where created_at >= month_start),
    'failed_transcriptions_7d', (select count(*) from public.recordings where status = 'failed' and updated_at > now() - interval '7 days'),
    'failed_deliveries_24h', (select count(*) from public.notification_deliveries where status = 'failed' and created_at > now() - interval '24 hours'),
    'subscriptions', case when private.staff_can('billing.view') then (
      select coalesce(jsonb_agg(jsonb_build_object('status', s.status, 'items', s.items)), '[]'::jsonb)
      from public.subscriptions s where s.status in ('active', 'trialing', 'past_due')
    ) end,
    'orders_month', case when private.staff_can('billing.view') then (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(total), 0))
      from public.orders where status = 'paid' and created_at >= month_start
    ) end,
    'pipeline', case when private.staff_can('crm.view') then (
      select jsonb_build_object(
        'open', count(*) filter (where stage = any(open_stages)),
        'open_value', coalesce(sum(value_cents) filter (where stage = any(open_stages)), 0),
        'weighted', coalesce(round(sum(value_cents * probability / 100.0) filter (where stage = any(open_stages))), 0),
        'won_month', count(*) filter (where stage = 'closed_won' and closed_at >= month_start),
        'won_month_value', coalesce(sum(value_cents) filter (where stage = 'closed_won' and closed_at >= month_start), 0),
        'new_leads_7d', (select count(*) from public.crm_contacts where role = 'lead' and created_at > now() - interval '7 days'))
      from public.crm_deals
    ) end,
    'tasks_due', case when private.staff_can('crm.view') then
      (select count(*) from public.crm_activities where kind = 'task' and done_at is null and (due_at at time zone tz)::date <= today)
      + (select count(*) from public.plan_tasks where status <> 'complete' and due_date <= today)
    end,
    'bookings_today', case when private.staff_can('crm.view') then
      (select count(*) from public.bookings where status in ('pending', 'confirmed') and (starts_at at time zone tz)::date = today)
    end,
    'inbox_unread', case when private.staff_can('comms.view') then
      (select count(*) from public.inbox_messages where status = 'new')
      + (select count(*) from public.phone_messages where direction = 'inbound' and read_at is null)
    end
  );
end $$;

-- ---------------------------------------------------------------------------
-- Analytics: one metric over time
-- ---------------------------------------------------------------------------
create function public.admin_series(p_metric text, p_bucket text, p_since date, p_until date)
returns table (bucket date, value numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text := private.org_timezone();
  t0 timestamptz;
  t1 timestamptz;
  need text := case
    when p_metric in ('revenue', 'orders') then 'billing.view'
    when p_metric in ('deals_created', 'deals_won', 'won_value', 'leads') then 'crm.view'
    when p_metric in ('calls', 'texts', 'emails', 'inbound') then 'comms.view'
    when p_metric = 'ai_cost' then 'ai.view'
    when p_metric in ('signups', 'active_users', 'recordings', 'minutes') then 'analytics.view' end;
begin
  if not private.staff_can('analytics.view') or need is null or not private.staff_can(need) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month', 'year') then raise exception 'Bad bucket' using errcode = '22023'; end if;
  if p_until < p_since or p_until - p_since > 3700 then raise exception 'Bad range' using errcode = '22023'; end if;
  t0 := p_since::timestamp at time zone tz;
  t1 := (p_until + 1)::timestamp at time zone tz;

  return query
  with ev as (
    select created_at as ts, 1::numeric as v, null::uuid as who from auth.users where p_metric = 'signups' and created_at >= t0 and created_at < t1
    union all select created_at, 1, created_by from public.recordings where p_metric in ('recordings', 'active_users') and created_at >= t0 and created_at < t1
    union all select created_at, coalesce(duration_sec, 0) / 60.0, null from public.recordings where p_metric = 'minutes' and created_at >= t0 and created_at < t1
    union all select created_at, total / 100.0, null from public.orders where p_metric = 'revenue' and status in ('paid', 'partially_refunded') and created_at >= t0 and created_at < t1
    union all select created_at, 1, null from public.orders where p_metric = 'orders' and status in ('paid', 'partially_refunded') and created_at >= t0 and created_at < t1
    union all select created_at, 1, null from public.crm_contacts where p_metric = 'leads' and role = 'lead' and created_at >= t0 and created_at < t1
    union all select created_at, 1, null from public.crm_deals where p_metric = 'deals_created' and created_at >= t0 and created_at < t1
    union all select closed_at, 1, null from public.crm_deals where p_metric = 'deals_won' and stage = 'closed_won' and closed_at >= t0 and closed_at < t1
    union all select closed_at, value_cents / 100.0, null from public.crm_deals where p_metric = 'won_value' and stage = 'closed_won' and closed_at >= t0 and closed_at < t1
    union all select created_at, 1, null from public.phone_calls where p_metric = 'calls' and created_at >= t0 and created_at < t1
    union all select created_at, 1, null from public.phone_messages where p_metric = 'texts' and created_at >= t0 and created_at < t1
    union all select created_at, 1, null from public.email_sends where p_metric = 'emails' and status = 'sent' and created_at >= t0 and created_at < t1
    union all select created_at, 1, null from public.inbox_messages where p_metric = 'inbound' and created_at >= t0 and created_at < t1
    union all select created_at, coalesce(cost_cents, 0) / 100.0, null from public.ai_usage where p_metric = 'ai_cost' and created_at >= t0 and created_at < t1
  ),
  b as (
    select generate_series(date_trunc(p_bucket, p_since::timestamp), p_until::timestamp, ('1 ' || p_bucket)::interval)::date as d
  ),
  agg as (
    select date_trunc(p_bucket, ev.ts at time zone tz)::date as d,
           case when p_metric = 'active_users' then count(distinct ev.who)::numeric else sum(ev.v) end as v
    from ev group by 1
  )
  select b.d, round(coalesce(agg.v, 0), 2) from b left join agg on agg.d = b.d order by b.d;
end $$;
revoke execute on function public.admin_series(text, text, date, date) from public, anon;
grant execute on function public.admin_series(text, text, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create function public.admin_report(p_kind text, p_since date, p_until date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text := private.org_timezone();
  t0 timestamptz := p_since::timestamp at time zone tz;
  t1 timestamptz := (p_until + 1)::timestamp at time zone tz;
  by_day boolean := p_until - p_since <= 62;
  need text := case
    when p_kind in ('pipeline_by_stage', 'pipeline_by_owner', 'win_loss', 'lost_reasons', 'lead_sources') then 'crm.view'
    when p_kind = 'revenue' then 'billing.view'
    when p_kind = 'comms_activity' then 'comms.view'
    when p_kind = 'usage' then 'analytics.view' end;
  res jsonb;
begin
  if not private.staff_can('analytics.view') or need is null or not private.staff_can(need) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_until < p_since or p_until - p_since > 3700 then raise exception 'Bad range' using errcode = '22023'; end if;

  if p_kind = 'pipeline_by_stage' then
    select coalesce(jsonb_agg(r order by r.ord), '[]') into res from (
      select s.ord, s.stage, count(d.id) as deals, coalesce(sum(d.value_cents), 0) as value_cents,
             coalesce(round(sum(d.value_cents * d.probability / 100.0)), 0) as weighted_cents,
             coalesce(round(avg(extract(epoch from now() - d.stage_entered_at) / 86400)), 0) as avg_days_in_stage
      from unnest(array['new_working', 'contacted', 'qualified', 'opportunity', 'proposal', 'negotiation', 'nurture', 'closed_won', 'closed_lost'])
        with ordinality as s(stage, ord)
      left join public.crm_deals d on d.stage = s.stage and d.created_at >= t0 and d.created_at < t1
      group by s.ord, s.stage) r;
  elsif p_kind = 'pipeline_by_owner' then
    select coalesce(jsonb_agg(r order by r.open_value_cents desc), '[]') into res from (
      select coalesce(p.full_name, u.email, 'Unassigned') as owner,
             count(*) filter (where d.stage not in ('closed_won', 'closed_lost')) as open,
             coalesce(sum(d.value_cents) filter (where d.stage not in ('closed_won', 'closed_lost')), 0) as open_value_cents,
             count(*) filter (where d.stage = 'closed_won') as won,
             coalesce(sum(d.value_cents) filter (where d.stage = 'closed_won'), 0) as won_value_cents,
             count(*) filter (where d.stage = 'closed_lost') as lost,
             case when count(*) filter (where d.stage in ('closed_won', 'closed_lost')) = 0 then null
                  else round(100.0 * count(*) filter (where d.stage = 'closed_won') / count(*) filter (where d.stage in ('closed_won', 'closed_lost'))) end as win_rate
      from public.crm_deals d
      left join auth.users u on u.id = d.owner_id
      left join public.profiles p on p.id = d.owner_id
      where d.created_at >= t0 and d.created_at < t1
      group by 1) r;
  elsif p_kind = 'win_loss' then
    select coalesce(jsonb_agg(r order by r.period), '[]') into res from (
      select to_char(date_trunc('month', closed_at at time zone tz), 'YYYY-MM') as period,
             count(*) filter (where stage = 'closed_won') as won, count(*) filter (where stage = 'closed_lost') as lost,
             coalesce(sum(value_cents) filter (where stage = 'closed_won'), 0) as won_value_cents,
             round(100.0 * count(*) filter (where stage = 'closed_won') / count(*)) as win_rate
      from public.crm_deals where stage in ('closed_won', 'closed_lost') and closed_at >= t0 and closed_at < t1
      group by 1) r;
  elsif p_kind = 'lost_reasons' then
    select coalesce(jsonb_agg(r order by r.deals desc), '[]') into res from (
      select coalesce(nullif(trim(lost_reason), ''), 'No reason given') as reason, count(*) as deals,
             coalesce(sum(value_cents), 0) as value_cents
      from public.crm_deals where stage = 'closed_lost' and closed_at >= t0 and closed_at < t1 group by 1) r;
  elsif p_kind = 'lead_sources' then
    select coalesce(jsonb_agg(r order by r.leads desc), '[]') into res from (
      select coalesce(nullif(trim(c.source), ''), 'Unknown') as source, count(distinct c.id) as leads,
             count(distinct d.id) as deals, count(distinct d.id) filter (where d.stage = 'closed_won') as won,
             coalesce(sum(d.value_cents) filter (where d.stage = 'closed_won'), 0) as won_value_cents
      from public.crm_contacts c left join public.crm_deals d on d.contact_id = c.id
      where c.created_at >= t0 and c.created_at < t1 and c.role in ('lead', 'prospect', 'client')
      group by 1) r;
  elsif p_kind = 'revenue' then
    select coalesce(jsonb_agg(r order by r.period), '[]') into res from (
      select to_char(date_trunc('month', created_at at time zone tz), 'YYYY-MM') as period,
             count(*) filter (where status in ('paid', 'partially_refunded')) as orders,
             coalesce(sum(total) filter (where status in ('paid', 'partially_refunded')), 0) as revenue_cents,
             count(*) filter (where kind = 'renewal' and status in ('paid', 'partially_refunded')) as renewals,
             count(*) filter (where status in ('refunded', 'partially_refunded')) as refunds,
             coalesce(sum(discount), 0) as discounts_cents
      from public.orders where created_at >= t0 and created_at < t1 group by 1) r;
  elsif p_kind in ('comms_activity', 'usage') then
    with periods as (
      select to_char(g, case when by_day then 'YYYY-MM-DD' else 'YYYY-MM' end) as period
      from generate_series(date_trunc(case when by_day then 'day' else 'month' end, p_since::timestamp), p_until::timestamp,
                           case when by_day then interval '1 day' else interval '1 month' end) g
    ),
    ev as (
      select to_char(ts at time zone tz, case when by_day then 'YYYY-MM-DD' else 'YYYY-MM' end) as period, k from (
        select created_at as ts, 'calls_in' as k from public.phone_calls where p_kind = 'comms_activity' and direction = 'inbound' and created_at >= t0 and created_at < t1
        union all select created_at, 'calls_out' from public.phone_calls where p_kind = 'comms_activity' and direction = 'outbound' and created_at >= t0 and created_at < t1
        union all select created_at, 'texts_in' from public.phone_messages where p_kind = 'comms_activity' and direction = 'inbound' and created_at >= t0 and created_at < t1
        union all select created_at, 'texts_out' from public.phone_messages where p_kind = 'comms_activity' and direction = 'outbound' and created_at >= t0 and created_at < t1
        union all select created_at, 'emails_sent' from public.email_sends where p_kind = 'comms_activity' and status = 'sent' and created_at >= t0 and created_at < t1
        union all select created_at, 'inbound_messages' from public.inbox_messages where p_kind = 'comms_activity' and created_at >= t0 and created_at < t1
        union all select created_at, 'signups' from auth.users where p_kind = 'usage' and created_at >= t0 and created_at < t1
        union all select created_at, 'recordings' from public.recordings where p_kind = 'usage' and created_at >= t0 and created_at < t1
        union all select created_at, 'ai_requests' from public.ai_usage where p_kind = 'usage' and created_at >= t0 and created_at < t1
      ) x
    )
    select coalesce(jsonb_agg(j order by j ->> 'period'), '[]') into res from (
      select case when p_kind = 'comms_activity' then jsonb_build_object('period', p.period,
               'calls_in', count(*) filter (where k = 'calls_in'), 'calls_out', count(*) filter (where k = 'calls_out'),
               'texts_in', count(*) filter (where k = 'texts_in'), 'texts_out', count(*) filter (where k = 'texts_out'),
               'emails_sent', count(*) filter (where k = 'emails_sent'), 'inbound_messages', count(*) filter (where k = 'inbound_messages'))
             else jsonb_build_object('period', p.period, 'signups', count(*) filter (where k = 'signups'),
               'recordings', count(*) filter (where k = 'recordings'), 'ai_requests', count(*) filter (where k = 'ai_requests')) end as j
      from periods p left join ev on ev.period = p.period group by p.period) s;
  end if;
  return res;
end $$;
revoke execute on function public.admin_report(text, date, date) from public, anon;
grant execute on function public.admin_report(text, date, date) to authenticated;

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('pipeline_by_stage', 'pipeline_by_owner', 'win_loss', 'lost_reasons', 'lead_sources', 'revenue', 'comms_activity', 'usage')),
  range text not null default '30d' check (range in ('7d', '30d', '90d', '12m', 'ytd', 'custom')),
  since date,
  until date,
  shared boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (range <> 'custom' or (since is not null and until is not null and until >= since))
);
create index saved_reports_created_by_idx on public.saved_reports (created_by);

revoke all on public.saved_reports from anon, authenticated;
grant select, delete on public.saved_reports to authenticated;
grant insert (name, kind, range, since, until, shared), update (name, kind, range, since, until, shared) on public.saved_reports to authenticated;
alter table public.saved_reports enable row level security;
create policy "saved_reports_select" on public.saved_reports for select to authenticated
  using ((select private.staff_can('analytics.view')) and (shared or created_by = (select auth.uid())));
create policy "saved_reports_insert" on public.saved_reports for insert to authenticated
  with check ((select private.staff_can('analytics.view')) and created_by = (select auth.uid()));
create policy "saved_reports_update" on public.saved_reports for update to authenticated
  using ((select private.staff_can('analytics.view')) and created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy "saved_reports_delete" on public.saved_reports for delete to authenticated
  using ((select private.staff_can('analytics.view')) and created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Automation rules
-- ---------------------------------------------------------------------------
create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  enabled boolean not null default true,
  trigger text not null check (trigger in (
    'lead_created', 'added_to_pipeline', 'stage_changed', 'closed_won', 'closed_lost',
    'next_step_overdue', 'deal_stalled', 'booking_created', 'inbox_message')),
  stage text check (stage in ('new_working', 'contacted', 'qualified', 'opportunity', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'nurture')),
  stalled_days integer not null default 14 check (stalled_days between 1 and 365),
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 525600),
  match text not null default 'all' check (match in ('all', 'any')),
  conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(conditions) = 'array' and pg_column_size(conditions) <= 8192),
  actions jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 10 and pg_column_size(actions) <= 32768),
  runs integer not null default 0,
  last_run_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automation_rules_trigger_idx on public.automation_rules (trigger) where enabled;
create index automation_rules_created_by_idx on public.automation_rules (created_by);
create trigger automation_rules_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();

create table public.automation_rule_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules (id) on delete cascade,
  run_key text not null check (char_length(run_key) <= 200),
  deal_id uuid references public.crm_deals (id) on delete cascade,
  contact_id uuid references public.crm_contacts (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  message_id uuid references public.inbox_messages (id) on delete cascade,
  run_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'done', 'skipped', 'failed')),
  detail text check (char_length(detail) <= 1000),
  results jsonb not null default '[]'::jsonb check (pg_column_size(results) <= 16384),
  created_at timestamptz not null default now(),
  unique (rule_id, run_key)
);
create index automation_rule_runs_due_idx on public.automation_rule_runs (run_at) where status = 'queued';
create index automation_rule_runs_rule_idx on public.automation_rule_runs (rule_id, created_at desc);
create index automation_rule_runs_deal_idx on public.automation_rule_runs (deal_id);
create index automation_rule_runs_contact_idx on public.automation_rule_runs (contact_id);
create index automation_rule_runs_booking_idx on public.automation_rule_runs (booking_id);
create index automation_rule_runs_message_idx on public.automation_rule_runs (message_id);

revoke all on public.automation_rules, public.automation_rule_runs from anon, authenticated;
grant select, delete on public.automation_rules to authenticated;
grant insert (name, description, enabled, trigger, stage, stalled_days, delay_minutes, match, conditions, actions),
      update (name, description, enabled, trigger, stage, stalled_days, delay_minutes, match, conditions, actions)
  on public.automation_rules to authenticated;
-- Staff can queue a test run by hand; the cron job (service role) does the rest.
grant select, insert (rule_id, run_key, deal_id, contact_id, booking_id, message_id, run_at) on public.automation_rule_runs to authenticated;
alter table public.automation_rules enable row level security;
alter table public.automation_rule_runs enable row level security;
create policy "automation_rules_select" on public.automation_rules for select to authenticated using ((select private.staff_can('comms.view')));
create policy "automation_rules_insert" on public.automation_rules for insert to authenticated with check ((select private.staff_can('comms.manage')));
create policy "automation_rules_update" on public.automation_rules for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "automation_rules_delete" on public.automation_rules for delete to authenticated using ((select private.staff_can('comms.manage')));
create policy "automation_rule_runs_select" on public.automation_rule_runs for select to authenticated using ((select private.staff_can('comms.view')));
create policy "automation_rule_runs_insert" on public.automation_rule_runs for insert to authenticated with check ((select private.staff_can('comms.manage')));

-- Queue runs for every enabled rule on this trigger. Runs at most once per
-- rule and key; never blocks the change that fired it.
create function private.queue_rules(p_trigger text, p_key text, p_stage text, p_deal uuid, p_contact uuid, p_booking uuid, p_message uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.automation_rule_runs (rule_id, run_key, deal_id, contact_id, booking_id, message_id, run_at)
  select r.id, p_trigger || ':' || p_key, p_deal, p_contact, p_booking, p_message, now() + make_interval(mins => r.delay_minutes)
  from public.automation_rules r
  where r.enabled and r.trigger = p_trigger and (p_trigger <> 'stage_changed' or r.stage is null or r.stage = p_stage)
  on conflict (rule_id, run_key) do nothing;
exception when others then
  raise warning 'queue_rules %: %', p_trigger, sqlerrm;
end $$;
revoke execute on function private.queue_rules(text, text, text, uuid, uuid, uuid, uuid) from public, anon, authenticated;

create function private.rules_on_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'lead' and (tg_op = 'INSERT' or old.role is distinct from 'lead') then
    perform private.queue_rules('lead_created', new.id::text, null, null, new.id, null, null);
  end if;
  return null;
end $$;
create function private.rules_on_deal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.queue_rules('added_to_pipeline', new.id::text, null, new.id, new.contact_id, null, null);
  elsif new.stage is distinct from old.stage then
    perform private.queue_rules('stage_changed', new.id || ':' || new.stage || ':' || extract(epoch from new.stage_entered_at)::bigint, new.stage, new.id, new.contact_id, null, null);
    if new.stage in ('closed_won', 'closed_lost') then
      perform private.queue_rules(new.stage, new.id::text, null, new.id, new.contact_id, null, null);
    end if;
  end if;
  return null;
end $$;
create function private.rules_on_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.queue_rules('booking_created', new.id::text, null, null, null, new.id, null);
  return null;
end $$;
create function private.rules_on_inbox() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.queue_rules('inbox_message', new.id::text, null, null, new.contact_id, null, new.id);
  return null;
end $$;
revoke execute on function private.rules_on_contact(), private.rules_on_deal(), private.rules_on_booking(), private.rules_on_inbox()
  from public, anon, authenticated;

create trigger crm_contacts_rules after insert or update of role on public.crm_contacts
  for each row execute function private.rules_on_contact();
create trigger crm_deals_rules after insert or update of stage on public.crm_deals
  for each row execute function private.rules_on_deal();
create trigger bookings_rules after insert on public.bookings
  for each row execute function private.rules_on_booking();
create trigger inbox_messages_rules after insert on public.inbox_messages
  for each row execute function private.rules_on_inbox();
