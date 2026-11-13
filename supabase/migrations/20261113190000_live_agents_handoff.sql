-- Live Agents step 7: calls reach the booked Live Agent.
--
-- The business picks which Redial line a booking covers. When that line's
-- calls ring out unanswered (or the AI hands off, once the voice gateway is
-- live), Redial rings the Live Agent's Agent Desk in their browser. Each
-- attempt is a call session; answered seconds bill on-demand bookings
-- weekly (/api/cron/live-agents), with the agent's share paid out after
-- the usual 3-day hold.

alter table public.live_agent_engagements
  add column line_id uuid references public.redial_lines on delete set null,
  add column billed_through timestamptz;
create index live_agent_engagements_line_idx on public.live_agent_engagements (line_id) where line_id is not null;

create table public.live_agent_call_sessions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.live_agent_engagements on delete cascade,
  agent_id uuid not null references public.live_agents on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  redial_call_id uuid references public.redial_calls on delete set null,
  caller_number text check (char_length(caller_number) <= 40),
  status text not null default 'ringing' check (status in ('ringing', 'answered', 'missed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  billable_seconds int not null default 0 check (billable_seconds >= 0),
  payment_id uuid references public.live_agent_payments on delete set null
);
create index live_agent_call_sessions_engagement_idx on public.live_agent_call_sessions (engagement_id, started_at desc);
create index live_agent_call_sessions_agent_idx on public.live_agent_call_sessions (agent_id, started_at desc);
create index live_agent_call_sessions_workspace_idx on public.live_agent_call_sessions (workspace_id);
create index live_agent_call_sessions_call_idx on public.live_agent_call_sessions (redial_call_id);
create index live_agent_call_sessions_payment_idx on public.live_agent_call_sessions (payment_id);

revoke all on public.live_agent_call_sessions from anon, authenticated;
grant select on public.live_agent_call_sessions to authenticated;
alter table public.live_agent_call_sessions enable row level security;
create policy "live_agent_call_sessions_select" on public.live_agent_call_sessions for select to authenticated
  using (
    exists (select 1 from public.live_agents a where a.id = agent_id and a.user_id = (select auth.uid()))
    or (select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));

-- The business routes a paid booking to one of their own Redial lines (or
-- stops routing with line = null). One booking per line at a time.
create or replace function public.live_agent_route(engagement uuid, line uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.live_agent_engagements;
begin
  select * into e from public.live_agent_engagements where id = engagement;
  if e.id is null or private.live_agent_side(e.thread_id) is distinct from 'business' then raise exception 'Not allowed' using errcode = '42501'; end if;
  if e.status <> 'active' then raise exception 'Only paid, active bookings can take calls.' using errcode = '22023'; end if;
  if line is not null then
    if not exists (select 1 from public.redial_lines where id = line and owner_id = auth.uid()) then
      raise exception 'Choose one of your own Redial lines.' using errcode = '22023';
    end if;
    update public.live_agent_engagements set line_id = null where line_id = line and id <> engagement;
  end if;
  update public.live_agent_engagements set line_id = line where id = engagement;
  perform private.live_agent_post(e.thread_id, 'system', 'system',
    case when line is null then 'Calls are no longer sent to the Live Agent.'
         else 'Missed calls on ' || (select label from public.redial_lines where id = line) || ' now ring the Live Agent''s Agent Desk.' end, engagement);
end $$;
revoke execute on function public.live_agent_route(uuid, uuid) from public, anon;
grant execute on function public.live_agent_route(uuid, uuid) to authenticated;

-- Weekly on-demand billing (service role): records the off-session charge,
-- marks the sessions billed and queues the agent's payout.
create or replace function public.live_agent_bill_minutes(engagement uuid, sessions uuid[], pi text, amount int, base int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.live_agent_engagements;
  v_pay uuid;
begin
  select * into e from public.live_agent_engagements where id = engagement;
  if e.id is null then return; end if;
  insert into public.live_agent_payments (engagement_id, workspace_id, kind, stripe_session_id, stripe_payment_intent, amount_cents, base_cents, status)
  values (e.id, e.workspace_id, 'charge', pi, pi, amount, base, 'paid')
  on conflict (stripe_session_id) do nothing
  returning id into v_pay;
  if v_pay is null then return; end if;
  update public.live_agent_call_sessions set payment_id = v_pay where id = any(sessions) and payment_id is null;
  update public.live_agent_engagements set billed_through = now() where id = engagement;
  insert into public.live_agent_payouts (engagement_id, agent_id, payment_id, amount_cents, available_at)
  values (e.id, e.agent_id, v_pay, greatest(0, round(base * (1 - e.agent_fee_pct / 100)))::int, now() + interval '3 days')
  on conflict (payment_id) do nothing;
  perform private.live_agent_post(e.thread_id, 'system', 'system',
    'Billed ' || to_char(amount / 100.0, 'FM$999,990.00') || ' for this week''s answered calls.', engagement);
end $$;
revoke execute on function public.live_agent_bill_minutes(uuid, uuid[], text, int, int) from public, anon, authenticated;
grant execute on function public.live_agent_bill_minutes(uuid, uuid[], text, int, int) to service_role;
