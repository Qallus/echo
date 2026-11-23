-- Agent tasks: work that AI agents (Claude scheduled agents, Paperclip,
-- Hermes, ...) pick up, do with Redial's tools, and report back on.
-- * agent_tasks: one-off or repeating (daily, weekdays, weekly, monthly at a
--   local time). agent_id null means any agent may take it.
-- * agent_task_runs: each finished run, with the report and links.
-- * Staff who manage staff (owner/admin) create and change tasks. An agent
--   sees the tasks meant for it (or for any agent) and only claims and
--   reports through the two functions below, so it can't rewrite them.
-- The server works out the next run time (organization time zone) and
-- passes it to agent_task_report.

create table public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  instructions text not null default '' check (char_length(instructions) <= 8000),
  area text check (char_length(area) <= 40),
  repeat text not null default 'once' check (repeat in ('once', 'daily', 'weekdays', 'weekly', 'monthly')),
  run_time text check (run_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  next_run_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'done', 'failed', 'paused')),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  last_result text check (char_length(last_result) <= 20000),
  last_links text[] not null default '{}' check (cardinality(last_links) <= 50),
  last_run_at timestamptz,
  runs integer not null default 0 check (runs >= 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_tasks_due_idx on public.agent_tasks (next_run_at) where status = 'queued';
create index agent_tasks_agent_idx on public.agent_tasks (agent_id);
create index agent_tasks_claimed_by_idx on public.agent_tasks (claimed_by);
create index agent_tasks_created_by_idx on public.agent_tasks (created_by);

create table public.agent_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  run_by uuid references auth.users (id) on delete set null,
  ok boolean not null,
  result text check (char_length(result) <= 20000),
  links text[] not null default '{}' check (cardinality(links) <= 50),
  started_at timestamptz,
  finished_at timestamptz not null default now()
);
create index agent_task_runs_task_idx on public.agent_task_runs (task_id, finished_at desc);
create index agent_task_runs_agent_idx on public.agent_task_runs (agent_id);
create index agent_task_runs_run_by_idx on public.agent_task_runs (run_by);

-- The signed-in agent's id (null for people), for the policies below.
create function private.my_agent_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (private.active_agent()).id;
$$;
revoke execute on function private.my_agent_id() from public, anon;
grant execute on function private.my_agent_id() to authenticated;

revoke all on public.agent_tasks, public.agent_task_runs from anon, authenticated;
grant select, delete on public.agent_tasks to authenticated;
grant insert (agent_id, title, instructions, area, repeat, run_time, next_run_at, status),
      update (agent_id, title, instructions, area, repeat, run_time, next_run_at, status, updated_at)
  on public.agent_tasks to authenticated;
grant select on public.agent_task_runs to authenticated;
alter table public.agent_tasks enable row level security;
alter table public.agent_task_runs enable row level security;

-- Staff who manage staff see and change everything; an agent sees the tasks
-- meant for it or for any agent.
create policy "agent_tasks_select" on public.agent_tasks for select to authenticated
  using ((select private.staff_can('staff.manage'))
    or ((select private.my_agent_id()) is not null and (agent_id is null or agent_id = (select private.my_agent_id()))));
create policy "agent_tasks_insert" on public.agent_tasks for insert to authenticated
  with check ((select private.staff_can('staff.manage')) and (select private.staff_role()) <> 'agent');
create policy "agent_tasks_update" on public.agent_tasks for update to authenticated
  using ((select private.staff_can('staff.manage')) and (select private.staff_role()) <> 'agent')
  with check ((select private.staff_can('staff.manage')) and (select private.staff_role()) <> 'agent');
create policy "agent_tasks_delete" on public.agent_tasks for delete to authenticated
  using ((select private.staff_can('staff.manage')) and (select private.staff_role()) <> 'agent');
create policy "agent_task_runs_select" on public.agent_task_runs for select to authenticated
  using ((select private.staff_can('staff.manage'))
    or exists (select 1 from public.agent_tasks t where t.id = task_id
      and (select private.my_agent_id()) is not null and (t.agent_id is null or t.agent_id = (select private.my_agent_id()))));

-- Claim the next due task (or a given one). Claims older than two hours that
-- were never reported go back in the queue first.
create function public.agent_task_claim(p_task uuid default null) returns setof public.agent_tasks
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  a public.agents := private.active_agent();
begin
  if a.id is null and not private.staff_can('staff.manage') then
    raise exception 'Only agents and staff who manage staff can take tasks.' using errcode = '42501';
  end if;
  update public.agent_tasks set status = 'queued', claimed_by = null, claimed_at = null
    where status = 'claimed' and claimed_at < now() - interval '2 hours';
  return query
    update public.agent_tasks t set status = 'claimed', claimed_by = me, claimed_at = now(), updated_at = now()
    where t.id = (
      select x.id from public.agent_tasks x
      where x.status = 'queued'
        and (case when p_task is null then x.next_run_at <= now() else x.id = p_task end)
        and (a.id is null or x.agent_id is null or x.agent_id = a.id)
      order by x.next_run_at
      limit 1
      for update skip locked
    )
    returning t.*;
end $$;
revoke execute on function public.agent_task_claim(uuid) from public, anon;
grant execute on function public.agent_task_claim(uuid) to authenticated;

-- Report on a claimed task. A repeating task goes back in the queue for
-- p_next (at least five minutes away); a one-off ends done or failed.
create function public.agent_task_report(p_task uuid, p_ok boolean, p_result text, p_links text[], p_next timestamptz)
returns public.agent_tasks
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  t public.agent_tasks;
begin
  select * into t from public.agent_tasks where id = p_task for update;
  if t.id is null or t.status <> 'claimed' or t.claimed_by is distinct from me then
    raise exception 'Claim the task first (agent_task_next), then report on it.' using errcode = 'P0001';
  end if;
  insert into public.agent_task_runs (task_id, agent_id, run_by, ok, result, links, started_at)
  values (t.id, (private.active_agent()).id, me, p_ok, left(p_result, 20000), coalesce(p_links[1:50], '{}'), t.claimed_at);
  update public.agent_tasks set
    status = case when t.repeat <> 'once' and p_next is not null then 'queued' when p_ok then 'done' else 'failed' end,
    next_run_at = case when t.repeat <> 'once' and p_next is not null then greatest(p_next, now() + interval '5 minutes') else next_run_at end,
    last_result = left(p_result, 20000), last_links = coalesce(p_links[1:50], '{}'), last_run_at = now(), runs = runs + 1,
    claimed_by = null, claimed_at = null, updated_at = now()
  where id = t.id
  returning * into t;
  if t.created_by is not null and t.created_by <> me then
    perform private.notify(t.created_by, 'agent_task', left((case when p_ok then 'Done: ' else 'Failed: ' end) || t.title, 200),
      left(coalesce(p_result, ''), 900), '/admin/ai/agents#tasks', jsonb_build_object('task_id', t.id));
  end if;
  return t;
end $$;
revoke execute on function public.agent_task_report(uuid, boolean, text, text[], timestamptz) from public, anon;
grant execute on function public.agent_task_report(uuid, boolean, text, text[], timestamptz) to authenticated;

notify pgrst, 'reload schema';
