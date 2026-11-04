-- Batch D checks: analytics, reports, saved reports, automation rules and
-- organization settings. Run in the Supabase SQL Editor after
-- 20261104110000_batch_d. Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; j jsonb; lead_rule uuid; stage_rule uuid; off_rule uuid; c uuid; d uuid;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b;
  update public.platform_settings set value = '{"requireMfa": true}' where key = 'admin_security';

  insert into public.automation_rules (name, trigger, actions, created_by) values ('RLS lead rule', 'lead_created', '[{"type": "notify_staff", "userId": "owner", "title": "x"}]', a) returning id into lead_rule;
  insert into public.automation_rules (name, trigger, stage, actions, created_by) values ('RLS proposal rule', 'stage_changed', 'proposal', '[{"type": "create_task", "title": "x", "dueInDays": 1}]', a) returning id into stage_rule;
  insert into public.automation_rules (name, trigger, enabled, actions, created_by) values ('RLS off rule', 'lead_created', false, '[{"type": "webhook", "url": "https://example.com"}]', a) returning id into off_rule;
  insert into public.saved_reports (name, kind, created_by) values ('RLS private', 'win_loss', a), ('RLS shared', 'revenue', a);
  update public.saved_reports set shared = true where name = 'RLS shared';

  -- Triggers queue runs
  insert into public.crm_contacts (first_name, role) values ('Rita', 'lead') returning id into c;
  select count(*) into n from public.automation_rule_runs where rule_id = lead_rule and contact_id = c; r := r || format(E'1a new lead queues the lead rule=%s [1]\n', n);
  select count(*) into n from public.automation_rule_runs where rule_id = off_rule; r := r || format(E'1b a rule that is off queues nothing=%s [0]\n', n);
  insert into public.crm_deals (title, contact_id) values ('RLS deal', c) returning id into d;
  update public.crm_deals set stage = 'qualified' where id = d;
  select count(*) into n from public.automation_rule_runs where rule_id = stage_rule; r := r || format(E'1c move to another stage queues nothing=%s [0]\n', n);
  update public.crm_deals set stage = 'proposal' where id = d;
  select count(*) into n from public.automation_rule_runs where rule_id = stage_rule and deal_id = d; r := r || format(E'1d move to Proposal queues the stage rule=%s [1]\n', n);
  update public.crm_contacts set role = 'lead', first_name = 'Rita B' where id = c;
  select count(*) into n from public.automation_rule_runs where rule_id = lead_rule; r := r || format(E'1e editing the lead does not queue again=%s [1]\n', n);

  -- Visitor
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform public.admin_series('signups', 'day', current_date - 7, current_date); r := r || E'2a visitor reads analytics ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2a visitor reads analytics denied [ok]\n'; end;
  foreach j in array array['"saved_reports"', '"automation_rules"', '"automation_rule_runs"']::jsonb[] loop
    begin execute format('select count(*) from public.%I', j #>> '{}') into n; r := r || format(E'2b visitor reads %s ALLOWED (FAIL)\n', j #>> '{}');
    exception when insufficient_privilege then r := r || format(E'2b visitor reads %s denied [ok]\n', j #>> '{}'); end;
  end loop;
  execute 'reset role';

  -- Customer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin perform public.admin_series('signups', 'day', current_date - 7, current_date); r := r || E'3a customer reads analytics ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3a customer reads analytics denied [ok]\n'; end;
  begin perform public.admin_report('revenue', current_date - 7, current_date); r := r || E'3b customer reads a report ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3b customer reads a report denied [ok]\n'; end;
  select count(*) into n from public.automation_rules; r := r || format(E'3c customer sees rules=%s [0]\n', n);
  select count(*) into n from public.saved_reports; r := r || format(E'3d customer sees saved reports=%s [0]\n', n);
  begin insert into public.automation_rules (name, trigger, actions) values ('Sneaky', 'lead_created', '[{"type": "webhook", "url": "https://x.io"}]'); r := r || E'3e customer adds a rule ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3e customer adds a rule denied [ok]\n'; end;
  update public.platform_settings set value = '{}' where key = 'organization'; get diagnostics n = row_count; r := r || format(E'3f customer edits organization rows=%s [0]\n', n);
  execute 'reset role';

  -- Finance: analytics, revenue and CRM; no communications or rules
  insert into public.platform_staff (user_id, role) values (b, 'finance');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.admin_series('revenue', 'month', current_date - 90, current_date); r := r || format(E'4a finance reads revenue months=%s [>0]\n', n);
  begin perform public.admin_series('calls', 'day', current_date - 7, current_date); r := r || E'4b finance reads call volume ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4b finance reads call volume denied [ok]\n'; end;
  begin perform public.admin_report('comms_activity', current_date - 7, current_date); r := r || E'4c finance reads the comms report ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4c finance reads the comms report denied [ok]\n'; end;
  j := public.admin_report('pipeline_by_stage', current_date - 7, current_date); r := r || format(E'4d finance reads pipeline by stage rows=%s [9]\n', jsonb_array_length(j));
  select count(*) into n from public.saved_reports where name like 'RLS%'; r := r || format(E'4e finance sees only the shared report=%s [1]\n', n);
  insert into public.saved_reports (name, kind) values ('Finance view', 'revenue'); r := r || E'4f finance saves its own report [ok]\n';
  delete from public.saved_reports where name = 'RLS shared'; get diagnostics n = row_count; r := r || format(E'4g finance deletes the owner''s report rows=%s [0]\n', n);
  select count(*) into n from public.automation_rules; r := r || format(E'4h finance sees rules=%s [0]\n', n);
  j := public.admin_dashboard(); r := r || format(E'4i finance dashboard has no inbox count=%s [true]\n', j -> 'inbox_unread' = 'null'::jsonb);
  execute 'reset role';

  -- Support: communications and rules; no analytics or settings
  update public.platform_staff set role = 'support' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin perform public.admin_series('signups', 'day', current_date - 7, current_date); r := r || E'5a support reads analytics ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'5a support reads analytics denied [ok]\n'; end;
  select count(*) into n from public.automation_rules where name like 'RLS%'; r := r || format(E'5b support sees rules=%s [3]\n', n);
  insert into public.automation_rules (name, trigger, actions) values ('Support rule', 'booking_created', '[{"type": "notify_staff", "userId": "owner", "title": "Booked"}]');
  r := r || E'5c support adds a rule [ok]\n';
  update public.automation_rules set enabled = false where id = lead_rule; get diagnostics n = row_count; r := r || format(E'5d support turns a rule off rows=%s [1]\n', n);
  begin update public.automation_rules set runs = 999 where id = lead_rule; r := r || E'5e support edits the run count ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'5e support edits the run count denied [ok]\n'; end;
  begin update public.automation_rule_runs set status = 'done' where rule_id = lead_rule; r := r || E'5f support edits a run ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'5f support edits a run denied [ok]\n'; end;
  insert into public.automation_rule_runs (rule_id, run_key, deal_id) values (stage_rule, 'manual:test', d); r := r || E'5g support queues a test run [ok]\n';
  update public.platform_settings set value = '{}' where key = 'organization'; get diagnostics n = row_count; r := r || format(E'5h support edits organization rows=%s [0]\n', n);
  execute 'reset role';

  -- Owner edits organization; staff without MFA are denied
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.platform_settings set value = value || '{"phone": "480"}' where key = 'organization'; get diagnostics n = row_count; r := r || format(E'6a owner edits organization rows=%s [1]\n', n);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.admin_series('signups', 'day', current_date - 7, current_date); r := r || E'6b owner without MFA reads analytics ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'6b owner without MFA reads analytics denied [ok]\n'; end;
  select count(*) into n from public.automation_rules; r := r || format(E'6c owner without MFA sees rules=%s [0]\n', n);
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
