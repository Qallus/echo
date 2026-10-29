-- Echo: initial schema
-- Workspaces + members, folders, recordings and their AI output, storage bucket.
-- Access model: a user sees a row when they are a member of its workspace.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.recording_source as enum ('phone_call', 'meeting', 'upload', 'desktop');
create type public.recording_status as enum ('none', 'processing', 'generated', 'failed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  is_personal boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, workspace_id) -- target for the composite FK below
);
create index folders_workspace_id_idx on public.folders (workspace_id);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  folder_id uuid,
  title text not null default 'Untitled recording' check (char_length(title) between 1 and 300),
  source public.recording_source not null default 'upload',
  status public.recording_status not null default 'none',
  duration_sec integer not null default 0 check (duration_sec >= 0),
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- a recording can only be filed in a folder of its own workspace
  foreign key (folder_id, workspace_id) references public.folders (id, workspace_id) on delete set null (folder_id)
);
create index recordings_workspace_created_idx on public.recordings (workspace_id, created_at desc);
create index recordings_folder_id_idx on public.recordings (folder_id) where folder_id is not null;
create index recordings_created_by_idx on public.recordings (created_by);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  position integer not null,
  speaker text not null default 'Speaker',
  start_sec integer not null default 0 check (start_sec >= 0),
  text text not null,
  unique (recording_id, position)
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  start_sec integer not null default 0 check (start_sec >= 0),
  text text not null,
  created_at timestamptz not null default now()
);
create index highlights_recording_id_idx on public.highlights (recording_id);

-- One current summary per recording.
create table public.summaries (
  recording_id uuid primary key references public.recordings (id) on delete cascade,
  template text not null default 'Adaptive summary',
  model text,
  overview text not null default '',
  key_points jsonb not null default '[]'::jsonb,
  mind_map jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  position integer not null default 0,
  owner_name text,
  owner_role text,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index action_items_recording_id_idx on public.action_items (recording_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger recordings_updated_at before update on public.recordings
  for each row execute function public.set_updated_at();
create trigger summaries_updated_at before update on public.summaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (private schema: not exposed through the Data API)
-- SECURITY DEFINER so policies can check membership without recursing into
-- workspace_members' own RLS. Each one is scoped to auth.uid().
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create function private.has_role(ws uuid, roles public.workspace_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$$;

create function private.can_access_recording(rec uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recordings r
    join public.workspace_members m on m.workspace_id = r.workspace_id
    where r.id = rec and m.user_id = (select auth.uid())
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.workspace_role[]) to authenticated;
grant execute on function private.can_access_recording(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- New user: profile + personal workspace (owner)
-- ---------------------------------------------------------------------------
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');

  insert into public.workspaces (name, is_personal, created_by)
  values ('Personal workspace', true, new.id)
  returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, new.id, 'owner');

  return new;
end $$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grants (Data API exposure) + RLS
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on
  public.profiles, public.workspaces, public.workspace_members, public.folders,
  public.recordings, public.transcript_segments, public.highlights,
  public.summaries, public.action_items
to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.folders enable row level security;
alter table public.recordings enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.highlights enable row level security;
alter table public.summaries enable row level security;
alter table public.action_items enable row level security;

-- profiles: see yourself and people you share a workspace with; edit yourself
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members theirs
      where theirs.user_id = profiles.id and private.is_member(theirs.workspace_id)
    )
  );
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces: members read; owners/admins rename. Creation happens via the
-- signup trigger (team workspaces get a dedicated function later).
create policy "workspaces_select" on public.workspaces for select to authenticated
  using (private.is_member(id));
create policy "workspaces_update" on public.workspaces for update to authenticated
  using (private.has_role(id, '{owner,admin}')) with check (private.has_role(id, '{owner,admin}'));

-- members: members see the roster; only owners manage it
create policy "members_select" on public.workspace_members for select to authenticated
  using (private.is_member(workspace_id));
create policy "members_insert" on public.workspace_members for insert to authenticated
  with check (private.has_role(workspace_id, '{owner}'));
create policy "members_update" on public.workspace_members for update to authenticated
  using (private.has_role(workspace_id, '{owner}')) with check (private.has_role(workspace_id, '{owner}'));
create policy "members_delete" on public.workspace_members for delete to authenticated
  using (private.has_role(workspace_id, '{owner}') or user_id = (select auth.uid()));

-- folders: any member
create policy "folders_all" on public.folders for all to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));

-- recordings: members read/create/edit; creator or owner/admin hard-deletes
create policy "recordings_select" on public.recordings for select to authenticated
  using (private.is_member(workspace_id));
create policy "recordings_insert" on public.recordings for insert to authenticated
  with check (private.is_member(workspace_id) and created_by = (select auth.uid()));
create policy "recordings_update" on public.recordings for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "recordings_delete" on public.recordings for delete to authenticated
  using (created_by = (select auth.uid()) or private.has_role(workspace_id, '{owner,admin}'));

-- AI output: follows the parent recording
create policy "segments_all" on public.transcript_segments for all to authenticated
  using (private.can_access_recording(recording_id)) with check (private.can_access_recording(recording_id));
create policy "highlights_all" on public.highlights for all to authenticated
  using (private.can_access_recording(recording_id)) with check (private.can_access_recording(recording_id));
create policy "summaries_all" on public.summaries for all to authenticated
  using (private.can_access_recording(recording_id)) with check (private.can_access_recording(recording_id));
create policy "action_items_all" on public.action_items for all to authenticated
  using (private.can_access_recording(recording_id)) with check (private.can_access_recording(recording_id));

-- ---------------------------------------------------------------------------
-- Storage: private audio bucket. Path: <workspace_id>/<recording_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 524288000, array['audio/*', 'video/webm', 'video/mp4'])
on conflict (id) do nothing;

create function private.can_access_object(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_member(split_part(object_name, '/', 1)::uuid)
    else false
  end;
$$;
revoke execute on function private.can_access_object(text) from public, anon;
grant execute on function private.can_access_object(text) to authenticated;

create policy "recordings_bucket_select" on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and private.can_access_object(name));
create policy "recordings_bucket_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and private.can_access_object(name));
create policy "recordings_bucket_update" on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and private.can_access_object(name))
  with check (bucket_id = 'recordings' and private.can_access_object(name));
create policy "recordings_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and private.can_access_object(name));
