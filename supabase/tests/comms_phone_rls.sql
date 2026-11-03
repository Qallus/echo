-- Texts, calls and automations checks. Run in the Supabase SQL Editor after
-- 20261103120000_comms_phone. Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; c uuid; t uuid; au uuid; roles text[];
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b;
  insert into public.phone_messages (direction, from_number, to_number, body, twilio_sid) values ('inbound', '+14805550142', '+14809999906', 'Hi there', 'SMtest1');
  insert into public.phone_calls (direction, from_number, to_number, status, twilio_sid) values ('inbound', '+14805550142', '+14809999906', 'no-answer', 'CAtest1') returning id into c;
  insert into public.email_templates (name, subject) values ('Auto test', 'Hi') returning id into t;
  select count(*) into n from public.notifications where type = 'phone_message' and user_id = a and created_at > now() - interval '1 minute';
  r := r || format(E'1a owner notified of inbound text=%s [1]\n', n);
  update public.phone_calls set voicemail = true where id = c;
  select count(*) into n from public.notifications where type = 'phone_message' and user_id = a and created_at > now() - interval '1 minute';
  r := r || format(E'1b voicemail notifies too=%s [2]\n', n);
  roles := public.staff_roles_with('comms.manage');
  r := r || format(E'1c roles that take calls=%s [owner, admin, support, marketing]\n', roles);

  -- Customer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.phone_messages; r := r || format(E'2a customer sees texts=%s [0]\n', n);
  select count(*) into n from public.phone_calls; r := r || format(E'2b customer sees calls=%s [0]\n', n);
  begin perform public.staff_roles_with('comms.manage'); r := r || E'2c customer calls staff_roles_with ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2c customer calls staff_roles_with denied [ok]\n'; end;
  begin
    insert into public.phone_messages (direction, from_number, to_number, body) values ('outbound', '+1', '+2', 'x');
    r := r || E'2d customer logs a text ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2d customer logs a text denied [ok]\n'; end;
  execute 'reset role';

  -- Support: texts and calls
  insert into public.platform_staff (user_id, role) values (b, 'support');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.phone_messages where twilio_sid = 'SMtest1'; r := r || format(E'3a support sees inbound text=%s [1]\n', n);
  insert into public.phone_messages (direction, from_number, to_number, body) values ('outbound', '+14809999906', '+14805550142', 'Reply');
  r := r || E'3b support logs an outbound text [ok]\n';
  begin
    insert into public.phone_messages (direction, from_number, to_number, body) values ('inbound', '+1999', '+14809999906', 'fake');
    r := r || E'3c support fakes an inbound text ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3c support fakes an inbound text denied [ok]\n'; end;
  update public.phone_messages set read_at = now() where twilio_sid = 'SMtest1'; get diagnostics n = row_count;
  r := r || format(E'3d support marks a text read rows=%s [1]\n', n);
  update public.phone_calls set notes = 'Called back' where id = c; get diagnostics n = row_count;
  r := r || format(E'3e support adds call notes rows=%s [1]\n', n);
  begin
    update public.phone_calls set transcript = 'fake' where id = c;
    r := r || E'3f support edits a transcript ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3f support edits a transcript denied [ok]\n'; end;
  begin
    insert into public.phone_opt_outs (number) values ('+15555550000');
    r := r || E'3g support writes opt-outs ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3g support writes opt-outs denied (STOP only) [ok]\n'; end;
  insert into public.email_automations (name, trigger, stage, template_id) values ('Proposal follow-up', 'stage_changed', 'proposal', t) returning id into au;
  r := r || E'3h support creates an automation [ok]\n';
  insert into public.email_automation_runs (automation_id, run_key) values (au, 'test:1');
  r := r || E'3i support queues a run [ok]\n';
  begin
    update public.email_automation_runs set status = 'sent' where automation_id = au; get diagnostics n = row_count;
    r := r || format(E'3j support marks a run sent rows=%s [0 or denied]\n', n);
  exception when insufficient_privilege then r := r || E'3j support marks a run sent denied [ok]\n'; end;
  execute 'reset role';

  -- Finance: nothing in comms
  update public.platform_staff set role = 'finance' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.phone_calls; r := r || format(E'4a finance sees calls=%s [0]\n', n);
  select count(*) into n from public.email_automations; r := r || format(E'4b finance sees automations=%s [0]\n', n);
  select count(*) into n from storage.objects where bucket_id = 'call-recordings'; r := r || format(E'4c finance sees recordings=%s [0]\n', n);
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
