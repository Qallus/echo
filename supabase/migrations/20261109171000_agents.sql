-- AI agents for the automation MCP (docs/REDIAL_GROWTH_AND_AUTOMATION_PLAN.md, C1b).
-- * Each agent (Paperclip, Hermes, OpenClaw, Herdr, ...) is a real user with
--   staff role 'agent'. Its API key is that user's password, so the MCP signs
--   it in like anyone else and RLS still decides what it can reach.
-- * agents: per-agent permissions (any subset of the creator's) and limits:
--   read-only, allowed tool domains, tools that always need approval, daily
--   caps, IP allowlist, expiry, pause.
-- * agent_approvals: actions waiting for a person. High-risk actions always
--   wait; the creator gets a notification.
-- * An active agent counts as two-step verified: its key is the credential.

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  harness text not null default 'other' check (harness in ('paperclip', 'hermes', 'openclaw', 'herdr', 'chatgpt', 'claude', 'other')),
  key_hint text check (char_length(key_hint) <= 40),
  permissions text[] not null default '{}' check (cardinality(permissions) <= 50),
  read_only boolean not null default false,
  domains text[] not null default '{}' check (cardinality(domains) <= 50),
  approval_tools text[] not null default '{}' check (cardinality(approval_tools) <= 200),
  caps jsonb not null default '{"writes": 500, "high": 20}' check (jsonb_typeof(caps) = 'object'),
  ip_allowlist text[] not null default '{}' check (cardinality(ip_allowlist) <= 50),
  active boolean not null default true,
  expires_at timestamptz,
  key_rotated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agents_created_by_idx on public.agents (created_by);

alter table public.agents enable row level security;
revoke all on public.agents from anon, authenticated;
grant select on public.agents to authenticated;
-- An agent sees its own settings; staff who manage staff see all. Changes go through admin_agent_save.
create policy "agents_select" on public.agents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.staff_can('staff.manage')));

create table public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  tool text not null check (char_length(tool) <= 80),
  args jsonb not null default '{}' check (jsonb_typeof(args) = 'object' and pg_column_size(args) <= 65536),
  summary text check (char_length(summary) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'used')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);
create index agent_approvals_agent_idx on public.agent_approvals (agent_id, created_at desc);
create index agent_approvals_status_idx on public.agent_approvals (status, created_at desc);
create index agent_approvals_decided_by_idx on public.agent_approvals (decided_by);

alter table public.agent_approvals enable row level security;
revoke all on public.agent_approvals from anon, authenticated;
grant select on public.agent_approvals to authenticated;
grant insert (agent_id, tool, args, summary), update (status) on public.agent_approvals to authenticated;
create policy "agent_approvals_select" on public.agent_approvals for select to authenticated
  using (exists (select 1 from public.agents a where a.id = agent_id and a.user_id = (select auth.uid())) or (select private.staff_can('staff.manage')));
create policy "agent_approvals_insert_own" on public.agent_approvals for insert to authenticated
  with check (status = 'pending' and exists (select 1 from public.agents a where a.id = agent_id and a.user_id = (select auth.uid()) and a.active));
-- The agent claims an approved action once, before it expires.
create policy "agent_approvals_use" on public.agent_approvals for update to authenticated
  using (status = 'approved' and expires_at > now() and exists (select 1 from public.agents a where a.id = agent_id and a.user_id = (select auth.uid())))
  with check (status = 'used');

-- ---------------------------------------------------------------------------
-- Permissions: agents use their own list.
-- ---------------------------------------------------------------------------
create function private.active_agent() returns public.agents
language sql stable security definer set search_path = '' as $$
  select * from public.agents where user_id = (select auth.uid()) and active and (expires_at is null or expires_at > now());
$$;
revoke execute on function private.active_agent() from public, anon, authenticated;

create or replace function private.mfa_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
      or coalesce((select (value ->> 'requireMfa')::boolean from public.platform_settings where key = 'admin_security'), true) = false
      or (private.active_agent()).id is not null;
$$;

create function private.my_permissions() returns text[]
language sql stable security definer set search_path = '' as $$
  select case
    when private.staff_role() is null then array[]::text[]
    when private.staff_role() = 'agent' then coalesce((private.active_agent()).permissions, array[]::text[])
    else private.role_permissions(private.staff_role())
  end;
$$;
revoke execute on function private.my_permissions() from public, anon;

create or replace function private.staff_can(permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(permission = any(private.my_permissions()), false);
$$;

create or replace function public.my_staff()
returns table (role public.staff_role, mfa_verified boolean, permissions text[])
language sql stable security definer set search_path = '' as $$
  select r, private.mfa_verified(), private.my_permissions()
  from (select private.staff_role_unverified() as r) s
  where r is not null;
$$;

-- Agents aren't people: keep them out of the staff and team lists (the
-- server's setStaffRole refuses to give or change the agent role).
create or replace function public.admin_list_staff()
returns table (user_id uuid, email text, full_name text, role public.staff_role, created_at timestamptz, mfa_enrolled boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('staff.manage') then raise exception 'Owners only' using errcode = '42501'; end if;
  return query
    select s.user_id, u.email::text, p.full_name, s.role, s.created_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = s.user_id and f.status = 'verified')
    from public.platform_staff s
    join auth.users u on u.id = s.user_id
    left join public.profiles p on p.id = s.user_id
    where s.role <> 'agent'
    order by s.role, s.created_at;
end $$;

create or replace function public.crm_staff()
returns table (user_id uuid, name text, email text, role public.staff_role, avatar_url text, job_title text, phone text, last_sign_in_at timestamptz, mfa boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('crm.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select s.user_id, coalesce(nullif(p.full_name, ''), u.email::text), u.email::text, s.role, p.avatar_url, p.job_title, p.phone, u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = s.user_id and f.status = 'verified')
    from public.platform_staff s
    join auth.users u on u.id = s.user_id
    left join public.profiles p on p.id = s.user_id
    where s.role <> 'agent'
    order by 2;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: create or change an agent. The agent's user is created first (by the
-- server, with the key as its password); this makes it an agent. Permissions
-- can't exceed the caller's own.
-- ---------------------------------------------------------------------------
create function public.admin_agent_save(p_id uuid, p_user uuid, p_settings jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  s jsonb := coalesce(p_settings, '{}');
  perms text[];
  v_id uuid := p_id;
  mail text;
begin
  if not private.staff_can('staff.manage') then raise exception 'Owners only' using errcode = '42501'; end if;
  if s ? 'permissions' then
    perms := array(select jsonb_array_elements_text(s -> 'permissions'));
    if not perms <@ private.my_permissions() then raise exception 'An agent can''t have permissions you don''t have.' using errcode = '42501'; end if;
  end if;

  if v_id is null then
    select email into mail from auth.users where id = p_user;
    if mail is null or mail !~ '^agent-[a-z0-9-]+@agents\.redial\.si$' then raise exception 'Not an agent account.' using errcode = '22023'; end if;
    insert into public.platform_staff (user_id, role, created_by) values (p_user, 'agent', me);
    insert into public.agents (user_id, name, created_by) values (p_user, coalesce(nullif(trim(s ->> 'name'), ''), 'Agent'), me)
    returning id into v_id;
  end if;

  update public.agents set
    name = coalesce(nullif(left(trim(s ->> 'name'), 80), ''), name),
    harness = coalesce(s ->> 'harness', harness),
    key_hint = case when s ? 'key_hint' then left(s ->> 'key_hint', 40) else key_hint end,
    key_rotated_at = case when s ? 'key_hint' then now() else key_rotated_at end,
    permissions = coalesce(perms, permissions),
    read_only = coalesce((s ->> 'read_only')::boolean, read_only),
    domains = case when s ? 'domains' then array(select jsonb_array_elements_text(s -> 'domains')) else domains end,
    approval_tools = case when s ? 'approval_tools' then array(select jsonb_array_elements_text(s -> 'approval_tools')) else approval_tools end,
    caps = case when s ? 'caps' then s -> 'caps' else caps end,
    ip_allowlist = case when s ? 'ip_allowlist' then array(select jsonb_array_elements_text(s -> 'ip_allowlist')) else ip_allowlist end,
    active = coalesce((s ->> 'active')::boolean, active),
    expires_at = case when s ? 'expires_at' then nullif(s ->> 'expires_at', '')::timestamptz else expires_at end,
    updated_at = now()
  where id = v_id;
  if not found then raise exception 'Agent not found.' using errcode = 'P0002'; end if;

  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values (me, case when p_id is null then 'agent.create' else 'agent.update' end, 'agent', v_id::text, s - 'key_hint');
  return v_id;
end $$;
revoke execute on function public.admin_agent_save(uuid, uuid, jsonb) from public, anon;
grant execute on function public.admin_agent_save(uuid, uuid, jsonb) to authenticated;

-- Pauses the agent and logs its removal; the server then deletes its user
-- (which removes the agent and its staff row). Returns that user.
create function public.admin_agent_remove(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if not private.staff_can('staff.manage') then raise exception 'Owners only' using errcode = '42501'; end if;
  update public.agents set active = false, updated_at = now() where id = p_id returning user_id into v_user;
  if v_user is null then raise exception 'Agent not found.' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), 'agent.remove', 'agent', p_id::text, jsonb_build_object('user_id', v_user));
  return v_user;
end $$;
revoke execute on function public.admin_agent_remove(uuid) from public, anon;
grant execute on function public.admin_agent_remove(uuid) to authenticated;

create function public.admin_agent_decide(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('staff.manage') then raise exception 'Owners only' using errcode = '42501'; end if;
  if private.staff_role() = 'agent' then raise exception 'Agents can''t approve actions.' using errcode = '42501'; end if;
  update public.agent_approvals set status = case when p_approve then 'approved' else 'declined' end,
    decided_by = (select auth.uid()), decided_at = now(),
    expires_at = case when p_approve then greatest(expires_at, now() + interval '1 hour') else expires_at end
  where id = p_id and status = 'pending' and expires_at > now();
  if not found then raise exception 'That request was already decided or has expired.' using errcode = 'P0001'; end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), case when p_approve then 'agent.approval.approve' else 'agent.approval.decline' end, 'agent_approval', p_id::text, '{}'::jsonb);
end $$;
revoke execute on function public.admin_agent_decide(uuid, boolean) from public, anon;
grant execute on function public.admin_agent_decide(uuid, boolean) to authenticated;

-- Calls in the last 24 hours and the last call, per agent.
create function public.admin_agent_activity()
returns table (agent_id uuid, calls_24h bigint, failed_24h bigint, last_call_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, count(l.*) filter (where l.created_at > now() - interval '24 hours'),
         count(l.*) filter (where l.created_at > now() - interval '24 hours' and not l.ok), max(l.created_at)
  from public.agents a left join public.mcp_audit_log l on l.user_id = a.user_id
  where private.staff_can('staff.manage')
  group by a.id;
$$;
revoke execute on function public.admin_agent_activity() from public, anon;
grant execute on function public.admin_agent_activity() to authenticated;

-- A new approval request: tell whoever created the agent.
create function private.agent_approval_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a public.agents;
begin
  select * into a from public.agents where id = new.agent_id;
  if a.created_by is not null then
    perform private.notify(a.created_by, 'agent_approval', left(a.name || ' needs your approval', 200),
      coalesce(new.summary, new.tool), '/admin/ai/agents', jsonb_build_object('approval_id', new.id, 'agent_id', a.id));
  end if;
  return new;
end $$;
create trigger agent_approvals_notify after insert on public.agent_approvals
  for each row execute function private.agent_approval_notify();
