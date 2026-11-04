-- Redial live calls (step 2): a screened call can run as a Twilio conference
-- where the caller and the AI are separate participants, so people can later
-- listen in, take over or transfer without the caller redialing.
--
-- * redial_lines.live_routing: conference routing for this line. Staff turn it
--   on per line (admin_redial_set_routing) while it's being proven live; the
--   direct stream stays the default and the fallback.
-- * redial_live_sessions: one per conference call (state of the call and AI).
-- * redial_live_participants: who is on the call (caller, agent, members).
-- * redial_live_events: what happened, in order (joins, leaves, AI handoffs,
--   and later every control action).
-- * redial_live_turns: the live transcript, one row per utterance, for any
--   call being screened (conference or direct). Needs read_transcript.
--
-- Everything is written by the webhooks (service role). Members read what
-- their grants allow; there are no member writes here.

alter table public.redial_lines add column live_routing boolean not null default false;

create table public.redial_live_sessions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.redial_calls (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  conference_name text not null unique,
  conference_sid text unique,
  caller_call_sid text,
  agent_call_sid text unique,
  state text not null default 'starting' check (state in ('starting', 'live', 'ended', 'failed')),
  ai_state text not null default 'pending' check (ai_state in ('pending', 'joining', 'active', 'left', 'failed')),
  error text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index redial_live_sessions_line_idx on public.redial_live_sessions (line_id, started_at desc);

create table public.redial_live_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.redial_live_sessions (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  role text not null check (role in ('caller', 'agent', 'member')),
  call_sid text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  muted boolean not null default false,
  status text not null default 'joined' check (status in ('joined', 'left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index redial_live_participants_session_idx on public.redial_live_participants (session_id);
create index redial_live_participants_line_idx on public.redial_live_participants (line_id);
create index redial_live_participants_user_idx on public.redial_live_participants (user_id);

create table public.redial_live_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.redial_live_sessions (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null check (char_length(kind) between 1 and 60),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index redial_live_events_session_idx on public.redial_live_events (session_id, id);
create index redial_live_events_line_idx on public.redial_live_events (line_id);
create index redial_live_events_actor_idx on public.redial_live_events (actor_id);

create table public.redial_live_turns (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.redial_calls (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  role text not null check (role in ('caller', 'assistant')),
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index redial_live_turns_call_idx on public.redial_live_turns (call_id, id);
create index redial_live_turns_line_idx on public.redial_live_turns (line_id);

revoke all on public.redial_live_sessions, public.redial_live_participants, public.redial_live_events, public.redial_live_turns from anon, authenticated;
grant select on public.redial_live_sessions, public.redial_live_participants, public.redial_live_events, public.redial_live_turns to authenticated;
alter table public.redial_live_sessions enable row level security;
alter table public.redial_live_participants enable row level security;
alter table public.redial_live_events enable row level security;
alter table public.redial_live_turns enable row level security;

create policy "redial_live_sessions_select" on public.redial_live_sessions for select to authenticated
  using ((select private.redial_can(line_id, 'read_summary')));
create policy "redial_live_participants_select" on public.redial_live_participants for select to authenticated
  using ((select private.redial_can(line_id, 'read_summary')));
create policy "redial_live_events_select" on public.redial_live_events for select to authenticated
  using ((select private.redial_can(line_id, 'read_summary')));
create policy "redial_live_turns_select" on public.redial_live_turns for select to authenticated
  using ((select private.redial_can(line_id, 'read_transcript')));

-- Staff switch conference routing on or off for a line (users.manage).
create function public.admin_redial_set_routing(p_line uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  update public.redial_lines set live_routing = p_on where id = p_line;
  if not found then raise exception 'Line not found' using errcode = 'P0002'; end if;
end $$;
revoke execute on function public.admin_redial_set_routing(uuid, boolean) from public, anon;
grant execute on function public.admin_redial_set_routing(uuid, boolean) to authenticated;
