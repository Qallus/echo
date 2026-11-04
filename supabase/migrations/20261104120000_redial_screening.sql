-- Redial 4b, first slice: AI call screening on an Echo-assigned number.
-- * redial_lines: one Twilio number per member line (staff assign the
--   number; the member sets where calls go, the screening mode and the
--   assistant). Calls to the number hit /api/webhooks/twilio/redial/*.
-- * redial_list_entries: allow / block / VIP numbers per line.
-- * redial_calls: each screened call: decision, what the caller said, the
--   AI summary and transcript. Written only by the webhooks and the voice
--   gateway (service role); readable only by the line's owner. Staff don't
--   see call content (Redial privacy rule).
-- * redial_callbacks: the owner's callback reminders.

create table public.redial_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'My line' check (char_length(label) between 1 and 60),
  number text not null unique check (number ~ '^\+[1-9][0-9]{7,14}$'),
  forward_to text check (forward_to ~ '^\+[1-9][0-9]{7,14}$'),
  mode text not null default 'unknown' check (mode in ('all', 'unknown', 'off')),
  paused boolean not null default false,
  allow_connect boolean not null default true,
  assistant_name text not null default 'Echo' check (char_length(assistant_name) between 1 and 40),
  voice text not null default 'ara' check (voice in ('ara', 'eve', 'rex', 'sal', 'leo')),
  greeting text check (char_length(greeting) <= 500),
  about text check (char_length(about) <= 4000),
  max_seconds integer not null default 120 check (max_seconds between 30 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (forward_to is null or forward_to <> number)
);
create index redial_lines_owner_idx on public.redial_lines (owner_id);
create trigger redial_lines_updated_at before update on public.redial_lines for each row execute function public.set_updated_at();

create table public.redial_list_entries (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  number text not null check (number ~ '^\+[1-9][0-9]{7,14}$'),
  kind text not null check (kind in ('allow', 'block', 'vip')),
  label text check (char_length(label) <= 100),
  created_at timestamptz not null default now(),
  unique (line_id, number)
);

create table public.redial_calls (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  twilio_sid text unique check (char_length(twilio_sid) <= 64),
  from_number text check (char_length(from_number) <= 40),
  caller_id_name text check (char_length(caller_id_name) <= 100),
  status text not null default 'ringing' check (status in (
    'ringing', 'screening', 'connecting', 'connected', 'message', 'blocked', 'forwarded', 'missed', 'failed', 'completed')),
  reason text check (char_length(reason) <= 200),
  caller_name text check (char_length(caller_name) <= 120),
  purpose text check (char_length(purpose) <= 1000),
  callback_number text check (char_length(callback_number) <= 40),
  message text check (char_length(message) <= 10000),
  summary text check (char_length(summary) <= 2000),
  category text check (category in ('personal', 'business', 'sales', 'spam', 'unknown')),
  urgency text check (urgency in ('low', 'normal', 'high')),
  connect_requested boolean not null default false,
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array' and pg_column_size(transcript) <= 262144),
  recording_path text check (char_length(recording_path) <= 300),
  duration_seconds integer check (duration_seconds >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index redial_calls_owner_idx on public.redial_calls (owner_id, started_at desc);
create index redial_calls_line_idx on public.redial_calls (line_id, started_at desc);

create table public.redial_callbacks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  call_id uuid references public.redial_calls (id) on delete set null,
  name text check (char_length(name) <= 120),
  number text check (char_length(number) <= 40),
  due_at timestamptz not null,
  timezone text not null default 'America/Phoenix' check (char_length(timezone) <= 60),
  note text check (char_length(note) <= 2000),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index redial_callbacks_owner_idx on public.redial_callbacks (owner_id, due_at) where done_at is null;
create index redial_callbacks_line_idx on public.redial_callbacks (line_id);
create index redial_callbacks_call_idx on public.redial_callbacks (call_id);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
revoke all on public.redial_lines, public.redial_list_entries, public.redial_calls, public.redial_callbacks from anon, authenticated;

-- Lines: the owner reads and edits their settings (not the number); staff
-- with users.manage assign and remove numbers.
grant select, delete on public.redial_lines to authenticated;
grant insert (owner_id, label, number) on public.redial_lines to authenticated;
grant update (label, forward_to, mode, paused, allow_connect, assistant_name, voice, greeting, about, max_seconds) on public.redial_lines to authenticated;
alter table public.redial_lines enable row level security;
create policy "redial_lines_select" on public.redial_lines for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.staff_can('users.view')));
create policy "redial_lines_insert" on public.redial_lines for insert to authenticated
  with check ((select private.staff_can('users.manage')));
create policy "redial_lines_update" on public.redial_lines for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "redial_lines_delete" on public.redial_lines for delete to authenticated
  using ((select private.staff_can('users.manage')));

create function private.owns_redial_line(p_line uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.redial_lines where id = p_line and owner_id = (select auth.uid()));
$$;
revoke execute on function private.owns_redial_line(uuid) from public, anon;
grant execute on function private.owns_redial_line(uuid) to authenticated;

grant select, delete on public.redial_list_entries to authenticated;
grant insert (line_id, number, kind, label), update (kind, label) on public.redial_list_entries to authenticated;
alter table public.redial_list_entries enable row level security;
create policy "redial_list_select" on public.redial_list_entries for select to authenticated using ((select private.owns_redial_line(line_id)));
create policy "redial_list_insert" on public.redial_list_entries for insert to authenticated with check ((select private.owns_redial_line(line_id)));
create policy "redial_list_update" on public.redial_list_entries for update to authenticated
  using ((select private.owns_redial_line(line_id))) with check ((select private.owns_redial_line(line_id)));
create policy "redial_list_delete" on public.redial_list_entries for delete to authenticated using ((select private.owns_redial_line(line_id)));

-- Calls: owner only. They can mark read, archive and correct the label.
grant select on public.redial_calls to authenticated;
grant update (read_at, archived_at, category) on public.redial_calls to authenticated;
alter table public.redial_calls enable row level security;
create policy "redial_calls_select" on public.redial_calls for select to authenticated using (owner_id = (select auth.uid()));
create policy "redial_calls_update" on public.redial_calls for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, delete on public.redial_callbacks to authenticated;
grant insert (line_id, call_id, name, number, due_at, timezone, note), update (name, number, due_at, timezone, note, done_at) on public.redial_callbacks to authenticated;
alter table public.redial_callbacks enable row level security;
create policy "redial_callbacks_select" on public.redial_callbacks for select to authenticated using (owner_id = (select auth.uid()));
create policy "redial_callbacks_insert" on public.redial_callbacks for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.owns_redial_line(line_id))
    and (call_id is null or exists (select 1 from public.redial_calls c where c.id = call_id and c.line_id = redial_callbacks.line_id and c.owner_id = (select auth.uid()))));
create policy "redial_callbacks_update" on public.redial_callbacks for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "redial_callbacks_delete" on public.redial_callbacks for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Staff: line metadata and call counts only (no call content)
-- ---------------------------------------------------------------------------
create function public.admin_redial_lines()
returns table (id uuid, owner_id uuid, owner_email text, owner_name text, label text, number text, has_destination boolean,
               mode text, paused boolean, calls_30d bigint, last_call_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('users.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
  select l.id, l.owner_id, u.email::text, p.full_name, l.label, l.number, l.forward_to is not null, l.mode, l.paused,
         (select count(*) from public.redial_calls c where c.line_id = l.id and c.started_at > now() - interval '30 days'),
         (select max(c.started_at) from public.redial_calls c where c.line_id = l.id), l.created_at
  from public.redial_lines l join auth.users u on u.id = l.owner_id left join public.profiles p on p.id = l.owner_id
  order by l.created_at desc;
end $$;
revoke execute on function public.admin_redial_lines() from public, anon;
grant execute on function public.admin_redial_lines() to authenticated;

-- Assign a number to a member by email (staff with users.manage).
create function public.admin_redial_assign(p_email text, p_number text, p_label text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'No Echo account uses that email.' using errcode = 'P0002'; end if;
  insert into public.redial_lines (owner_id, number, label) values (v_user, p_number, coalesce(nullif(trim(p_label), ''), 'My line'))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.admin_redial_assign(text, text, text) from public, anon;
grant execute on function public.admin_redial_assign(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Notify the owner once a call has a message or summary
-- ---------------------------------------------------------------------------
create function private.redial_call_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce(nullif(new.caller_name, ''), nullif(new.caller_id_name, ''), new.from_number, 'Unknown caller');
begin
  if coalesce(new.summary, new.message) is not null and coalesce(old.summary, old.message) is null then
    perform private.notify(new.owner_id, 'redial_call',
      case when new.urgency = 'high' then 'Urgent call from ' else 'Call from ' end || who,
      left(coalesce(new.summary, new.message), 300), '/calls?call=' || new.id, jsonb_build_object('call_id', new.id));
  end if;
  return null;
end $$;
revoke execute on function private.redial_call_notify() from public, anon, authenticated;
create trigger redial_calls_notify after update of summary, message on public.redial_calls
  for each row execute function private.redial_call_notify();
