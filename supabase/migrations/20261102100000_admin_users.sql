-- Echo Super Admin S2: suspend/restore users, sign out everywhere, Customer 360,
-- workspace detail and ownership transfer. Every action checks a staff
-- permission (MFA-verified, see 20261102090000_admin_staff.sql) and writes
-- the admin audit log.

-- ---------------------------------------------------------------------------
-- Suspension
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column suspended_at timestamptz,
  add column suspended_reason text check (char_length(suspended_reason) <= 500);
-- Not in the profiles column grants: teammates can't see it. The user learns
-- through am_i_suspended(); staff through the admin functions.

create function private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.suspended_at is not null
  );
$$;
revoke execute on function private.is_active_user() from public, anon;
grant execute on function private.is_active_user() to authenticated;

-- Workspace access helpers: a suspended user loses access to every workspace
-- (and so every recording, transcript and summary) immediately.
create or replace function private.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_role(ws uuid, roles public.workspace_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$$;

create or replace function private.can_access_recording(rec uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.recordings r
    join public.workspace_members m on m.workspace_id = r.workspace_id
    where r.id = rec and m.user_id = (select auth.uid())
  );
$$;

create function public.am_i_suspended() returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.is_active_user();
$$;
revoke execute on function public.am_i_suspended() from public, anon;
grant execute on function public.am_i_suspended() to authenticated;

-- Ends every session (refresh tokens go with them); access tokens already
-- issued expire within the hour, and RLS blocks a suspended user meanwhile.
create function private.revoke_sessions(target uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = target;
$$;
revoke execute on function private.revoke_sessions(uuid) from public, anon, authenticated;

create function public.admin_suspend_user(p_user uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) then raise exception 'You can''t suspend yourself.' using errcode = '42501'; end if;
  if exists (select 1 from public.platform_staff s where s.user_id = p_user) then
    raise exception 'Remove this person from staff before suspending them.' using errcode = '42501';
  end if;
  update public.profiles set suspended_at = now(), suspended_reason = nullif(trim(p_reason), '') where id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  perform private.revoke_sessions(p_user);
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), 'user.suspend', 'user', p_user::text, jsonb_build_object('reason', nullif(trim(p_reason), '')));
end $$;

create function public.admin_restore_user(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  update public.profiles set suspended_at = null, suspended_reason = null where id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id)
  values ((select auth.uid()), 'user.restore', 'user', p_user::text);
end $$;

create function public.admin_sign_out_user(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  perform private.revoke_sessions(p_user);
  insert into public.admin_audit_log (actor, action, target_type, target_id)
  values ((select auth.uid()), 'user.sign_out_everywhere', 'user', p_user::text);
end $$;

revoke execute on function public.admin_suspend_user(uuid, text), public.admin_restore_user(uuid), public.admin_sign_out_user(uuid) from public, anon;
grant execute on function public.admin_suspend_user(uuid, text), public.admin_restore_user(uuid), public.admin_sign_out_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Users list: now with suspension and plan (return type changes, so recreate)
-- ---------------------------------------------------------------------------
drop function public.admin_list_users();
create function public.admin_list_users()
returns table (
  user_id uuid, email text, full_name text, avatar_url text, created_at timestamptz, last_sign_in_at timestamptz,
  confirmed boolean, account_type text, workspaces bigint, recordings bigint, staff_role public.staff_role,
  suspended boolean, subscription_status text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('users.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, p.full_name, p.avatar_url, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
           case
             when exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
                          where m.user_id = u.id and not w.is_personal and m.role = 'owner') then 'business'
             when exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
                          where m.user_id = u.id and not w.is_personal) then 'team'
             else 'personal'
           end,
           (select count(*) from public.workspace_members m where m.user_id = u.id),
           (select count(*) from public.recordings r where r.created_by = u.id and r.deleted_at is null),
           (select s.role from public.platform_staff s where s.user_id = u.id),
           p.suspended_at is not null,
           (select s.status from public.subscriptions s where s.user_id = u.id
            order by (s.status in ('active', 'trialing', 'past_due')) desc, s.current_period_end desc nulls last limit 1)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Customer 360: one user's account, workspaces, usage, billing and audit trail.
-- Recording titles and counts only, never transcript content.
-- ---------------------------------------------------------------------------
create function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now());
  result jsonb;
begin
  if not private.staff_can('users.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'confirmed', u.email_confirmed_at is not null, 'banned_until', u.banned_until,
    'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
    'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
    'sessions', (select count(*) from auth.sessions s where s.user_id = u.id),
    'profile', jsonb_build_object(
      'full_name', p.full_name, 'avatar_url', p.avatar_url, 'job_title', p.job_title, 'company', p.company,
      'phone', p.phone, 'timezone', p.timezone, 'location', p.location,
      'suspended_at', p.suspended_at, 'suspended_reason', p.suspended_reason),
    'staff_role', (select s.role from public.platform_staff s where s.user_id = u.id),
    'workspaces', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', w.id, 'name', w.name, 'is_personal', w.is_personal, 'role', m.role,
        'members', (select count(*) from public.workspace_members x where x.workspace_id = w.id),
        'recordings', (select count(*) from public.recordings r where r.workspace_id = w.id and r.deleted_at is null)
      ) order by w.is_personal desc, w.created_at), '[]'::jsonb)
      from public.workspace_members m join public.workspaces w on w.id = m.workspace_id where m.user_id = u.id),
    'usage', jsonb_build_object(
      'recordings', (select count(*) from public.recordings r where r.created_by = u.id and r.deleted_at is null),
      'minutes', (select coalesce(round(sum(r.duration_sec) / 60.0), 0) from public.recordings r where r.created_by = u.id),
      'minutes_month', (select coalesce(round(sum(r.duration_sec) / 60.0), 0) from public.recordings r where r.created_by = u.id and r.created_at >= month_start),
      'mcp_calls_30d', (select count(*) from public.mcp_audit_log a where a.user_id = u.id and a.created_at > now() - interval '30 days')),
    'recent_recordings', (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select r.id, r.title, r.source, r.status, r.duration_sec, r.created_at
        from public.recordings r where r.created_by = u.id and r.deleted_at is null
        order by r.created_at desc limit 10) x),
    'channels', case when private.staff_can('notifications.view') then (
      select coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'address', c.address, 'verified', c.verified_at is not null)), '[]'::jsonb)
      from public.notification_channels c where c.user_id = u.id) end,
    'subscriptions', case when private.staff_can('billing.view') then (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'items', s.items,
        'current_period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end)), '[]'::jsonb)
      from public.subscriptions s where s.user_id = u.id) end,
    'orders', case when private.staff_can('billing.view') then (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select o.id, o.number, o.status, o.total, o.currency, o.created_at
        from public.orders o where o.user_id = u.id order by o.created_at desc limit 10) x) end,
    'audit', case when private.staff_can('audit.view') then (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select l.action, l.detail, l.created_at, a.email::text as actor
        from public.admin_audit_log l left join auth.users a on a.id = l.actor
        where l.target_type = 'user' and l.target_id = u.id::text
        order by l.created_at desc limit 20) x) end
  ) into result
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = p_user;
  return result;
end $$;
revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace detail and ownership transfer
-- ---------------------------------------------------------------------------
create function public.admin_workspace_detail(p_workspace uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now());
  result jsonb;
begin
  if not private.staff_can('workspaces.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'id', w.id, 'name', w.name, 'is_personal', w.is_personal, 'created_at', w.created_at,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'email', u.email, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
        'role', m.role, 'joined_at', m.created_at, 'suspended', p.suspended_at is not null
      ) order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at), '[]'::jsonb)
      from public.workspace_members m join auth.users u on u.id = m.user_id
      left join public.profiles p on p.id = m.user_id where m.workspace_id = w.id),
    'usage', jsonb_build_object(
      'recordings', (select count(*) from public.recordings r where r.workspace_id = w.id and r.deleted_at is null),
      'minutes', (select coalesce(round(sum(r.duration_sec) / 60.0), 0) from public.recordings r where r.workspace_id = w.id),
      'minutes_month', (select coalesce(round(sum(r.duration_sec) / 60.0), 0) from public.recordings r where r.workspace_id = w.id and r.created_at >= month_start),
      'folders', (select count(*) from public.folders f where f.workspace_id = w.id)),
    'audit', case when private.staff_can('audit.view') then (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select l.action, l.detail, l.created_at, a.email::text as actor
        from public.admin_audit_log l left join auth.users a on a.id = l.actor
        where l.target_type = 'workspace' and l.target_id = w.id::text
        order by l.created_at desc limit 20) x) end
  ) into result
  from public.workspaces w where w.id = p_workspace;
  return result;
end $$;
revoke execute on function public.admin_workspace_detail(uuid) from public, anon;
grant execute on function public.admin_workspace_detail(uuid) to authenticated;

-- Makes a member the owner of a Business workspace; previous owners become admins.
create function public.admin_transfer_workspace(p_workspace uuid, p_new_owner uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  previous uuid[];
begin
  if not private.staff_can('workspaces.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  if exists (select 1 from public.workspaces w where w.id = p_workspace and w.is_personal) then
    raise exception 'Personal workspaces can''t change owner.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_new_owner) then
    raise exception 'The new owner must already be a member of this workspace.' using errcode = 'P0002';
  end if;
  select array_agg(m.user_id) into previous from public.workspace_members m
  where m.workspace_id = p_workspace and m.role = 'owner' and m.user_id <> p_new_owner;
  -- Promote first: the members guard won't demote the last owner.
  update public.workspace_members set role = 'owner' where workspace_id = p_workspace and user_id = p_new_owner;
  update public.workspace_members set role = 'admin'
  where workspace_id = p_workspace and role = 'owner' and user_id <> p_new_owner;
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), 'workspace.transfer_owner', 'workspace', p_workspace::text,
          jsonb_build_object('new_owner', p_new_owner, 'previous_owners', previous));
end $$;
revoke execute on function public.admin_transfer_workspace(uuid, uuid) from public, anon;
grant execute on function public.admin_transfer_workspace(uuid, uuid) to authenticated;
