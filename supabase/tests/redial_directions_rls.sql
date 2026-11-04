-- Redial directions (Audible). Run after 20261104190000_redial_directions.
-- Ends with RAISE, so nothing is kept. Owner A, teammate B.

do $$
declare
  a uuid; b uuid; ws uuid; r text := E'\n'; n int; la uuid; ca uuid; cb uuid; eb text; d uuid; st text;
begin
  select m1.user_id, m2.user_id, m1.workspace_id into a, b, ws from public.workspace_members m1
  join public.workspace_members m2 on m2.workspace_id = m1.workspace_id and m2.user_id <> m1.user_id limit 1;
  if b is null then
    select id into a from public.profiles limit 1;
    select id into b from public.profiles where id <> a limit 1;
    if b is null then raise exception 'Needs at least two users.'; end if;
    insert into public.workspaces (name, created_by) values ('Directions test', a) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner'), (ws, b, 'member') on conflict do nothing;
  end if;
  select email into eb from auth.users where id = b;

  insert into public.redial_lines (owner_id, number) values (a, '+15550000051') returning id into la;
  insert into public.redial_calls (line_id, owner_id, status) values (la, a, 'screening') returning id into ca;
  insert into public.redial_calls (line_id, owner_id, status) values (la, a, 'screening') returning id into cb;
  insert into public.redial_live_sessions (call_id, line_id, conference_name, state, ai_state, taken_over_by) values (cb, la, 'redial-d2', 'live', 'removed', a);

  -- Owner sends one; B (summaries only) can't send or see it
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.redial_direct(ca, '  Ask for their email  '); r := r || E'1a owner sends a direction [ok]\n';
  select text, status into st, st from public.redial_live_directions where id = d; r := r || format(E'1b starts as=%s [sending]\n', st);
  begin perform public.redial_direct(cb, 'Hello'); r := r || E'1c direction after takeover ALLOWED (FAIL)\n';
  exception when others then r := r || E'1c refused once taken over [ok]\n'; end;
  begin perform public.redial_direct(ca, '   '); r := r || E'1d empty direction ALLOWED (FAIL)\n';
  exception when others then r := r || E'1d empty refused [ok]\n'; end;
  begin update public.redial_live_directions set status = 'delivered' where id = d; get diagnostics n = row_count; r := r || format(E'1e marks delivered directly rows=%s (FAIL)\n', n);
  exception when insufficient_privilege then r := r || E'1e can''t mark delivered directly [ok]\n'; end;
  perform public.redial_grant(la, eb, array['read_summary']);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.redial_direct(ca, 'Hi'); r := r || E'2a summaries-only sends ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2a summaries-only can''t send [ok]\n'; end;
  select count(*) into n from public.redial_live_directions where call_id = ca; r := r || format(E'2b summaries-only sees directions=%s [0]\n', n);
  perform public.redial_direction_failed(d);
  execute 'reset role';
  select status into st from public.redial_live_directions where id = d; r := r || format(E'2c someone else can''t mark it failed: still=%s [sending]\n', st);

  -- B given the guide permission
  update public.redial_line_grants set capabilities = array['read_summary', 'direct_agent'] where line_id = la and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_live_directions where call_id = ca; r := r || format(E'3a guide sees directions=%s [1]\n', n);
  perform public.redial_direct(ca, 'Get the address'); r := r || E'3b guide sends [ok]\n';
  execute 'reset role';

  -- Sender marks their own failed; limit of 20
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.redial_direction_failed(d);
  select status into st from public.redial_live_directions where id = d; r := r || format(E'4a sender marks own failed=%s [failed]\n', st);
  for n in 1..18 loop perform public.redial_direct(ca, 'x' || n); end loop;
  begin perform public.redial_direct(ca, 'one too many'); r := r || E'4b 21st direction ALLOWED (FAIL)\n';
  exception when others then r := r || E'4b limit of 20 enforced [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
