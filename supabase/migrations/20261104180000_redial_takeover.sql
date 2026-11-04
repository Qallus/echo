-- Redial step 4 (Gavel): a person takes over a live call from the AI.
-- redial_takeover() claims it once (only one person, only while the call is
-- live, only with takeover_live), marks the AI as removed so it can't be
-- re-added or hand the caller anywhere, marks the call as connected, and
-- logs it. The server then silences and removes the AI, and only after that
-- unmutes the person.

alter table public.redial_live_sessions drop constraint redial_live_sessions_ai_state_check;
alter table public.redial_live_sessions add constraint redial_live_sessions_ai_state_check
  check (ai_state in ('pending', 'joining', 'active', 'left', 'failed', 'removed'));
alter table public.redial_live_sessions
  add column taken_over_by uuid references auth.users (id) on delete set null,
  add column taken_over_at timestamptz;
create index redial_live_sessions_taken_over_by_idx on public.redial_live_sessions (taken_over_by);

create function public.redial_takeover(p_call uuid)
returns table (session_id uuid, conference_sid text, agent_call_sid text)
language plpgsql security definer set search_path = '' as $$
declare
  s public.redial_live_sessions;
begin
  select * into s from public.redial_live_sessions ls where ls.call_id = p_call for update;
  if s.id is null or not private.redial_can(s.line_id, 'takeover_live') then
    raise exception 'You can''t take over this call.' using errcode = '42501';
  end if;
  if s.state <> 'live' then raise exception 'This call isn''t live any more.' using errcode = 'P0001'; end if;
  if s.taken_over_by is not null then raise exception 'Someone has already taken over this call.' using errcode = 'P0001'; end if;
  if s.ai_state not in ('pending', 'joining', 'active') then raise exception 'The assistant has already left this call.' using errcode = 'P0001'; end if;

  update public.redial_live_sessions set taken_over_by = (select auth.uid()), taken_over_at = now(), ai_state = 'removed' where id = s.id;
  update public.redial_calls set status = 'connected', reason = 'Taken over from the assistant' where id = p_call and status = 'screening';
  insert into public.redial_live_events (session_id, line_id, actor_id, kind) values (s.id, s.line_id, (select auth.uid()), 'takeover.start');
  return query select s.id, s.conference_sid, s.agent_call_sid;
end $$;
revoke execute on function public.redial_takeover(uuid) from public, anon;
grant execute on function public.redial_takeover(uuid) to authenticated;
