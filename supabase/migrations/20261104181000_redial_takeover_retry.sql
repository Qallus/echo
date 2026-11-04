-- redial_takeover(): the person who already took the call over can call it
-- again (to retry silencing and removing the AI); anyone else still can't.

create or replace function public.redial_takeover(p_call uuid)
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
  if s.taken_over_by = (select auth.uid()) then
    return query select s.id, s.conference_sid, s.agent_call_sid;
    return;
  end if;
  if s.taken_over_by is not null then raise exception 'Someone has already taken over this call.' using errcode = 'P0001'; end if;
  if s.ai_state not in ('pending', 'joining', 'active') then raise exception 'The assistant has already left this call.' using errcode = 'P0001'; end if;

  update public.redial_live_sessions set taken_over_by = (select auth.uid()), taken_over_at = now(), ai_state = 'removed' where id = s.id;
  update public.redial_calls set status = 'connected', reason = 'Taken over from the assistant' where id = p_call and status = 'screening';
  insert into public.redial_live_events (session_id, line_id, actor_id, kind) values (s.id, s.line_id, (select auth.uid()), 'takeover.start');
  return query select s.id, s.conference_sid, s.agent_call_sid;
end $$;
