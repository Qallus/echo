-- Share a recording: public links (anyone with the link) and people (named
-- emails who sign in). Neither adds a policy to the recording tables, so
-- library lists, search and the MCP tools are unchanged; shared content is
-- read only through the security-definer functions below, which return just
-- the parts that were shared.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.recording_links (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  token_hash text not null unique, -- sha256 of the token in the URL; the token itself is never stored
  show_summary boolean not null default true,
  show_transcript boolean not null default true,
  show_highlights boolean not null default true,
  show_audio boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  check (show_summary or show_transcript or show_highlights or show_audio)
);
create index recording_links_recording_id_idx on public.recording_links (recording_id);
create index recording_links_created_by_idx on public.recording_links (created_by);

create table public.recording_shares (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320 and email like '_%@_%'),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
-- One live share per person per recording (a removed one can be re-added).
create unique index recording_shares_live_idx on public.recording_shares (recording_id, email) where removed_at is null;
create index recording_shares_email_idx on public.recording_shares (email) where removed_at is null;
create index recording_shares_invited_by_idx on public.recording_shares (invited_by);

-- Audio checks look recordings up by file path.
create index recordings_storage_path_idx on public.recordings (storage_path) where storage_path is not null;

-- ---------------------------------------------------------------------------
-- Access: read-only for the API; every write goes through the functions below.
-- ---------------------------------------------------------------------------
revoke all on public.recording_links, public.recording_shares from anon, authenticated;
grant select (id, recording_id, show_summary, show_transcript, show_highlights, show_audio, expires_at, revoked_at, created_by, created_at, view_count, last_viewed_at)
  on public.recording_links to authenticated;
grant select on public.recording_shares to authenticated;
alter table public.recording_links enable row level security;
alter table public.recording_shares enable row level security;

-- Anyone who can open the recording sees its links and the people it's shared with.
create policy "recording_links_select" on public.recording_links for select to authenticated
  using (private.can_access_recording(recording_id));
create policy "recording_shares_select" on public.recording_shares for select to authenticated
  using (private.can_access_recording(recording_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- The signed-in user's email, only once confirmed (a share is matched by it).
create function private.my_confirmed_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;
revoke execute on function private.my_confirmed_email() from public, anon;

-- The shared parts of one recording as JSON. Called only by the functions
-- below after they've checked the link or share; not executable by API roles.
create function private.recording_bundle(rec uuid, p_summary boolean, p_transcript boolean, p_highlights boolean, p_audio boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'title', r.title, 'created_at', r.created_at, 'duration_sec', r.duration_sec, 'source', r.source,
    'speakers', r.speakers,
    'owner', (select p.full_name from public.profiles p where p.id = r.created_by),
    'audio_path', case when p_audio then r.storage_path end,
    'summary', case when p_summary then (
      select jsonb_build_object('title', s.title, 'overview', s.overview, 'key_points', s.key_points, 'sections', s.sections)
      from public.summaries s where s.recording_id = r.id) end,
    'action_items', case when p_summary then coalesce((
      select jsonb_agg(jsonb_build_object('owner', a.owner_name, 'text', a.text, 'done', a.done) order by a.position)
      from public.action_items a where a.recording_id = r.id), '[]'::jsonb) end,
    'highlights', case when p_highlights then coalesce((
      select jsonb_agg(jsonb_build_object('start_sec', h.start_sec, 'text', h.text, 'kind', h.kind, 'title', h.title) order by h.start_sec)
      from public.highlights h where h.recording_id = r.id), '[]'::jsonb) end,
    'segments', case when p_transcript then coalesce((
      select jsonb_agg(jsonb_build_object('speaker', g.speaker, 'start_sec', g.start_sec, 'text', g.text) order by g.position)
      from public.transcript_segments g where g.recording_id = r.id), '[]'::jsonb) end,
    'parts', jsonb_build_object('summary', p_summary, 'transcript', p_transcript, 'highlights', p_highlights, 'audio', p_audio)
  )
  from public.recordings r
  where r.id = rec and r.deleted_at is null
    -- A suspended account's recordings stop being shared.
    and not exists (select 1 from public.profiles p where p.id = r.created_by and p.suspended_at is not null);
$$;
revoke execute on function private.recording_bundle(uuid, boolean, boolean, boolean, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public links
-- ---------------------------------------------------------------------------
-- Creates a link and returns its token once (the URL is /s/<token>).
create function public.create_recording_link(rec uuid, p_summary boolean, p_transcript boolean, p_highlights boolean, p_audio boolean, p_expires_days integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  token text;
  link_id uuid;
begin
  if (select auth.uid()) is null or not private.is_active_user() or not private.can_access_recording(rec) then
    raise exception 'You can''t share this recording.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.recordings where id = rec and deleted_at is null) then
    raise exception 'This recording is in the trash.';
  end if;
  if not (p_summary or p_transcript or p_highlights or p_audio) then
    raise exception 'Choose at least one thing to share.';
  end if;
  if p_expires_days is not null and p_expires_days not between 1 and 365 then
    raise exception 'Links can expire after 1 to 365 days.';
  end if;
  if (select count(*) from public.recording_links where recording_id = rec and revoked_at is null) >= 50 then
    raise exception 'This recording already has 50 active links. Revoke one first.';
  end if;
  token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  insert into public.recording_links (recording_id, token_hash, show_summary, show_transcript, show_highlights, show_audio, expires_at)
  values (rec, encode(extensions.digest(token, 'sha256'), 'hex'), p_summary, p_transcript, p_highlights, p_audio,
          case when p_expires_days is null then null else now() + make_interval(days => p_expires_days) end)
  returning id into link_id;
  return jsonb_build_object('id', link_id, 'token', token);
end $$;
revoke execute on function public.create_recording_link(uuid, boolean, boolean, boolean, boolean, integer) from public, anon;
grant execute on function public.create_recording_link(uuid, boolean, boolean, boolean, boolean, integer) to authenticated;

-- The link's creator, or an owner or admin of the recording's workspace.
create function public.revoke_recording_link(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.recording_links l set revoked_at = now()
  from public.recordings r
  where l.id = p_id and r.id = l.recording_id and l.revoked_at is null
    and private.is_active_user()
    and private.can_access_recording(l.recording_id)
    and (l.created_by = (select auth.uid()) or private.has_role(r.workspace_id, '{owner,admin}'));
  if not found then raise exception 'You can''t revoke this link.' using errcode = '42501'; end if;
end $$;
revoke execute on function public.revoke_recording_link(uuid) from public, anon;
grant execute on function public.revoke_recording_link(uuid) to authenticated;

-- What a link shows, for anyone holding its token. Null when the link is
-- unknown, revoked or expired. Counts the view.
create function public.shared_link(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.recording_links;
  out jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
  select * into l from public.recording_links
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return null; end if;
  out := private.recording_bundle(l.recording_id, l.show_summary, l.show_transcript, l.show_highlights, l.show_audio);
  if out is null then return null; end if;
  update public.recording_links set view_count = view_count + 1, last_viewed_at = now() where id = l.id;
  return out || jsonb_build_object('expires_at', l.expires_at);
end $$;
revoke execute on function public.shared_link(text) from public;
grant execute on function public.shared_link(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sharing with people
-- ---------------------------------------------------------------------------
-- Shares with an email. If that person already has an account they get a
-- notification (and the email it triggers); otherwise the app emails an invite.
create function public.share_recording(rec uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  addr text := lower(trim(p_email));
  rec_title text;
  sharer text;
  recipient uuid;
  share_id uuid;
begin
  if (select auth.uid()) is null or not private.is_active_user() or not private.can_access_recording(rec) then
    raise exception 'You can''t share this recording.' using errcode = '42501';
  end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(addr) > 320 then
    raise exception 'Enter a valid email address.';
  end if;
  if addr = private.my_confirmed_email() then raise exception 'That''s your own email.'; end if;
  select title into rec_title from public.recordings where id = rec and deleted_at is null;
  if rec_title is null then raise exception 'This recording is in the trash.'; end if;
  if exists (select 1 from public.recording_shares where recording_id = rec and email = addr and removed_at is null) then
    return jsonb_build_object('already', true);
  end if;
  if (select count(*) from public.recording_shares where recording_id = rec and removed_at is null) >= 100 then
    raise exception 'This recording is shared with 100 people already.';
  end if;
  insert into public.recording_shares (recording_id, email) values (rec, addr) returning id into share_id;

  select coalesce(nullif(p.full_name, ''), 'Someone') into sharer from public.profiles p where p.id = (select auth.uid());
  select u.id into recipient from auth.users u where lower(u.email) = addr and u.email_confirmed_at is not null;
  if recipient is not null then
    perform private.notify(recipient, 'recording_shared', left(coalesce(sharer, 'Someone') || ' shared a recording with you', 200),
      rec_title, '/shared/' || rec, jsonb_build_object('recording_id', rec));
  end if;
  return jsonb_build_object('id', share_id, 'already', false, 'has_account', recipient is not null,
    'title', rec_title, 'sharer', coalesce(sharer, 'Someone'));
end $$;
revoke execute on function public.share_recording(uuid, text) from public, anon;
grant execute on function public.share_recording(uuid, text) to authenticated;

-- The person who shared it, or an owner or admin of the recording's workspace.
create function public.unshare_recording(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.recording_shares s set removed_at = now()
  from public.recordings r
  where s.id = p_id and r.id = s.recording_id and s.removed_at is null
    and private.is_active_user()
    and private.can_access_recording(s.recording_id)
    and (s.invited_by = (select auth.uid()) or private.has_role(r.workspace_id, '{owner,admin}'));
  if not found then raise exception 'You can''t remove this person.' using errcode = '42501'; end if;
end $$;
revoke execute on function public.unshare_recording(uuid) from public, anon;
grant execute on function public.unshare_recording(uuid) to authenticated;

-- Recordings shared with the signed-in user's confirmed email.
create function public.shared_with_me()
returns table (recording_id uuid, title text, created_at timestamptz, duration_sec integer, shared_by text, shared_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.title, r.created_at, r.duration_sec, coalesce(nullif(p.full_name, ''), 'Someone'), s.created_at
  from public.recording_shares s
  join public.recordings r on r.id = s.recording_id and r.deleted_at is null
  left join public.profiles p on p.id = s.invited_by
  where private.is_active_user()
    and s.removed_at is null and s.email = private.my_confirmed_email()
    and not exists (select 1 from public.profiles o where o.id = r.created_by and o.suspended_at is not null)
  order by s.created_at desc;
$$;
revoke execute on function public.shared_with_me() from public, anon;
grant execute on function public.shared_with_me() to authenticated;

-- One recording shared with the signed-in user: everything, read-only.
create function public.shared_recording(rec uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.recording_bundle(rec, true, true, true, true)
  where private.is_active_user() and exists (
    select 1 from public.recording_shares s
    where s.recording_id = rec and s.removed_at is null and s.email = private.my_confirmed_email());
$$;
revoke execute on function public.shared_recording(uuid) from public, anon;
grant execute on function public.shared_recording(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audio
-- ---------------------------------------------------------------------------
-- Signed-out visitors need one check from the storage policy, so it lives in
-- its own schema: granting anon the private schema would expose more.
create schema share_access;
revoke all on schema share_access from public;
grant usage on schema share_access to anon, authenticated;

-- A recording's file can be read while an active link includes its audio,
-- or by a person it's shared with.
create function share_access.can_read_object(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recordings r
    where r.storage_path = object_name and r.deleted_at is null
      and not exists (select 1 from public.profiles p where p.id = r.created_by and p.suspended_at is not null)
      and (
        exists (select 1 from public.recording_links l
                where l.recording_id = r.id and l.show_audio and l.revoked_at is null and (l.expires_at is null or l.expires_at > now()))
        or exists (select 1 from public.recording_shares s
                   where s.recording_id = r.id and s.removed_at is null and s.email = private.my_confirmed_email())
      )
  );
$$;
revoke execute on function share_access.can_read_object(text) from public;
grant execute on function share_access.can_read_object(text) to anon, authenticated;

create policy "recordings_bucket_select_shared" on storage.objects for select to anon, authenticated
  using (bucket_id = 'recordings' and share_access.can_read_object(name));
