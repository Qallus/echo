-- Redial live calls. Run after 20261104170000_redial_live. Ends with RAISE,
-- so nothing is kept. Owner A, teammate B (temporary Business workspace if
-- needed), outsider C if there is a third user.

do $$
declare
  a uuid; b uuid; c uuid; ws uuid; r text := E'\n'; n int; la uuid; ca uuid; s uuid; eb text;
begin
  select m1.user_id, m2.user_id, m1.workspace_id into a, b, ws from public.workspace_members m1
  join public.workspace_members m2 on m2.workspace_id = m1.workspace_id and m2.user_id <> m1.user_id limit 1;
  if b is null then
    select id into a from public.profiles limit 1;
    select id into b from public.profiles where id <> a limit 1;
    if b is null then raise exception 'Needs at least two users.'; end if;
    insert into public.workspaces (name, created_by) values ('Live test', a) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner'), (ws, b, 'member') on conflict do nothing;
  end if;
  select id into c from public.profiles where id not in (a, b)
    and not exists (select 1 from public.workspace_members x join public.workspace_members y on y.workspace_id = x.workspace_id where x.user_id = a and y.user_id = profiles.id)
  limit 1;
  select email into eb from auth.users where id = b;

  -- What the webhooks write (service role)
  insert into public.redial_lines (owner_id, number) values (a, '+15550000031') returning id into la;
  insert into public.redial_calls (line_id, owner_id, status) values (la, a, 'screening') returning id into ca;
  insert into public.redial_live_sessions (call_id, line_id, conference_name, state, ai_state) values (ca, la, 'redial-test', 'live', 'active') returning id into s;
  insert into public.redial_live_participants (session_id, line_id, role, call_sid) values (s, la, 'caller', 'CAtest1'), (s, la, 'agent', 'CAtest2');
  insert into public.redial_live_events (session_id, line_id, kind) values (s, la, 'conference.start');
  insert into public.redial_live_turns (call_id, line_id, role, text) values (ca, la, 'caller', 'Hi'), (ca, la, 'assistant', 'Hello');

  -- Owner
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_live_sessions where id = s; r := r || format(E'1a owner sees the session=%s [1]\n', n);
  select count(*) into n from public.redial_live_participants where session_id = s; r := r || format(E'1b owner sees participants=%s [2]\n', n);
  select count(*) into n from public.redial_live_events where session_id = s; r := r || format(E'1c owner sees events=%s [1]\n', n);
  select count(*) into n from public.redial_live_turns where call_id = ca; r := r || format(E'1d owner sees live transcript=%s [2]\n', n);
  begin insert into public.redial_live_turns (call_id, line_id, role, text) values (ca, la, 'caller', 'fake'); r := r || E'1e owner writes transcript ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1e owner can''t write live data [ok]\n'; end;
  begin update public.redial_lines set live_routing = true where id = la; r := r || E'1f owner turns on routing ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1f owner can''t change routing (staff only) [ok]\n'; end;
  perform public.redial_grant(la, eb, array['read_summary']);
  execute 'reset role';

  -- Teammate with summaries only
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_live_sessions where id = s; r := r || format(E'2a teammate sees the session=%s [1]\n', n);
  select count(*) into n from public.redial_live_participants where session_id = s; r := r || format(E'2b teammate sees participants=%s [2]\n', n);
  select count(*) into n from public.redial_live_turns where call_id = ca; r := r || format(E'2c teammate sees live transcript=%s [0]\n', n);
  if private.staff_can('users.manage') then r := r || E'2d skipped: B is staff\n';
  else
    begin perform public.admin_redial_set_routing(la, true); r := r || E'2d non-staff sets routing ALLOWED (FAIL)\n';
    exception when insufficient_privilege then r := r || E'2d non-staff can''t set routing [ok]\n'; end;
  end if;
  execute 'reset role';

  -- Teammate given transcripts
  update public.redial_line_grants set capabilities = array['read_summary', 'read_transcript'] where line_id = la and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_live_turns where call_id = ca; r := r || format(E'3a teammate with transcripts sees it=%s [2]\n', n);
  execute 'reset role';

  if c is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.redial_live_sessions where line_id = la; r := r || format(E'4a outsider sees sessions=%s [0]\n', n);
    select count(*) into n from public.redial_live_turns where line_id = la; r := r || format(E'4b outsider sees transcript=%s [0]\n', n);
    execute 'reset role';
  end if;

  raise exception 'RESULTS (rolled back): %', r;
end $$;
