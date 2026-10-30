-- Echo: Business (team) workspaces next to each user's private Personal one.
-- Business recordings are visible to every member; Personal stays one person.
-- Invites are email-bound links; recordings can move between the two.

-- ---------------------------------------------------------------------------
-- Workspaces: only the name is editable (never is_personal / created_by)
-- ---------------------------------------------------------------------------
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

create function private.is_team_workspace(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspaces w where w.id = ws and not w.is_personal);
$$;
revoke execute on function private.is_team_workspace(uuid) from public, anon;
grant execute on function private.is_team_workspace(uuid) to authenticated;

-- Creates a Business workspace with the caller as owner.
create function public.create_team_workspace(ws_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  ws uuid;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if char_length(trim(coalesce(ws_name, ''))) not between 1 and 120 then
    raise exception 'Workspace name must be 1-120 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.workspaces where created_by = uid and not is_personal) >= 10 then
    raise exception 'You can own up to 10 business workspaces' using errcode = '54000';
  end if;
  insert into public.workspaces (name, is_personal, created_by) values (trim(ws_name), false, uid) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  return ws;
end $$;
revoke execute on function public.create_team_workspace(text) from public, anon;
grant execute on function public.create_team_workspace(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Membership guards
-- ---------------------------------------------------------------------------
create function private.guard_workspace_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  personal boolean;
begin
  if tg_op = 'INSERT' then
    select is_personal into personal from public.workspaces where id = new.workspace_id;
    if personal and new.user_id is distinct from (select created_by from public.workspaces where id = new.workspace_id) then
      raise exception 'Personal workspaces can''t have other members' using errcode = '42501';
    end if;
    return new;
  end if;

  -- DELETE, or UPDATE that demotes an owner
  select is_personal into personal from public.workspaces where id = old.workspace_id;
  if personal is null then return coalesce(new, old); end if; -- workspace itself is being deleted
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then
    return old; -- the account is being deleted
  end if;
  if tg_op = 'DELETE' and personal then
    raise exception 'You can''t leave your Personal workspace' using errcode = '42501';
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from public.workspace_members m
                     where m.workspace_id = old.workspace_id and m.role = 'owner' and m.user_id <> old.user_id) then
    raise exception 'A business workspace needs at least one owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function private.guard_workspace_members() from public, anon, authenticated;

create trigger workspace_members_guard
  before insert or update or delete on public.workspace_members
  for each row execute function private.guard_workspace_members();

-- Members can read teammates' emails (profiles has no email column).
create function public.list_workspace_members(ws uuid)
returns table (user_id uuid, email text, full_name text, role public.workspace_role, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, p.full_name, m.role, m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = ws and private.is_member(ws)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;
revoke execute on function public.list_workspace_members(uuid) from public, anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320),
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);
-- one open invite per email per workspace
create unique index workspace_invites_open_idx on public.workspace_invites (workspace_id, email) where accepted_at is null;
create index workspace_invites_invited_by_idx on public.workspace_invites (invited_by);
create index workspace_invites_accepted_by_idx on public.workspace_invites (accepted_by);

revoke all on public.workspace_invites from anon, authenticated;
grant select, insert, delete on public.workspace_invites to authenticated;
alter table public.workspace_invites enable row level security;

-- owners/admins of a Business workspace manage its invites
create policy "invites_select" on public.workspace_invites for select to authenticated
  using (private.has_role(workspace_id, '{owner,admin}'));
create policy "invites_insert" on public.workspace_invites for insert to authenticated
  with check (
    private.has_role(workspace_id, '{owner,admin}')
    and private.is_team_workspace(workspace_id)
    and invited_by = (select auth.uid())
  );
create policy "invites_delete" on public.workspace_invites for delete to authenticated
  using (private.has_role(workspace_id, '{owner,admin}'));

-- What the invite page shows. Holding the token is enough to see this.
create function public.get_workspace_invite(invite_token uuid)
returns table (workspace_name text, email text, role public.workspace_role, invited_by_email text, expires_at timestamptz, accepted boolean)
language sql stable security definer set search_path = '' as $$
  select w.name, i.email, i.role, u.email::text, i.expires_at, i.accepted_at is not null
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  left join auth.users u on u.id = i.invited_by
  where i.token = invite_token and (select auth.uid()) is not null;
$$;
revoke execute on function public.get_workspace_invite(uuid) from public, anon;
grant execute on function public.get_workspace_invite(uuid) to authenticated;

-- Joins the workspace when the signed-in email matches the invite.
create function public.accept_workspace_invite(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  mail text := lower((select auth.jwt()) ->> 'email');
  inv public.workspace_invites;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select * into inv from public.workspace_invites where token = invite_token for update;
  if not found or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'This invite has expired or was already used' using errcode = 'P0002';
  end if;
  if inv.email is distinct from mail then
    raise exception 'This invite is for a different email address' using errcode = '42501';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set accepted_at = now(), accepted_by = uid where id = inv.id;
  return inv.workspace_id;
end $$;
revoke execute on function public.accept_workspace_invite(uuid) from public, anon;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Recordings: moving between workspaces, and a fixed creator
-- ---------------------------------------------------------------------------
create function private.guard_recording_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if; -- SQL editor / service tasks
  if new.created_by is distinct from old.created_by then
    raise exception 'The creator of a recording can''t be changed' using errcode = '42501';
  end if;
  if new.workspace_id is distinct from old.workspace_id then
    if not (old.created_by = uid or private.has_role(old.workspace_id, '{owner,admin}')) then
      raise exception 'Only the person who made this recording, or a workspace admin, can move it' using errcode = '42501';
    end if;
    if not private.is_member(new.workspace_id) then
      raise exception 'You''re not a member of that workspace' using errcode = '42501';
    end if;
    new.folder_id := null; -- folders belong to one workspace
  end if;
  return new;
end $$;
revoke execute on function private.guard_recording_update() from public, anon, authenticated;

create trigger recordings_guard before update on public.recordings
  for each row execute function private.guard_recording_update();
