-- App waitlist. Run after 20261104200000_app_waitlist. Ends with RAISE, so
-- nothing is kept.

do $$
declare r text := E'\n'; n int; c record; t text;
begin
  execute 'set local role anon';
  perform public.join_app_waitlist('{"first_name":"Test","last_name":"Person","email":"Waitlist.Test@Example.com","phone":"+14805550199","platforms":["ios"],"products":["redial"],"account_type":"business","company":"Acme","team_size":"2-10","use_case":"Call screening","questions":"When?","consent_sms":true,"consent_call":false,"consent_text":"ok","source_page":"/"}'::jsonb);
  r := r || E'1a visitor joins [ok]\n';
  begin perform public.join_app_waitlist('{"first_name":"","last_name":"P","email":"x@y.co","phone":"+14805550100","platforms":["ios"]}'::jsonb); r := r || E'1b no first name ALLOWED (FAIL)\n';
  exception when others then r := r || E'1b missing name refused [ok]\n'; end;
  begin perform public.join_app_waitlist('{"first_name":"A","last_name":"P","email":"x@y.co","phone":"480","platforms":["ios"]}'::jsonb); r := r || E'1c bad phone ALLOWED (FAIL)\n';
  exception when others then r := r || E'1c bad phone refused [ok]\n'; end;
  begin perform public.join_app_waitlist('{"first_name":"A","last_name":"P","email":"x@y.co","phone":"+14805550100","platforms":[]}'::jsonb); r := r || E'1d no platform ALLOWED (FAIL)\n';
  exception when others then r := r || E'1d no platform refused [ok]\n'; end;
  begin perform public.join_app_waitlist('{"first_name":"Test","last_name":"Person","email":"waitlist.test@example.com","phone":"+14805550199","platforms":["android"]}'::jsonb); r := r || E'1e instant repeat ALLOWED (FAIL)\n';
  exception when others then r := r || E'1e repeat within a minute refused [ok]\n'; end;
  begin select count(*) into n from public.app_waitlist; r := r || E'1f visitor reads list ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1f visitor can''t read the list [ok]\n'; end;
  execute 'reset role';

  select * into c from public.app_waitlist where lower(email) = 'waitlist.test@example.com';
  r := r || format(E'2a saved platforms=%s products=%s type=%s sms=%s call=%s\n', c.platforms, c.products, c.account_type, c.consent_sms, c.consent_call);
  select role || '/' || lead_status || '/' || source || ' tags=' || array_to_string(tags, ',') into t from public.crm_contacts where id = c.contact_id;
  r := r || format(E'2b CRM lead=%s [lead/new/App waitlist]\n', t);

  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.app_waitlist; r := r || format(E'3a signed-in non-staff sees=%s [0]\n', n);
  execute 'reset role';
  raise exception 'RESULTS (rolled back): %', r;
end $$;
