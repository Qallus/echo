-- Redial Mirror. Run after 20261104220000_redial_mirror. Ends with RAISE, so
-- nothing is kept. Owner A, teammate B.

do $$
declare
  a uuid; b uuid; ws uuid; r text := E'\n'; n int; la uuid; ca uuid; cb uuid; eb text; g uuid; e uuid; sid text; st text;
begin
  select m1.user_id, m2.user_id, m1.workspace_id into a, b, ws from public.workspace_members m1
  join public.workspace_members m2 on m2.workspace_id = m1.workspace_id and m2.user_id <> m1.user_id limit 1;
  if b is null then
    select id into a from public.profiles limit 1;
    select id into b from public.profiles where id <> a limit 1;
    if b is null then raise exception 'Needs at least two users.'; end if;
    insert into public.workspaces (name, created_by) values ('Mirror test', a) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner'), (ws, b, 'member') on conflict do nothing;
  end if;
  select email into eb from auth.users where id = b;

  insert into public.redial_lines (owner_id, number) values (a, '+15550000071') returning id into la;
  insert into public.redial_calls (line_id, owner_id, status, twilio_sid) values (la, a, 'connected', 'CAmirror1') returning id into ca;
  insert into public.redial_calls (line_id, owner_id, status, twilio_sid) values (la, a, 'screening', 'CAmirror2') returning id into cb;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.redial_mirror_start(ca); r := r || E'1a start while Mirror is off ALLOWED (FAIL)\n';
  exception when others then r := r || E'1a refused while Mirror is off [ok]\n'; end;
  insert into public.redial_mirror_settings (line_id, enabled, allow_sms) values (la, true, true);
  sid := public.redial_mirror_start(ca); r := r || format(E'1b owner starts Mirror, gets caller sid=%s [CAmirror1]\n', sid);
  begin perform public.redial_mirror_start(ca); r := r || E'1c second start ALLOWED (FAIL)\n';
  exception when others then r := r || E'1c already on [ok]\n'; end;
  begin perform public.redial_mirror_start(cb); r := r || E'1d start while only the AI is on ALLOWED (FAIL)\n';
  exception when others then r := r || E'1d needs a person on the call [ok]\n'; end;
  execute 'reset role';

  -- What the webhooks write
  insert into public.redial_mirror_suggestions (call_id, line_id, kind, title, body, source) values (ca, la, 'say', 'Ask about timing', 'Ask when they need it.', 'call') returning id into g;
  insert into public.redial_mirror_suggestions (call_id, line_id, kind, title, body, source, subject) values (ca, la, 'email', 'Email the quote', 'Hi, here is the quote.', 'call', 'Your quote') returning id into e;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_mirror_suggestions where call_id = ca; r := r || format(E'2a owner sees suggestions=%s [2]\n', n);
  begin perform public.redial_mirror_act(e, 'send', 'x@example.com'); r := r || E'2b email while email is off ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b email refused while not allowed [ok]\n'; end;
  begin update public.redial_mirror_suggestions set status = 'sent' where id = g; get diagnostics n = row_count; r := r || format(E'2c marks sent directly rows=%s (FAIL)\n', n);
  exception when insufficient_privilege then r := r || E'2c can''t mark sent directly [ok]\n'; end;
  perform public.redial_mirror_act(g, 'dismiss');
  select status into st from public.redial_mirror_suggestions where id = g; r := r || format(E'2d dismiss=%s [dismissed]\n', st);
  perform public.redial_grant(la, eb, array['read_summary']);
  execute 'reset role';

  -- B without the mirror permission sees nothing and can't act
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_mirror_suggestions where call_id = ca; r := r || format(E'3a no permission sees suggestions=%s [0]\n', n);
  begin perform public.redial_mirror_stop(ca); r := r || E'3b no permission stops Mirror ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3b can''t stop Mirror [ok]\n'; end;
  begin update public.redial_mirror_settings set allow_email = true where line_id = la; get diagnostics n = row_count; r := r || format(E'3c changes settings rows=%s [0]\n', n);
  exception when insufficient_privilege then r := r || E'3c can''t change settings [ok]\n'; end;
  begin perform public.redial_mirror_claim(ca); r := r || E'3d member runs the webhook claim ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3d webhook-only claim refused [ok]\n'; end;
  execute 'reset role';

  -- B with mirror sees suggestions
  update public.redial_line_grants set capabilities = array['read_summary', 'mirror'] where line_id = la and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_mirror_suggestions where call_id = ca; r := r || format(E'4a mirror user sees suggestions=%s [2]\n', n);
  sid := public.redial_mirror_stop(ca); r := r || E'4b mirror user stops Mirror [ok]\n';
  execute 'reset role';
  select state into st from public.redial_mirror_sessions where call_id = ca; r := r || format(E'4c state=%s [stopped]\n', st);

  raise exception 'RESULTS (rolled back): %', r;
end $$;
