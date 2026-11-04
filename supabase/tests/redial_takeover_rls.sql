-- Redial takeover (Gavel). Run after 20261104181000_redial_takeover_retry.
-- Ends with RAISE, so nothing is kept. Owner A, teammate B.

do $$
declare
  a uuid; b uuid; ws uuid; r text := E'\n'; n int; la uuid; ca uuid; cb uuid; eb text; st text; ai text;
begin
  select m1.user_id, m2.user_id, m1.workspace_id into a, b, ws from public.workspace_members m1
  join public.workspace_members m2 on m2.workspace_id = m1.workspace_id and m2.user_id <> m1.user_id limit 1;
  if b is null then
    select id into a from public.profiles limit 1;
    select id into b from public.profiles where id <> a limit 1;
    if b is null then raise exception 'Needs at least two users.'; end if;
    insert into public.workspaces (name, created_by) values ('Takeover test', a) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner'), (ws, b, 'member') on conflict do nothing;
  end if;
  select email into eb from auth.users where id = b;

  insert into public.redial_lines (owner_id, number) values (a, '+15550000041') returning id into la;
  insert into public.redial_calls (line_id, owner_id, status) values (la, a, 'screening') returning id into ca;
  insert into public.redial_calls (line_id, owner_id, status) values (la, a, 'screening') returning id into cb;
  insert into public.redial_live_sessions (call_id, line_id, conference_name, conference_sid, state, ai_state) values (ca, la, 'redial-t1', 'CFtest1', 'live', 'active');
  insert into public.redial_live_sessions (call_id, line_id, conference_name, state, ai_state) values (cb, la, 'redial-t2', 'ended', 'left');

  -- B can only listen
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.redial_grant(la, eb, array['read_summary', 'monitor_live']);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.redial_takeover(ca); r := r || E'1a listener takes over ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1a listen-only can''t take over [ok]\n'; end;
  execute 'reset role';

  -- Owner takes over
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_takeover(ca); r := r || format(E'2a owner takes over=%s [1]\n', n);
  select count(*) into n from public.redial_takeover(ca); r := r || format(E'2b owner can retry=%s [1]\n', n);
  begin perform public.redial_takeover(cb); r := r || E'2c ended call ALLOWED (FAIL)\n';
  exception when others then r := r || E'2c ended call refused [ok]\n'; end;
  begin update public.redial_live_sessions set taken_over_by = null where call_id = ca; get diagnostics n = row_count; r := r || format(E'2d owner edits session directly rows=%s (FAIL)\n', n);
  exception when insufficient_privilege then r := r || E'2d sessions not writable directly [ok]\n'; end;
  perform public.redial_grant(la, eb, array['read_summary', 'takeover_live']);
  execute 'reset role';

  select s.ai_state, c.status into ai, st from public.redial_live_sessions s join public.redial_calls c on c.id = s.call_id where s.call_id = ca;
  r := r || format(E'3a after takeover ai=%s call=%s [removed/connected]\n', ai, st);
  select count(*) into n from public.redial_live_events where kind = 'takeover.start' and actor_id = a; r := r || format(E'3b takeover logged=%s [1]\n', n);

  -- A second person can't take it from the first
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.redial_takeover(ca); r := r || E'4a second takeover ALLOWED (FAIL)\n';
  exception when others then r := r || E'4a second person refused [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
