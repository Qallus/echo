-- Phase 4a: the Echo call line. One platform Twilio number (ECHO_CALL_LINE)
-- places and records members' calls.
-- * call_line_phones: each member's own cell, verified through Twilio's
--   caller-ID validation (Twilio calls it and the member enters a code), so
--   outbound calls can show it and merged calls from it are recognised.
--   Only the signed Twilio webhook marks a number verified.
-- * call_line_calls: each call placed or recorded through the line, written
--   by the webhooks (service role); the recording lands in recordings.

create table public.call_line_phones (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  number text not null unique check (number ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  validation_code text check (char_length(validation_code) <= 12),
  caller_id_sid text check (char_length(caller_id_sid) <= 64),
  workspace_id uuid references public.workspaces (id) on delete set null,
  ask_workspace boolean not null default false,
  announce boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index call_line_phones_workspace_idx on public.call_line_phones (workspace_id);
create trigger call_line_phones_updated_at before update on public.call_line_phones for each row execute function public.set_updated_at();

-- A new number starts over as unverified.
create function private.call_line_phone_reset() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.number is distinct from old.number then
    new.status := 'pending'; new.verified_at := null; new.caller_id_sid := null; new.validation_code := null;
  end if;
  return new;
end $$;
revoke execute on function private.call_line_phone_reset() from public, anon, authenticated;
create trigger call_line_phones_reset before update on public.call_line_phones for each row execute function private.call_line_phone_reset();

create table public.call_line_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('outbound', 'merge')),
  to_number text check (to_number ~ '^\+[1-9][0-9]{7,14}$'),
  workspace_id uuid references public.workspaces (id) on delete set null,
  twilio_sid text unique check (char_length(twilio_sid) <= 64),
  status text not null default 'queued' check (status in ('queued', 'ringing_you', 'connecting', 'in_progress', 'completed', 'no_answer', 'failed', 'canceled')),
  error text check (char_length(error) <= 300),
  recording_id uuid references public.recordings (id) on delete set null,
  duration_seconds integer check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index call_line_calls_user_idx on public.call_line_calls (user_id, created_at desc);
create index call_line_calls_workspace_idx on public.call_line_calls (workspace_id);
create index call_line_calls_recording_idx on public.call_line_calls (recording_id);

revoke all on public.call_line_phones, public.call_line_calls from anon, authenticated;

grant select (user_id, number, status, validation_code, workspace_id, ask_workspace, announce, verified_at, created_at, updated_at), delete on public.call_line_phones to authenticated;
grant insert (user_id, number, workspace_id), update (number, validation_code, workspace_id, ask_workspace, announce) on public.call_line_phones to authenticated;
alter table public.call_line_phones enable row level security;
create policy "call_line_phones_select" on public.call_line_phones for select to authenticated using (user_id = (select auth.uid()));
create policy "call_line_phones_insert" on public.call_line_phones for insert to authenticated
  with check (user_id = (select auth.uid()) and (workspace_id is null or private.is_member(workspace_id)));
create policy "call_line_phones_update" on public.call_line_phones for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (workspace_id is null or private.is_member(workspace_id)));
create policy "call_line_phones_delete" on public.call_line_phones for delete to authenticated using (user_id = (select auth.uid()));

-- Members start outbound calls (the server action then asks Twilio to ring
-- them); only the webhooks update a call.
grant select, insert (user_id, kind, to_number, workspace_id) on public.call_line_calls to authenticated;
alter table public.call_line_calls enable row level security;
create policy "call_line_calls_select" on public.call_line_calls for select to authenticated using (user_id = (select auth.uid()));
create policy "call_line_calls_insert" on public.call_line_calls for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'outbound'
    and exists (select 1 from public.call_line_phones p where p.user_id = (select auth.uid()) and p.status = 'verified')
    and (workspace_id is null or private.is_member(workspace_id)));

-- If Twilio refuses to place a call, the member's own server action marks it failed.
grant update (status, error) on public.call_line_calls to authenticated;
create policy "call_line_calls_update" on public.call_line_calls for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
