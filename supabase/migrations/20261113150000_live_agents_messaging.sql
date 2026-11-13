-- Live Agents steps 4 and 5: private messaging between a business (a
-- workspace's owners and admins) and a Live Agent, and offers that become
-- engagements (on-demand, shifts, monthly, paid trial).
--
-- Every write goes through the functions below, so contact details are
-- masked on the server and nobody can fake the other side's messages or
-- accept their own offer. Participants read with RLS: business members via
-- their workspace, the agent via their profile.

-- 1. Threads: one per workspace + agent.
create table public.live_agent_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  agent_id uuid not null references public.live_agents on delete cascade,
  business_name text not null check (char_length(business_name) <= 120), -- what the agent sees
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  business_read_at timestamptz not null default now(),
  agent_read_at timestamptz,
  blocked_by text check (blocked_by in ('business', 'agent')),
  unique (workspace_id, agent_id)
);
create index live_agent_threads_agent_idx on public.live_agent_threads (agent_id, last_message_at desc);
create index live_agent_threads_created_by_idx on public.live_agent_threads (created_by);

-- 2. Engagements (offers until accepted).
create table public.live_agent_engagements (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.live_agent_threads on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  agent_id uuid not null references public.live_agents on delete cascade,
  type text not null check (type in ('on_demand', 'shift', 'retainer', 'trial')),
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'withdrawn', 'replaced', 'active', 'completed', 'cancelled')),
  offered_by text not null check (offered_by in ('business', 'agent')),
  rate_cents int not null check (rate_cents between 10 and 2000000), -- the agent's rate: per minute, per hour, or per month
  hours numeric(6, 2) check (hours > 0 and hours <= 744), -- shift length, monthly hours, or trial length
  starts_on date,
  ends_on date,
  schedule text check (char_length(schedule) <= 300), -- e.g. "Weekdays 12–1 pm"
  script text check (char_length(script) <= 4000), -- what the agent should know: greeting, FAQs, transfer rules
  business_fee_pct numeric(5, 2) not null,
  agent_fee_pct numeric(5, 2) not null,
  replaces uuid references public.live_agent_engagements on delete set null, -- a counter-offer replaces the offer it answers
  created_by uuid references auth.users on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_agent_engagements_thread_idx on public.live_agent_engagements (thread_id, created_at desc);
create index live_agent_engagements_workspace_idx on public.live_agent_engagements (workspace_id, status);
create index live_agent_engagements_agent_idx on public.live_agent_engagements (agent_id, status);
create index live_agent_engagements_replaces_idx on public.live_agent_engagements (replaces);
create index live_agent_engagements_created_by_idx on public.live_agent_engagements (created_by);
create trigger live_agent_engagements_updated_at before update on public.live_agent_engagements
  for each row execute function public.set_updated_at();

-- 3. Messages.
create table public.live_agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.live_agent_threads on delete cascade,
  sender_side text not null check (sender_side in ('business', 'agent', 'system')),
  sender_id uuid references auth.users on delete set null,
  kind text not null default 'text' check (kind in ('text', 'offer', 'system')),
  body text not null check (char_length(body) <= 4000),
  masked boolean not null default false,
  engagement_id uuid references public.live_agent_engagements on delete set null,
  created_at timestamptz not null default now()
);
create index live_agent_messages_thread_idx on public.live_agent_messages (thread_id, created_at);
create index live_agent_messages_engagement_idx on public.live_agent_messages (engagement_id);
create index live_agent_messages_sender_idx on public.live_agent_messages (sender_id);

-- 4. Reports (staff only).
create table public.live_agent_reports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.live_agent_threads on delete set null,
  agent_id uuid references public.live_agents on delete set null,
  reporter_id uuid references auth.users on delete set null,
  reporter_side text not null check (reporter_side in ('business', 'agent')),
  reason text not null check (reason in ('contact_info', 'off_platform_payment', 'harassment', 'spam', 'no_show', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index live_agent_reports_thread_idx on public.live_agent_reports (thread_id);
create index live_agent_reports_agent_idx on public.live_agent_reports (agent_id);
create index live_agent_reports_reporter_idx on public.live_agent_reports (reporter_id);

-- 5. Which side the signed-in person is on in a thread (null: not in it).
-- Business: owners and admins of the workspace. Agent: the profile's owner.
create or replace function private.live_agent_side(t uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.live_agent_threads x join public.live_agents a on a.id = x.agent_id
                 where x.id = t and a.user_id = (select auth.uid())) then 'agent'
    when exists (select 1 from public.live_agent_threads x
                 where x.id = t and private.has_role(x.workspace_id, array['owner', 'admin']::public.workspace_role[])) then 'business'
  end;
$$;
revoke execute on function private.live_agent_side(uuid) from public, anon;
grant execute on function private.live_agent_side(uuid) to authenticated;

-- Read access.
revoke all on public.live_agent_threads, public.live_agent_messages, public.live_agent_engagements, public.live_agent_reports from anon, authenticated;
grant select on public.live_agent_threads, public.live_agent_messages, public.live_agent_engagements to authenticated;
alter table public.live_agent_threads enable row level security;
alter table public.live_agent_messages enable row level security;
alter table public.live_agent_engagements enable row level security;
alter table public.live_agent_reports enable row level security;

create policy "live_agent_threads_select" on public.live_agent_threads for select to authenticated
  using ((select private.live_agent_side(id)) is not null);
create policy "live_agent_messages_select" on public.live_agent_messages for select to authenticated
  using ((select private.live_agent_side(thread_id)) is not null);
create policy "live_agent_engagements_select" on public.live_agent_engagements for select to authenticated
  using ((select private.live_agent_side(thread_id)) is not null);

alter publication supabase_realtime add table public.live_agent_messages;

-- 6. Hide phone numbers, emails, links and handles (always: calls and payments stay on Redial).
create or replace function private.live_agent_mask(body text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(body,
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email hidden]', 'g'),
    '(https?://|www\.)\S+|\m[A-Za-z0-9-]+\.(com|net|org|io|co|us|me|biz|info|app|link)\M\S*', '[link hidden]', 'gi'),
    '(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', '[phone hidden]', 'g'),
    '(?:^|\s)@[A-Za-z0-9_.]{3,}', ' [handle hidden]', 'g');
$$;

-- Posts a message as the signed-in side (masked), bumps the thread and
-- notifies the other side.
create or replace function private.live_agent_post(t uuid, side text, kind text, body text, engagement uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  th public.live_agent_threads;
  clean text := left(trim(body), 4000);
  shown text;
  v_id uuid;
  a record;
  m record;
begin
  select * into th from public.live_agent_threads where id = t;
  shown := case when kind = 'text' then private.live_agent_mask(clean) else clean end;
  insert into public.live_agent_messages (thread_id, sender_side, sender_id, kind, body, masked, engagement_id)
  values (t, side, case when side = 'system' then null else auth.uid() end, kind, shown, shown is distinct from clean, engagement)
  returning id into v_id;
  update public.live_agent_threads set last_message_at = now(),
    business_read_at = case when side = 'business' then now() else business_read_at end,
    agent_read_at = case when side = 'agent' then now() else agent_read_at end
  where id = t;

  select id, user_id, display_name into a from public.live_agents where id = th.agent_id;
  if side = 'business' and a.user_id is not null then
    perform private.notify(a.user_id, case when kind = 'offer' then 'live_agent_offer' else 'live_agent_message' end,
      th.business_name || case when kind = 'offer' then ' sent you an offer' else ' sent you a message' end,
      left(shown, 140), '/messages/' || t, jsonb_build_object('thread_id', t));
  elsif side = 'agent' then
    for m in select wm.user_id from public.workspace_members wm
             where wm.workspace_id = th.workspace_id and wm.role in ('owner', 'admin') loop
      perform private.notify(m.user_id, case when kind = 'offer' then 'live_agent_offer' else 'live_agent_message' end,
        a.display_name || case when kind = 'offer' then ' sent a counter-offer' else ' sent you a message' end,
        left(shown, 140), '/messages/' || t, jsonb_build_object('thread_id', t));
    end loop;
  end if;
  return v_id;
end $$;
revoke execute on function private.live_agent_post(uuid, text, text, text, uuid) from public, anon, authenticated;

-- 7. Start (or reopen) a thread with a Live Agent and send the first message.
create or replace function public.live_agent_start_thread(agent uuid, ws uuid, body text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.live_agents;
  v_thread uuid;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if not private.has_role(ws, array['owner', 'admin']::public.workspace_role[]) then
    raise exception 'Only owners and admins of a workspace can message Live Agents for it.' using errcode = '42501';
  end if;
  select * into a from public.live_agents where id = agent;
  if a.id is null or a.status <> 'live' then raise exception 'That Live Agent isn''t available.' using errcode = '22023'; end if;
  if a.user_id = auth.uid() then raise exception 'That''s your own profile.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(body, ''))) < 2 then raise exception 'Write a message first.' using errcode = '22023'; end if;
  if (select count(*) from public.live_agent_threads where created_by = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'You''ve started a lot of conversations today. Try again tomorrow.' using errcode = '54000';
  end if;

  select id into v_thread from public.live_agent_threads where workspace_id = ws and agent_id = agent;
  if v_thread is null then
    select case when w.is_personal then coalesce(nullif(trim(p.full_name), ''), 'A Redial business') else w.name end into v_name
    from public.workspaces w left join public.profiles p on p.id = auth.uid() where w.id = ws;
    insert into public.live_agent_threads (workspace_id, agent_id, business_name, created_by)
    values (ws, agent, left(coalesce(v_name, 'A Redial business'), 120), auth.uid()) returning id into v_thread;
  elsif exists (select 1 from public.live_agent_threads where id = v_thread and blocked_by is not null) then
    raise exception 'This conversation is closed.' using errcode = '22023';
  end if;
  perform private.live_agent_post(v_thread, 'business', 'text', body);
  return v_thread;
end $$;
revoke execute on function public.live_agent_start_thread(uuid, uuid, text) from public, anon;
grant execute on function public.live_agent_start_thread(uuid, uuid, text) to authenticated;

-- 8. Send a message in a thread you're part of.
create or replace function public.live_agent_send(t uuid, body text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  side text := private.live_agent_side(t);
begin
  if side is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.live_agent_threads where id = t and blocked_by is not null) then
    raise exception 'This conversation is closed.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(body, ''))) = 0 then raise exception 'Write a message first.' using errcode = '22023'; end if;
  if (select count(*) from public.live_agent_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Slow down a little and try again in a minute.' using errcode = '54000';
  end if;
  return private.live_agent_post(t, side, 'text', body);
end $$;
revoke execute on function public.live_agent_send(uuid, text) from public, anon;
grant execute on function public.live_agent_send(uuid, text) to authenticated;

create or replace function public.live_agent_mark_read(t uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  side text := private.live_agent_side(t);
begin
  if side = 'business' then update public.live_agent_threads set business_read_at = now() where id = t;
  elsif side = 'agent' then update public.live_agent_threads set agent_read_at = now() where id = t;
  end if;
end $$;
revoke execute on function public.live_agent_mark_read(uuid) from public, anon;
grant execute on function public.live_agent_mark_read(uuid) to authenticated;

-- 9. Offers. The business offers; the agent may counter (a new offer that
-- replaces the old one). The other side accepts or declines; the sender
-- can withdraw. Fees are copied from the current settings.
create or replace function public.live_agent_offer(t uuid, p jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  side text := private.live_agent_side(t);
  th public.live_agent_threads;
  fees jsonb := public.live_agent_fees();
  v_type text := p->>'type';
  v_rate int := (p->>'rate_cents')::int;
  v_hours numeric := nullif(p->>'hours', '')::numeric;
  v_replaces uuid := nullif(p->>'replaces', '')::uuid;
  v_id uuid;
  label text;
begin
  if side is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into th from public.live_agent_threads where id = t;
  if th.blocked_by is not null then raise exception 'This conversation is closed.' using errcode = '22023'; end if;
  if v_type not in ('on_demand', 'shift', 'retainer', 'trial') then raise exception 'Choose the kind of work.' using errcode = '22023'; end if;
  if v_rate is null or v_rate < 10 then raise exception 'Set a rate.' using errcode = '22023'; end if;
  if v_type in ('shift', 'retainer') and v_hours is null then raise exception 'Set the hours.' using errcode = '22023'; end if;
  if v_type = 'trial' then v_hours := 0.5; end if;
  if side = 'agent' and v_replaces is null then raise exception 'Live Agents can counter an offer, not start one.' using errcode = '22023'; end if;
  if v_replaces is not null then
    if not exists (select 1 from public.live_agent_engagements where id = v_replaces and thread_id = t and status = 'offered' and offered_by <> side) then
      raise exception 'That offer can''t be countered anymore.' using errcode = '22023';
    end if;
    update public.live_agent_engagements set status = 'replaced', responded_at = now() where id = v_replaces;
  end if;
  if (select count(*) from public.live_agent_engagements where thread_id = t and status = 'offered') >= 5 then
    raise exception 'There are already several open offers here. Withdraw one first.' using errcode = '22023';
  end if;

  insert into public.live_agent_engagements (thread_id, workspace_id, agent_id, type, offered_by, rate_cents, hours, starts_on, ends_on,
                                             schedule, script, business_fee_pct, agent_fee_pct, replaces, created_by)
  values (t, th.workspace_id, th.agent_id, v_type, side, v_rate, v_hours, nullif(p->>'starts_on', '')::date, nullif(p->>'ends_on', '')::date,
          nullif(left(trim(coalesce(p->>'schedule', '')), 300), ''), nullif(left(trim(coalesce(p->>'script', '')), 4000), ''),
          (fees->>'businessFeePercent')::numeric, (fees->>'agentFeePercent')::numeric, v_replaces, auth.uid())
  returning id into v_id;

  label := case v_type when 'on_demand' then 'On-demand' when 'shift' then 'Shift' when 'retainer' then 'Monthly plan' else '30-minute paid trial' end;
  perform private.live_agent_post(t, side, 'offer', case when v_replaces is null then 'Offer: ' else 'Counter-offer: ' end || label
    || coalesce(' · ' || nullif(left(trim(coalesce(p->>'note', '')), 500), ''), ''), v_id);
  return v_id;
end $$;
revoke execute on function public.live_agent_offer(uuid, jsonb) from public, anon;
grant execute on function public.live_agent_offer(uuid, jsonb) to authenticated;

-- accept / decline (the other side), withdraw (the sender), cancel / complete
-- (either side, once accepted).
create or replace function public.live_agent_respond(engagement uuid, action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.live_agent_engagements;
  side text;
  next text;
  words text;
begin
  select * into e from public.live_agent_engagements where id = engagement for update;
  if e.id is null then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  side := private.live_agent_side(e.thread_id);
  if side is null then raise exception 'Not allowed' using errcode = '42501'; end if;

  if action in ('accept', 'decline') then
    if e.status <> 'offered' or e.offered_by = side then raise exception 'You can''t answer this offer.' using errcode = '22023'; end if;
    next := case action when 'accept' then 'accepted' else 'declined' end;
  elsif action = 'withdraw' then
    if e.status <> 'offered' or e.offered_by <> side then raise exception 'You can''t withdraw this offer.' using errcode = '22023'; end if;
    next := 'withdrawn';
  elsif action = 'cancel' then
    if e.status not in ('accepted', 'active') then raise exception 'Only booked work can be cancelled.' using errcode = '22023'; end if;
    next := 'cancelled';
  elsif action = 'complete' then
    if e.status not in ('accepted', 'active') or side <> 'business' then raise exception 'Only the business can mark work complete.' using errcode = '22023'; end if;
    next := 'completed';
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;

  update public.live_agent_engagements set status = next, responded_at = now() where id = engagement;
  words := case next when 'accepted' then 'accepted the offer. You''re booked.' when 'declined' then 'declined the offer.'
    when 'withdrawn' then 'withdrew the offer.' when 'cancelled' then 'cancelled the booking.' else 'marked the work complete.' end;
  perform private.live_agent_post(e.thread_id, 'system', 'system',
    case side when 'business' then (select business_name from public.live_agent_threads where id = e.thread_id)
              else (select display_name from public.live_agents where id = e.agent_id) end || ' ' || words, engagement);
end $$;
revoke execute on function public.live_agent_respond(uuid, text) from public, anon;
grant execute on function public.live_agent_respond(uuid, text) to authenticated;

-- 10. Block (closes the thread for both sides) and report (to staff).
create or replace function public.live_agent_block(t uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  side text := private.live_agent_side(t);
begin
  if side is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.live_agent_threads set blocked_by = side where id = t and blocked_by is null;
  update public.live_agent_engagements set status = 'withdrawn', responded_at = now() where thread_id = t and status = 'offered';
end $$;
revoke execute on function public.live_agent_block(uuid) from public, anon;
grant execute on function public.live_agent_block(uuid) to authenticated;

create or replace function public.live_agent_report(t uuid, reason text, details text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  side text := private.live_agent_side(t);
  s record;
begin
  if side is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if reason not in ('contact_info', 'off_platform_payment', 'harassment', 'spam', 'no_show', 'other') then
    raise exception 'Choose a reason.' using errcode = '22023';
  end if;
  insert into public.live_agent_reports (thread_id, agent_id, reporter_id, reporter_side, reason, details)
  values (t, (select agent_id from public.live_agent_threads where id = t), auth.uid(), side, reason, nullif(left(trim(coalesce(details, '')), 2000), ''));
  for s in select user_id, role from public.platform_staff loop
    if 'marketplace.manage' = any(private.role_permissions(s.role)) then
      perform private.notify(s.user_id, 'live_agent_report', 'Live Agents: a conversation was reported', replace(reason, '_', ' '),
        '/admin/live-agents', jsonb_build_object('thread_id', t));
    end if;
  end loop;
end $$;
revoke execute on function public.live_agent_report(uuid, text, text) from public, anon;
grant execute on function public.live_agent_report(uuid, text, text) to authenticated;

-- 11. Staff: open reports, and a reported thread's messages (logged by the
-- server action that calls it).
create or replace function public.admin_live_agent_reports()
returns table (id uuid, thread_id uuid, agent_name text, business_name text, reporter_side text, reason text, details text,
               status text, created_at timestamptz, messages jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('marketplace.view') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select r.id, r.thread_id, a.display_name, t.business_name, r.reporter_side, r.reason, r.details, r.status, r.created_at,
           coalesce((select jsonb_agg(jsonb_build_object('side', m.sender_side, 'body', m.body, 'at', m.created_at) order by m.created_at)
                     from (select * from public.live_agent_messages where thread_id = r.thread_id order by created_at desc limit 50) m), '[]'::jsonb)
    from public.live_agent_reports r
    left join public.live_agent_threads t on t.id = r.thread_id
    left join public.live_agents a on a.id = r.agent_id
    order by (r.status = 'open') desc, r.created_at desc
    limit 200;
end $$;
revoke execute on function public.admin_live_agent_reports() from public, anon;
grant execute on function public.admin_live_agent_reports() to authenticated;

create or replace function public.admin_resolve_live_agent_report(report uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('marketplace.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.live_agent_reports set status = 'resolved' where id = report;
end $$;
revoke execute on function public.admin_resolve_live_agent_report(uuid) from public, anon;
grant execute on function public.admin_resolve_live_agent_report(uuid) to authenticated;
