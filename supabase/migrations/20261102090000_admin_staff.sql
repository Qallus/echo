-- Echo: Super Admin staff roles, permissions, MFA and the admin audit log.
--
-- Staff (owner, admin, support, finance, marketing, analyst) replace the
-- single platform_admins list. Every staff power requires a session verified
-- with two-step sign-in (JWT aal = aal2), checked here in the database, so a
-- stolen password alone can't reach admin data. Permissions are mirrored in
-- src/lib/admin/permissions.ts.

create type public.staff_role as enum ('owner', 'admin', 'support', 'finance', 'marketing', 'analyst');

create table public.platform_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index platform_staff_created_by_idx on public.platform_staff (created_by);

-- Existing super admins become owners.
insert into public.platform_staff (user_id, role)
select user_id, 'owner' from public.platform_admins
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Role and permission checks
-- ---------------------------------------------------------------------------

-- The caller's staff role, whether or not this session passed two-step sign-in.
-- Only used to show the Admin link and route to MFA; never to grant access.
create function private.staff_role_unverified() returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select role from public.platform_staff where user_id = (select auth.uid());
$$;

create function private.mfa_verified() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- The caller's role, only when the session is MFA-verified.
create function private.staff_role() returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select case when private.mfa_verified() then private.staff_role_unverified() end;
$$;

create function private.role_permissions(r public.staff_role) returns text[]
language sql immutable set search_path = '' as $$
  select case r
    when 'owner' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'staff.manage', 'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view']
    when 'admin' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view']
    when 'support' then array[
      'dashboard.view', 'users.view', 'users.manage', 'workspaces.view', 'notifications.view', 'crm.view', 'crm.manage']
    when 'finance' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'billing.manage', 'crm.view']
    when 'marketing' then array[
      'dashboard.view', 'analytics.view', 'crm.view', 'crm.manage', 'content.manage']
    when 'analyst' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'ai.view']
    else array[]::text[]
  end;
$$;

create function private.staff_can(permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(permission = any(private.role_permissions(private.staff_role())), false);
$$;

-- Owners and admins (MFA-verified). Existing policies on platform_settings,
-- billing tables and the delivery log use this, so they now require MFA too.
create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.staff_role() in ('owner', 'admin'), false);
$$;

revoke execute on function private.staff_role_unverified(), private.mfa_verified(), private.staff_role(),
  private.role_permissions(public.staff_role), private.staff_can(text) from public, anon;
grant execute on function private.staff_role_unverified(), private.mfa_verified(), private.staff_role(),
  private.role_permissions(public.staff_role), private.staff_can(text) to authenticated;

-- For the app: the caller's role, whether this session is verified, and what
-- they can do (empty until verified).
create function public.my_staff()
returns table (role public.staff_role, mfa_verified boolean, permissions text[])
language sql stable security definer set search_path = '' as $$
  select r, private.mfa_verified(),
         case when private.mfa_verified() then private.role_permissions(r) else array[]::text[] end
  from (select private.staff_role_unverified() as r) s
  where r is not null;
$$;
revoke execute on function public.my_staff() from public, anon;
grant execute on function public.my_staff() to authenticated;

-- The Admin link shows for any staff member (MFA happens on the admin side).
create or replace function public.am_i_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.staff_role_unverified() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Staff table access
-- ---------------------------------------------------------------------------
revoke all on public.platform_staff from anon, authenticated;
grant select on public.platform_staff to authenticated;
alter table public.platform_staff enable row level security;
create policy "staff_select" on public.platform_staff for select to authenticated
  using (user_id = (select auth.uid()) or private.staff_can('staff.manage'));
-- Writes only through admin_set_staff_role (owners).

-- ---------------------------------------------------------------------------
-- Admin audit log: every Super Admin action
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor uuid default auth.uid() references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  target_type text check (char_length(target_type) <= 40),
  target_id text check (char_length(target_id) <= 100),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 16384),
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor);
create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);

revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
alter table public.admin_audit_log enable row level security;
create policy "admin_audit_select" on public.admin_audit_log for select to authenticated
  using (private.staff_can('audit.view'));
-- No insert/update/delete grants: rows come only from admin_audit() and
-- can't be edited afterwards.

create function public.admin_audit(p_action text, p_target_type text default null, p_target_id text default null, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.staff_role() is null then raise exception 'Staff only' using errcode = '42501'; end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_detail, '{}'::jsonb));
end $$;
revoke execute on function public.admin_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.admin_audit(text, text, text, jsonb) to authenticated;

-- The log with each actor's email, newest first.
create function public.admin_audit_feed(max_rows int default 200)
returns table (id bigint, actor_email text, action text, target_type text, target_id text, detail jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('audit.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select l.id, u.email::text, l.action, l.target_type, l.target_id, l.detail, l.created_at
    from public.admin_audit_log l left join auth.users u on u.id = l.actor
    order by l.created_at desc
    limit least(greatest(max_rows, 1), 1000);
end $$;
revoke execute on function public.admin_audit_feed(int) from public, anon;
grant execute on function public.admin_audit_feed(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff management (owners). Adds, changes or removes a staff member by email.
-- ---------------------------------------------------------------------------
create function public.admin_set_staff_role(p_email text, p_role public.staff_role)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  old public.staff_role;
begin
  if not private.staff_can('staff.manage') then raise exception 'Owners only' using errcode = '42501'; end if;
  select u.id into target from auth.users u where lower(u.email) = lower(trim(p_email));
  if target is null then raise exception 'No Echo account uses that email. Ask them to sign up first.' using errcode = 'P0002'; end if;
  select role into old from public.platform_staff where user_id = target;
  if target = (select auth.uid()) and p_role is distinct from 'owner' then
    raise exception 'You can''t change your own role.' using errcode = '42501';
  end if;

  if p_role is null then
    delete from public.platform_staff where user_id = target;
    delete from public.platform_admins where user_id = target;
  else
    insert into public.platform_staff (user_id, role) values (target, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;

  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), case when p_role is null then 'staff.remove' else 'staff.set_role' end, 'user', target::text,
          jsonb_build_object('email', lower(trim(p_email)), 'from', old, 'to', p_role));
  return target;
end $$;
revoke execute on function public.admin_set_staff_role(text, public.staff_role) from public, anon;
grant execute on function public.admin_set_staff_role(text, public.staff_role) to authenticated;

create function public.admin_list_staff()
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
    order by s.role, s.created_at;
end $$;
revoke execute on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Existing lists now follow staff permissions (same signatures).
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  user_id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
  confirmed boolean, account_type text, workspaces bigint, recordings bigint, super_admin boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('users.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, p.full_name, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
           case
             when exists (select 1 from public.platform_staff s where s.user_id = u.id) then 'super_admin'
             when exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
                          where m.user_id = u.id and not w.is_personal and m.role = 'owner') then 'business'
             when exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
                          where m.user_id = u.id and not w.is_personal) then 'team'
             else 'personal'
           end,
           (select count(*) from public.workspace_members m where m.user_id = u.id),
           (select count(*) from public.recordings r where r.created_by = u.id),
           exists (select 1 from public.platform_staff s where s.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $$;

create or replace function public.admin_list_workspaces()
returns table (
  workspace_id uuid, name text, is_personal boolean, owner_email text, members bigint, recordings bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('workspaces.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select w.id, w.name, w.is_personal,
           (select u.email::text from public.workspace_members m join auth.users u on u.id = m.user_id
            where m.workspace_id = w.id and m.role = 'owner' order by m.created_at limit 1),
           (select count(*) from public.workspace_members m where m.workspace_id = w.id),
           (select count(*) from public.recordings r where r.workspace_id = w.id),
           w.created_at
    from public.workspaces w
    order by w.created_at desc;
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------

-- Headline numbers. Subscriptions come back raw (MRR is priced from the
-- catalog in the app) and only for staff who can see billing.
create function public.admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now());
begin
  if not private.staff_can('dashboard.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
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
    ) end
  );
end $$;
revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- "Needs attention": recent failures, newest first.
create function public.admin_attention()
returns table (kind text, title text, detail text, at timestamptz, target_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('dashboard.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    (select 'transcription'::text, r.title, r.processing_error, r.updated_at, r.id::text
     from public.recordings r where r.status = 'failed' and r.updated_at > now() - interval '7 days'
     order by r.updated_at desc limit 10)
    union all
    (select 'delivery'::text, d.channel || ' delivery failed', d.detail, d.created_at, d.notification_id::text
     from public.notification_deliveries d where d.status = 'failed' and d.created_at > now() - interval '7 days'
     order by d.created_at desc limit 10)
    union all
    (select 'payment'::text, 'Subscription past due', u.email::text, s.current_period_end, s.id
     from public.subscriptions s join auth.users u on u.id = s.user_id
     where s.status = 'past_due' and private.staff_can('billing.view')
     limit 10)
    order by 4 desc;
end $$;
revoke execute on function public.admin_attention() from public, anon;
grant execute on function public.admin_attention() to authenticated;

-- MCP connector usage over the last N days (by tool and by user).
create function public.admin_mcp_usage(days int default 30)
returns table (tool text, user_email text, calls bigint, errors bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('ai.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select a.tool, u.email::text, count(*), count(*) filter (where not a.ok), max(a.created_at)
    from public.mcp_audit_log a left join auth.users u on u.id = a.user_id
    where a.created_at > now() - make_interval(days => least(greatest(days, 1), 365))
    group by a.tool, u.email
    order by 3 desc;
end $$;
revoke execute on function public.admin_mcp_usage(int) from public, anon;
grant execute on function public.admin_mcp_usage(int) to authenticated;

-- Support staff can read the notification delivery log too.
create policy "deliveries_select_staff" on public.notification_deliveries for select to authenticated
  using (private.staff_can('notifications.view'));
