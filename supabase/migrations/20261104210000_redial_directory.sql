-- Redial step 6 (Directory): transfer a live conference call to an approved
-- person or number. The person called hears a private briefing and presses 1
-- to accept; only then are they joined and the assistant removed. If nobody
-- accepts, the assistant (or whoever took over) stays with the caller and
-- the screen says the transfer didn't happen, never "Transferred".
--
-- * redial_directory: saved destinations per line (manage_directory edits).
-- * redial_transfers: each attempt and how it ended. Written by
--   redial_transfer_start() and the webhooks only.

alter table public.redial_live_participants drop constraint redial_live_participants_role_check;
alter table public.redial_live_participants add constraint redial_live_participants_role_check check (role in ('caller', 'agent', 'member', 'transfer'));
alter table public.redial_live_sessions add column transferred_at timestamptz;

create table public.redial_directory (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  number text not null check (number ~ '^\+[1-9]\d{7,14}$'),
  note text check (char_length(note) <= 300),
  sort integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (line_id, number)
);
create index redial_directory_line_idx on public.redial_directory (line_id, sort);
create index redial_directory_created_by_idx on public.redial_directory (created_by);

revoke all on public.redial_directory from anon, authenticated;
grant select, insert, delete on public.redial_directory to authenticated;
grant update (label, number, note, sort) on public.redial_directory to authenticated;
alter table public.redial_directory enable row level security;
create policy "redial_directory_select" on public.redial_directory for select to authenticated
  using ((select private.redial_can(line_id, 'transfer_call')) or (select private.redial_can(line_id, 'manage_directory')));
create policy "redial_directory_insert" on public.redial_directory for insert to authenticated
  with check ((select private.redial_can(line_id, 'manage_directory')));
create policy "redial_directory_update" on public.redial_directory for update to authenticated
  using ((select private.redial_can(line_id, 'manage_directory'))) with check ((select private.redial_can(line_id, 'manage_directory')));
create policy "redial_directory_delete" on public.redial_directory for delete to authenticated
  using ((select private.redial_can(line_id, 'manage_directory')));

create table public.redial_transfers (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.redial_calls (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  session_id uuid not null references public.redial_live_sessions (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  destination_id uuid references public.redial_directory (id) on delete set null,
  label text not null,
  number text not null,
  custom boolean not null default false,
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'connected', 'declined', 'no_answer', 'failed', 'ended')),
  twilio_sid text unique,
  error text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create index redial_transfers_call_idx on public.redial_transfers (call_id, created_at);
create index redial_transfers_line_idx on public.redial_transfers (line_id);
create index redial_transfers_session_idx on public.redial_transfers (session_id);
create index redial_transfers_requested_by_idx on public.redial_transfers (requested_by);
create index redial_transfers_destination_idx on public.redial_transfers (destination_id);

revoke all on public.redial_transfers from anon, authenticated;
grant select on public.redial_transfers to authenticated;
alter table public.redial_transfers enable row level security;
create policy "redial_transfers_select" on public.redial_transfers for select to authenticated
  using ((select private.redial_can(line_id, 'read_summary')));

-- Start a transfer. p_destination: a saved entry; or p_number (E.164, already
-- normalized) with p_confirmed for a one-time number. Returns what the server
-- needs to place the call.
create function public.redial_transfer_start(p_call uuid, p_destination uuid, p_number text, p_confirmed boolean)
returns table (transfer_id uuid, number text, label text, from_number text)
language plpgsql security definer set search_path = '' as $$
declare
  s public.redial_live_sessions;
  l public.redial_lines;
  d public.redial_directory;
  c public.redial_calls;
  v_number text;
  v_label text;
  v_id uuid;
begin
  select * into s from public.redial_live_sessions ls where ls.call_id = p_call for update;
  if s.id is null or not private.redial_can(s.line_id, 'transfer_call') then
    raise exception 'You can''t transfer this call.' using errcode = '42501';
  end if;
  if s.state <> 'live' then raise exception 'This call isn''t live any more.' using errcode = 'P0001'; end if;
  if s.transferred_at is not null or exists (select 1 from public.redial_transfers t where t.session_id = s.id and t.status in ('ringing', 'accepted', 'connected')) then
    raise exception 'A transfer is already under way on this call.' using errcode = 'P0001';
  end if;
  select * into l from public.redial_lines x where x.id = s.line_id;
  select * into c from public.redial_calls y where y.id = p_call;

  if p_destination is not null then
    select * into d from public.redial_directory z where z.id = p_destination and z.line_id = s.line_id;
    if d.id is null then raise exception 'That destination isn''t in this line''s directory.' using errcode = 'P0002'; end if;
    v_number := d.number; v_label := d.label;
  else
    if not private.redial_can(s.line_id, 'dial_custom_destination') then
      raise exception 'You can only transfer to numbers in the directory.' using errcode = '42501';
    end if;
    if not coalesce(p_confirmed, false) then raise exception 'Confirm the number first.' using errcode = '22023'; end if;
    v_number := p_number; v_label := 'One-time number';
  end if;
  if v_number is null or v_number !~ '^\+[1-9]\d{7,14}$' then raise exception 'Enter a valid phone number.' using errcode = '22023'; end if;
  -- No loops: never transfer to a Redial line or back to the caller.
  if exists (select 1 from public.redial_lines x where x.number = v_number) or v_number = c.from_number then
    raise exception 'That number would loop back into this call.' using errcode = '22023';
  end if;

  insert into public.redial_transfers (call_id, line_id, session_id, requested_by, destination_id, label, number, custom)
  values (p_call, s.line_id, s.id, (select auth.uid()), d.id, v_label, v_number, p_destination is null)
  returning redial_transfers.id into v_id;
  insert into public.redial_live_events (session_id, line_id, actor_id, kind, detail)
  values (s.id, s.line_id, (select auth.uid()), 'transfer.start', jsonb_build_object('transfer_id', v_id, 'label', v_label, 'custom', p_destination is null));
  return query select v_id, v_number, v_label, l.number;
end $$;
revoke execute on function public.redial_transfer_start(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.redial_transfer_start(uuid, uuid, text, boolean) to authenticated;

-- The requester marks their own ringing transfer failed when the call to the
-- destination couldn't even be placed.
create function public.redial_transfer_failed(p_id uuid, p_error text)
returns void
language sql security definer set search_path = '' as $$
  update public.redial_transfers set status = 'failed', error = left(p_error, 500), ended_at = now()
  where id = p_id and requested_by = (select auth.uid()) and status = 'ringing';
$$;
revoke execute on function public.redial_transfer_failed(uuid, text) from public, anon;
grant execute on function public.redial_transfer_failed(uuid, text) to authenticated;
