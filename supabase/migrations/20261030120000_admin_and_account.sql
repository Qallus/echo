-- Echo: account types and platform super admins.
-- Account types: Personal (everyone's private space), Business (chosen at
-- sign-up: also creates the company's workspace), Team (invited into a
-- Business), Super Admin (app-wide, below).

-- ---------------------------------------------------------------------------
-- Sign-up: a Business sign-up also gets its company workspace, as owner.
-- Reads account_type / company_name from the sign-up metadata.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  company text := left(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), 120);
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');

  insert into public.workspaces (name, is_personal, created_by)
  values ('Personal workspace', true, new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, new.id, 'owner');

  if new.raw_user_meta_data ->> 'account_type' = 'business' and company <> '' then
    insert into public.workspaces (name, is_personal, created_by)
    values (company, false, new.id)
    returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws, new.id, 'owner');
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Super admins: app-wide, separate from workspace owner/admin/member.
-- Rows are added in the SQL editor only (no client write grants).
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
alter table public.platform_admins enable row level security;
create policy "platform_admins_select_self" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
revoke execute on function private.is_super_admin() from public, anon;
grant execute on function private.is_super_admin() to authenticated;

create function public.am_i_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_super_admin();
$$;
revoke execute on function public.am_i_super_admin() from public, anon;
grant execute on function public.am_i_super_admin() to authenticated;

-- Every user with their footprint. Super admins only.
create function public.admin_list_users()
returns table (
  user_id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
  confirmed boolean, account_type text, workspaces bigint, recordings bigint, super_admin boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Super admins only' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, p.full_name, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
           case
             when exists (select 1 from public.platform_admins a where a.user_id = u.id) then 'super_admin'
             when exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
                          where m.user_id = u.id and not w.is_personal and m.role = 'owner') then 'business'
             when exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
                          where m.user_id = u.id and not w.is_personal) then 'team'
             else 'personal'
           end,
           (select count(*) from public.workspace_members m where m.user_id = u.id),
           (select count(*) from public.recordings r where r.created_by = u.id),
           exists (select 1 from public.platform_admins a where a.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Every workspace with its size. Super admins only.
create function public.admin_list_workspaces()
returns table (
  workspace_id uuid, name text, is_personal boolean, owner_email text, members bigint, recordings bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Super admins only' using errcode = '42501'; end if;
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
revoke execute on function public.admin_list_workspaces() from public, anon;
grant execute on function public.admin_list_workspaces() to authenticated;
