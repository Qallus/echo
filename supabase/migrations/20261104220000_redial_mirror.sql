-- Redial step 7 (Mirror): while a person is on a call with a caller, the AI
-- listens silently (a Twilio media stream of the caller's call to the voice
-- gateway, transcribed; it never joins or speaks) and suggests talking
-- points, answers and contact details, and drafts texts or emails to the
-- caller that the person reviews and sends.
--
-- * redial_mirror_settings: per line, what Mirror may read (the line's
--   knowledge notes, earlier calls from this number, the transfer directory)
--   and do (draft texts, draft emails). manage_rules edits them.
-- * redial_mirror_sessions: Mirror on one call (started, running, stopped).
-- * redial_mirror_suggestions: what it suggested; status new -> dismissed or
--   sent (only after the person approved and the message actually went).
-- * redial_live_turns gains role "person" (whoever is talking with the
--   caller), so Mirror's transcript says who said what.
-- People need the "mirror" capability on the line (owners have it).

alter table public.redial_live_turns drop constraint redial_live_turns_role_check;
alter table public.redial_live_turns add constraint redial_live_turns_role_check check (role in ('caller', 'assistant', 'person'));
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check check (feature in ('chat', 'summary', 'transcription', 'mcp', 'test', 'mirror'));

create table public.redial_mirror_settings (
  line_id uuid primary key references public.redial_lines (id) on delete cascade,
  enabled boolean not null default false,
  auto_start boolean not null default true,
  use_knowledge boolean not null default true,
  use_history boolean not null default true,
  use_directory boolean not null default true,
  allow_sms boolean not null default false,
  allow_email boolean not null default false,
  knowledge text check (char_length(knowledge) <= 20000),
  updated_at timestamptz not null default now()
);
create trigger redial_mirror_settings_updated_at before update on public.redial_mirror_settings for each row execute function public.set_updated_at();

revoke all on public.redial_mirror_settings from anon, authenticated;
grant select, insert on public.redial_mirror_settings to authenticated;
grant update (enabled, auto_start, use_knowledge, use_history, use_directory, allow_sms, allow_email, knowledge) on public.redial_mirror_settings to authenticated;
alter table public.redial_mirror_settings enable row level security;
create policy "redial_mirror_settings_select" on public.redial_mirror_settings for select to authenticated
  using ((select private.redial_can(line_id, 'mirror')) or (select private.redial_can(line_id, 'manage_rules')));
create policy "redial_mirror_settings_insert" on public.redial_mirror_settings for insert to authenticated
  with check ((select private.redial_can(line_id, 'manage_rules')));
create policy "redial_mirror_settings_update" on public.redial_mirror_settings for update to authenticated
  using ((select private.redial_can(line_id, 'manage_rules'))) with check ((select private.redial_can(line_id, 'manage_rules')));

create table public.redial_mirror_sessions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.redial_calls (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  started_by uuid references auth.users (id) on delete set null,
  state text not null default 'starting' check (state in ('starting', 'running', 'stopped', 'failed')),
  error text,
  busy_until timestamptz,
  last_suggested_at timestamptz,
  started_at timestamptz not null default now(),
  stopped_at timestamptz
);
create index redial_mirror_sessions_line_idx on public.redial_mirror_sessions (line_id);
create index redial_mirror_sessions_started_by_idx on public.redial_mirror_sessions (started_by);

create table public.redial_mirror_suggestions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.redial_calls (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  kind text not null check (kind in ('say', 'answer', 'info', 'caution', 'sms', 'email')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  source text check (source in ('call', 'knowledge', 'history', 'directory')),
  subject text check (char_length(subject) <= 200),
  status text not null default 'new' check (status in ('new', 'dismissed', 'sending', 'sent', 'failed')),
  sent_to text,
  acted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  acted_at timestamptz
);
create index redial_mirror_suggestions_call_idx on public.redial_mirror_suggestions (call_id, created_at);
create index redial_mirror_suggestions_line_idx on public.redial_mirror_suggestions (line_id);
create index redial_mirror_suggestions_acted_by_idx on public.redial_mirror_suggestions (acted_by);

revoke all on public.redial_mirror_sessions, public.redial_mirror_suggestions from anon, authenticated;
grant select on public.redial_mirror_sessions, public.redial_mirror_suggestions to authenticated;
alter table public.redial_mirror_sessions enable row level security;
alter table public.redial_mirror_suggestions enable row level security;
create policy "redial_mirror_sessions_select" on public.redial_mirror_sessions for select to authenticated
  using ((select private.redial_can(line_id, 'mirror')));
create policy "redial_mirror_suggestions_select" on public.redial_mirror_suggestions for select to authenticated
  using ((select private.redial_can(line_id, 'mirror')));

-- Start Mirror on a call a person is on. Returns the caller's Twilio call SID
-- so the server can open the media stream.
create function public.redial_mirror_start(p_call uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  c public.redial_calls;
  m public.redial_mirror_sessions;
begin
  select * into c from public.redial_calls where id = p_call;
  if c.id is null or not private.redial_can(c.line_id, 'mirror') then raise exception 'You can''t use Mirror on this call.' using errcode = '42501'; end if;
  if not exists (select 1 from public.redial_mirror_settings s where s.line_id = c.line_id and s.enabled) then
    raise exception 'Mirror is off for this line. Turn it on under the Mirror tab.' using errcode = 'P0001';
  end if;
  if c.status not in ('connecting', 'connected') or c.ended_at is not null or c.twilio_sid is null then
    raise exception 'Mirror works once a person is talking with the caller.' using errcode = 'P0001';
  end if;
  select * into m from public.redial_mirror_sessions where call_id = p_call for update;
  if m.id is not null and m.state in ('starting', 'running') then raise exception 'Mirror is already on for this call.' using errcode = 'P0001'; end if;
  insert into public.redial_mirror_sessions (call_id, line_id, started_by, state) values (p_call, c.line_id, (select auth.uid()), 'starting')
  on conflict (call_id) do update set state = 'starting', started_by = excluded.started_by, error = null, started_at = now(), stopped_at = null;
  return c.twilio_sid;
end $$;

-- Stop (or mark failed) Mirror on a call.
create function public.redial_mirror_stop(p_call uuid, p_error text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  c public.redial_calls;
begin
  select * into c from public.redial_calls where id = p_call;
  if c.id is null or not private.redial_can(c.line_id, 'mirror') then raise exception 'You can''t use Mirror on this call.' using errcode = '42501'; end if;
  update public.redial_mirror_sessions set state = case when p_error is null then 'stopped' else 'failed' end, error = left(p_error, 500), stopped_at = now()
  where call_id = p_call and state in ('starting', 'running');
  return c.twilio_sid;
end $$;

-- A suggestion: dismiss it, or claim a drafted text/email for sending (checks
-- the line still allows it) and then record whether it actually went.
create function public.redial_mirror_act(p_suggestion uuid, p_action text, p_sent_to text default null)
returns table (kind text, line_number text, line_label text, call_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  g public.redial_mirror_suggestions;
  st public.redial_mirror_settings;
begin
  select * into g from public.redial_mirror_suggestions x where x.id = p_suggestion for update;
  if g.id is null or not private.redial_can(g.line_id, 'mirror') then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_action = 'dismiss' then
    update public.redial_mirror_suggestions x set status = 'dismissed', acted_by = (select auth.uid()), acted_at = now() where x.id = g.id and x.status in ('new', 'failed');
  elsif p_action = 'send' then
    if g.kind not in ('sms', 'email') or g.status not in ('new', 'failed') then raise exception 'This can''t be sent.' using errcode = 'P0001'; end if;
    select * into st from public.redial_mirror_settings s where s.line_id = g.line_id;
    if (g.kind = 'sms' and not coalesce(st.allow_sms, false)) or (g.kind = 'email' and not coalesce(st.allow_email, false)) then
      raise exception 'Sending this is turned off in Mirror settings.' using errcode = '42501';
    end if;
    update public.redial_mirror_suggestions x set status = 'sending', acted_by = (select auth.uid()), acted_at = now(), sent_to = left(p_sent_to, 200) where x.id = g.id;
  elsif p_action in ('sent', 'failed') then
    update public.redial_mirror_suggestions x set status = p_action where x.id = g.id and x.status = 'sending' and x.acted_by = (select auth.uid());
  else
    raise exception 'Unknown action.' using errcode = '22023';
  end if;
  return query select g.kind, l.number, l.label, g.call_id from public.redial_lines l where l.id = g.line_id;
end $$;

-- Webhook only (service role): one suggestion run at a time per call, at
-- most every six seconds.
create function public.redial_mirror_claim(p_call uuid)
returns boolean
language sql security definer set search_path = '' as $$
  update public.redial_mirror_sessions set busy_until = now() + interval '30 seconds'
  where call_id = p_call and state = 'running' and (busy_until is null or busy_until < now())
    and (last_suggested_at is null or last_suggested_at < now() - interval '6 seconds')
  returning true;
$$;

revoke execute on function public.redial_mirror_start(uuid), public.redial_mirror_stop(uuid, text), public.redial_mirror_act(uuid, text, text) from public, anon;
grant execute on function public.redial_mirror_start(uuid), public.redial_mirror_stop(uuid, text), public.redial_mirror_act(uuid, text, text) to authenticated;
revoke execute on function public.redial_mirror_claim(uuid) from public, anon, authenticated;
