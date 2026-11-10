-- Redial setup flow checks. Run in the Supabase SQL Editor after
-- 20261109160000_redial_setup_flow. Ends with RAISE, so nothing is kept.

do $$
declare a uuid; b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); r text := E'\n'; n int; t text; v_line uuid; ln public.redial_lines;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'flow-test-b@example.test', '{"full_name": "Dana Ortiz", "account_type": "business", "company_name": "Summit Roofing Test"}'),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'flow-test-c@example.test', '{"full_name": "Other Person"}');

  -- A business customer answers and submits.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  insert into public.redial_setups (user_id, step, answers) values (b, 8, jsonb_build_object(
    'about', jsonb_build_object('fullName', 'Dana Ortiz', 'accountType', 'business', 'phone', '+14805550101', 'company', 'Summit Roofing Test', 'teamSize', '2–5'),
    'route', jsonb_build_object('method', 'missed'),
    'screening', jsonb_build_object('mode', 'all', 'vip', jsonb_build_array('+14805550102'), 'block', jsonb_build_array('+14805550103'), 'hours', jsonb_build_object('start', '08:00', 'end', '17:00', 'weekdays', true)),
    'assistant', jsonb_build_object('name', 'Robin', 'voice', 'rex', 'disclose', true, 'about', 'We install roofs.'),
    'after', jsonb_build_object('forwardTo', '+14805550104', 'putThrough', false, 'directory', jsonb_build_array(jsonb_build_object('label', 'Sam', 'number', '+14805550105')))));
  t := public.redial_setup_submit(); r := r || format(E'1a submit returns=%s [submitted]\n', t);
  begin perform public.admin_redial_setups(); select count(*) into n from public.admin_redial_setups(); r := r || format(E'1b customer reads admin queue rows=%s [0]\n', n);
  exception when insufficient_privilege then r := r || E'1b customer reads admin queue denied [ok]\n'; end;
  begin perform public.admin_redial_setup_status(b, 'needs_info', 'x'); r := r || E'1c customer sets status ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1c customer sets status denied [ok]\n'; end;
  begin perform private.redial_setup_apply(b, gen_random_uuid()); r := r || E'1d customer runs apply ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d customer runs apply denied [ok]\n'; end;
  begin perform public.admin_redial_assign('flow-test-b@example.test', '+14805550199', 'x'); r := r || E'1e customer assigns a line ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1e customer assigns a line denied [ok]\n'; end;
  execute 'reset role';

  select count(*) into n from public.crm_contacts where email = 'flow-test-b@example.test' and role = 'lead' and lead_status = 'new' and source = 'Redial setup';
  r := r || format(E'2a CRM lead created=%s [1]\n', n);
  select count(*) into n from public.crm_companies where name = 'Summit Roofing Test'; r := r || format(E'2b company created=%s [1]\n', n);
  select count(*) into n from public.redial_setups s join public.crm_deals d on d.id = s.deal_id where s.user_id = b and d.stage = 'new_working';
  r := r || format(E'2c pipeline deal linked=%s [1]\n', n);

  -- Someone else can't submit theirs (they have none) or see it.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin t := public.redial_setup_submit(); r := r || format(E'3a other customer submit=%s (FAIL)\n', t);
  exception when raise_exception then r := r || E'3a other customer has nothing to submit [ok]\n'; end;
  execute 'reset role';

  -- Staff assign a number: the answers are applied.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.admin_redial_setups() where user_id = b; r := r || format(E'4a staff sees it in the queue=%s [1]\n', n);
  v_line := public.admin_redial_assign('flow-test-b@example.test', '+14805550199', 'Summit');
  execute 'reset role';
  select * into ln from public.redial_lines where id = v_line;
  r := r || format(E'4b line mode=%s name=%s voice=%s connect=%s ring=%s [all Robin rex false +14805550104]\n', ln.mode, ln.assistant_name, ln.voice, ln.allow_connect, ln.forward_to);
  r := r || format(E'4c about has hours=%s [true]\n', ln.about like '%Business hours: 08:00 to 17:00, Monday to Friday.%');
  select count(*) into n from public.redial_list_entries where line_id = v_line; r := r || format(E'4d VIP + block entries=%s [2]\n', n);
  select count(*) into n from public.redial_directory where line_id = v_line; r := r || format(E'4e transfer contacts=%s [1]\n', n);
  select status into t from public.redial_setups where user_id = b; r := r || format(E'4f setup status=%s [active]\n', t);

  raise exception 'RESULTS (rolled back):%', r;
end $$;
