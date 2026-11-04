-- Redial per-line permissions. The line owner can do everything; other people
-- get only the capabilities granted to them on that line. Billing or staff
-- roles never imply access to call content.
--
-- Capabilities (doc 20 of the kit, plus Mirror):
--   read_summary     see the line's calls and summaries
--   read_transcript  read call transcripts
--   manage_rules     change screening rules, lists and the assistant
--   monitor_live     listen live (Insider)             -- live controls, later
--   takeover_live    take over a call (Gavel)           -- later
--   direct_agent     guide the AI privately (Audible)   -- later
--   transfer_call    transfer calls (Directory)         -- later
--   manage_directory edit transfer destinations        -- later
--   dial_custom_destination  transfer to a one-time number -- later
--   mirror           use the AI call assistant (Mirror) -- later
--
-- Also: "spam" screening mode (screen only suspected spam). It needs a
-- spam-reputation provider; until one is connected the app doesn't offer it
-- and the webhook treats it as "don't screen".

alter table public.redial_lines drop constraint redial_lines_mode_check;
alter table public.redial_lines add constraint redial_lines_mode_check check (mode in ('spam', 'all', 'unknown', 'off'));

create table public.redial_line_grants (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  capabilities text[] not null default '{read_summary}' check (
    cardinality(capabilities) between 1 and 10 and capabilities <@ array[
      'read_summary', 'read_transcript', 'manage_rules', 'monitor_live', 'takeover_live', 'direct_agent',
      'transfer_call', 'manage_directory', 'dial_custom_destination', 'mirror']::text[]),
  granted_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (line_id, user_id)
);
create index redial_line_grants_user_idx on public.redial_line_grants (user_id);
create index redial_line_grants_granted_by_idx on public.redial_line_grants (granted_by);
create trigger redial_line_grants_updated_at before update on public.redial_line_grants for each row execute function public.set_updated_at();

-- Owner, or granted this capability on the line.
create function private.redial_can(p_line uuid, p_cap text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.redial_lines l where l.id = p_line and l.owner_id = (select auth.uid()))
      or exists (select 1 from public.redial_line_grants g where g.line_id = p_line and g.user_id = (select auth.uid()) and p_cap = any(g.capabilities));
$$;
create function private.redial_has_grant(p_line uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.redial_line_grants g where g.line_id = p_line and g.user_id = (select auth.uid()));
$$;
revoke execute on function private.redial_can(uuid, text), private.redial_has_grant(uuid) from public, anon;
grant execute on function private.redial_can(uuid, text), private.redial_has_grant(uuid) to authenticated;

revoke all on public.redial_line_grants from anon, authenticated;
grant select, delete on public.redial_line_grants to authenticated;
grant update (capabilities) on public.redial_line_grants to authenticated;
alter table public.redial_line_grants enable row level security;
-- The owner manages grants; a grantee can see (and remove) their own.
create policy "redial_grants_select" on public.redial_line_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select private.owns_redial_line(line_id)));
create policy "redial_grants_update" on public.redial_line_grants for update to authenticated
  using ((select private.owns_redial_line(line_id))) with check ((select private.owns_redial_line(line_id)));
create policy "redial_grants_delete" on public.redial_line_grants for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.owns_redial_line(line_id)));

-- Grant by email: only to someone who shares a workspace with the owner.
create function public.redial_grant(p_line uuid, p_email text, p_capabilities text[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if not private.owns_redial_line(p_line) then raise exception 'Only the line owner can share it.' using errcode = '42501'; end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_user is null or v_user = (select auth.uid()) or not exists (
    select 1 from public.workspace_members a join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = (select auth.uid()) and b.user_id = v_user) then
    raise exception 'Share with someone in one of your workspaces (invite them to your Business workspace first).' using errcode = 'P0002';
  end if;
  insert into public.redial_line_grants (line_id, user_id, capabilities) values (p_line, v_user, p_capabilities)
  on conflict (line_id, user_id) do update set capabilities = excluded.capabilities
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.redial_grant(uuid, text, text[]) from public, anon;
grant execute on function public.redial_grant(uuid, text, text[]) to authenticated;

-- Who a line is shared with, for its owner (names and emails).
create function public.redial_line_people(p_line uuid)
returns table (grant_id uuid, user_id uuid, email text, full_name text, capabilities text[], created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.owns_redial_line(p_line) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select g.id, g.user_id, u.email::text, p.full_name, g.capabilities, g.created_at
  from public.redial_line_grants g join auth.users u on u.id = g.user_id left join public.profiles p on p.id = g.user_id
  where g.line_id = p_line order by g.created_at;
end $$;
revoke execute on function public.redial_line_people(uuid) from public, anon;
grant execute on function public.redial_line_people(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Existing tables now follow the grants
-- ---------------------------------------------------------------------------
drop policy "redial_lines_select" on public.redial_lines;
create policy "redial_lines_select" on public.redial_lines for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.redial_has_grant(id)) or (select private.staff_can('users.view')));
drop policy "redial_lines_update" on public.redial_lines;
create policy "redial_lines_update" on public.redial_lines for update to authenticated
  using ((select private.redial_can(id, 'manage_rules'))) with check ((select private.redial_can(id, 'manage_rules')));

drop policy "redial_list_select" on public.redial_list_entries;
drop policy "redial_list_insert" on public.redial_list_entries;
drop policy "redial_list_update" on public.redial_list_entries;
drop policy "redial_list_delete" on public.redial_list_entries;
create policy "redial_list_select" on public.redial_list_entries for select to authenticated
  using ((select private.redial_can(line_id, 'read_summary')) or (select private.redial_can(line_id, 'manage_rules')));
create policy "redial_list_insert" on public.redial_list_entries for insert to authenticated with check ((select private.redial_can(line_id, 'manage_rules')));
create policy "redial_list_update" on public.redial_list_entries for update to authenticated
  using ((select private.redial_can(line_id, 'manage_rules'))) with check ((select private.redial_can(line_id, 'manage_rules')));
create policy "redial_list_delete" on public.redial_list_entries for delete to authenticated using ((select private.redial_can(line_id, 'manage_rules')));

-- Calls: transcripts need their own capability, so the column is no longer
-- readable directly; redial_transcripts() returns them where allowed.
drop policy "redial_calls_select" on public.redial_calls;
create policy "redial_calls_select" on public.redial_calls for select to authenticated
  using ((select private.redial_can(line_id, 'read_summary')));
drop policy "redial_calls_update" on public.redial_calls;
create policy "redial_calls_update" on public.redial_calls for update to authenticated
  using ((select private.redial_can(line_id, 'read_summary'))) with check ((select private.redial_can(line_id, 'read_summary')));
revoke select on public.redial_calls from authenticated;
grant select (id, line_id, owner_id, twilio_sid, from_number, caller_id_name, status, reason, caller_name, purpose, callback_number,
  message, summary, category, urgency, connect_requested, recording_path, duration_seconds, ai_seconds, started_at, ended_at,
  read_at, archived_at, created_at) on public.redial_calls to authenticated;

create function public.redial_transcripts(p_line uuid, p_ids uuid[])
returns table (id uuid, transcript jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.redial_can(p_line, 'read_transcript') then return; end if;
  return query select c.id, c.transcript from public.redial_calls c where c.line_id = p_line and c.id = any(p_ids);
end $$;
revoke execute on function public.redial_transcripts(uuid, uuid[]) from public, anon;
grant execute on function public.redial_transcripts(uuid, uuid[]) to authenticated;

-- Callbacks: anyone who can see the line's calls can keep their own reminders.
drop policy "redial_callbacks_insert" on public.redial_callbacks;
create policy "redial_callbacks_insert" on public.redial_callbacks for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.redial_can(line_id, 'read_summary'))
    and (call_id is null or exists (select 1 from public.redial_calls c where c.id = call_id and c.line_id = redial_callbacks.line_id)));

-- Voicemail audio: also playable by people granted transcripts on that line
-- (path <owner id>/<call id>.mp3).
create policy "redial_voicemail_select_granted" on storage.objects for select to authenticated
  using (bucket_id = 'redial-voicemail' and exists (
    select 1 from public.redial_calls c
    where c.recording_path = storage.objects.name and private.redial_can(c.line_id, 'read_transcript')));
