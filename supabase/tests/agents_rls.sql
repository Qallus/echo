-- Agent checks. Run in the Supabase SQL Editor after 20261109171000_agents.
-- Ends with RAISE, so nothing is kept.

do $$
declare
  o uuid; ag uuid := gen_random_uuid(); c uuid := gen_random_uuid(); r text := E'\n'; n int; t text; aid uuid; ap uuid; perms text[]; ok boolean;
begin
  select user_id into o from public.platform_staff where role = 'owner' order by created_at limit 1;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (ag, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'agent-0123456789ab@agents.redial.si', '{"full_name": "Test agent"}'),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'agent-test-c@example.test', '{"full_name": "Customer"}');

  -- Owner makes an agent with CRM permissions only.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  aid := public.admin_agent_save(null, ag, '{"name": "Test agent", "harness": "paperclip", "permissions": ["crm.view", "crm.manage"], "key_hint": "rdk_0123456789ab_…abcd"}');
  r := r || format(E'1a owner creates agent [%s]\n', aid is not null);
  begin perform public.admin_agent_save(null, c, '{"name": "x"}'); r := r || E'1b make a non-agent account an agent ALLOWED (FAIL)\n';
  exception when invalid_parameter_value then r := r || E'1b non-agent account refused [ok]\n'; end;
  select count(*) into n from public.admin_list_staff() where user_id = ag; r := r || format(E'1c agent in staff list=%s [0]\n', n);
  execute 'reset role';

  -- The agent (aal1, like a password sign-in) gets exactly those permissions.
  perform set_config('request.jwt.claims', json_build_object('sub', ag, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select permissions into perms from public.my_staff(); r := r || format(E'2a agent permissions=%s [{crm.view,crm.manage}]\n', perms);
  select mfa_verified into ok from public.my_staff(); r := r || format(E'2b agent counts as two-step=%s [true]\n', ok);
  select count(*) into n from public.agents; r := r || format(E'2c agent sees agents=%s [1, itself]\n', n);
  begin perform public.admin_agent_save(aid, null, '{"permissions": ["users.manage"]}'); r := r || E'2d agent raises own permissions ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2d agent raises own permissions denied [ok]\n'; end;
  insert into public.agent_approvals (agent_id, tool, args, summary) values (aid, 'confirm_action', '{}', 'Delete a contact') returning id into ap;
  r := r || E'2e agent asks for approval [ok]\n';
  begin perform public.admin_agent_decide(ap, true); r := r || E'2f agent approves itself ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2f agent approves itself denied [ok]\n'; end;
  update public.agent_approvals set status = 'used' where id = ap; get diagnostics n = row_count; r := r || format(E'2g claim before approval rows=%s [0]\n', n);
  begin update public.agent_approvals set status = 'approved' where id = ap; get diagnostics n = row_count; r := r || format(E'2h agent marks approved rows=%s (FAIL if 1)\n', n);
  exception when insufficient_privilege then r := r || E'2h agent marks approved denied [ok]\n'; end;
  execute 'reset role';
  select count(*) into n from public.notifications where user_id = o and type = 'agent_approval'; r := r || format(E'2i owner notified=%s [>=1]\n', n);

  -- Owner approves; the agent claims it once.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.admin_agent_decide(ap, true); r := r || E'3a owner approves [ok]\n';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ag, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  update public.agent_approvals set status = 'used' where id = ap and status = 'approved'; get diagnostics n = row_count; r := r || format(E'3b claim approved rows=%s [1]\n', n);
  update public.agent_approvals set status = 'used' where id = ap and status = 'approved'; get diagnostics n = row_count; r := r || format(E'3c claim again rows=%s [0]\n', n);
  execute 'reset role';

  -- Paused and expired agents lose their permissions.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.admin_agent_save(aid, null, '{"active": false}');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ag, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select coalesce(cardinality(permissions), 0) into n from public.my_staff(); r := r || format(E'4a paused agent permissions=%s [0]\n', n);
  begin insert into public.agent_approvals (agent_id, tool) values (aid, 'x'); r := r || E'4b paused agent asks ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4b paused agent can''t ask [ok]\n'; end;
  execute 'reset role';
  update public.agents set active = true, expires_at = now() - interval '1 minute' where id = aid;
  perform set_config('request.jwt.claims', json_build_object('sub', ag, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select coalesce(cardinality(permissions), 0) into n from public.my_staff(); r := r || format(E'4c expired agent permissions=%s [0]\n', n);
  execute 'reset role';

  -- A customer sees no agents or approvals.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.agents; r := r || format(E'5a customer sees agents=%s [0]\n', n);
  select count(*) into n from public.agent_approvals; r := r || format(E'5b customer sees approvals=%s [0]\n', n);
  begin perform public.admin_agent_remove(aid); r := r || E'5c customer removes agent ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'5c customer removes agent denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back):%', r;
end $$;
