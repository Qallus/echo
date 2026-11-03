-- Communications checks (templates, sends, unsubscribes, inbox, contact form,
-- staff notification access). Run in the Supabase SQL Editor after
-- 20261103110000_comms_email. Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; t uuid; m uuid;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b;
  insert into public.email_templates (name, subject) values ('RLS test', 'Hi') returning id into t;
  insert into public.email_unsubscribes (email) values ('gone@example.com');

  -- Visitor: can use the contact form, nothing else
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  perform public.submit_contact_form('Vera Visitor', 'vera@example.com', '', 'Acme', 'Sales', 'Hello there');
  r := r || E'1a visitor submits contact form [ok]\n';
  begin perform 1 from public.inbox_messages; r := r || E'1b visitor reads inbox ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1b visitor reads inbox denied [ok]\n'; end;
  begin perform public.submit_contact_form('', 'x@example.com', '', '', '', 'hi'); r := r || E'1c form without name ALLOWED (FAIL)\n';
  exception when others then r := r || E'1c form without name rejected [ok]\n'; end;
  for i in 1..4 loop perform public.submit_contact_form('Vera', 'vera@example.com', '', '', '', 'again'); end loop;
  begin perform public.submit_contact_form('Vera', 'vera@example.com', '', '', '', 'sixth'); r := r || E'1d sixth message in an hour ALLOWED (FAIL)\n';
  exception when others then r := r || E'1d sixth message in an hour rejected [ok]\n'; end;
  execute 'reset role';
  select id into m from public.inbox_messages where from_email = 'vera@example.com' order by created_at limit 1;
  select count(*) into n from public.notifications where type = 'inbox_message' and user_id = a and created_at > now() - interval '1 minute';
  r := r || format(E'1e owner notified of form messages=%s [5]\n', n);

  -- Customer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.inbox_messages; r := r || format(E'2a customer sees inbox=%s [0]\n', n);
  select count(*) into n from public.email_templates; r := r || format(E'2b customer sees templates=%s [0]\n', n);
  select count(*) into n from public.email_unsubscribes; r := r || format(E'2c customer sees unsubscribes=%s [0]\n', n);
  select count(*) into n from public.notifications where user_id <> b; r := r || format(E'2d customer sees others'' notifications=%s [0]\n', n);
  begin
    insert into public.email_unsubscribes (email) values ('x@example.com');
    r := r || E'2e customer writes unsubscribes ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2e customer writes unsubscribes denied [ok]\n'; end;
  execute 'reset role';

  -- Finance: no communications
  insert into public.platform_staff (user_id, role) values (b, 'finance');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.inbox_messages; r := r || format(E'3a finance sees inbox=%s [0]\n', n);
  execute 'reset role';

  -- Marketing: works communications
  update public.platform_staff set role = 'marketing' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.inbox_messages where from_email = 'vera@example.com'; r := r || format(E'4a marketing sees inbox=%s [5]\n', n);
  update public.inbox_messages set status = 'archived' where id = m; get diagnostics n = row_count;
  r := r || format(E'4b marketing archives a message rows=%s [1]\n', n);
  begin
    update public.inbox_messages set body = 'edited' where id = m;
    r := r || E'4c marketing edits message body ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4c marketing edits message body denied [ok]\n'; end;
  update public.email_templates set subject = 'Hello {{first_name}}' where id = t; get diagnostics n = row_count;
  r := r || format(E'4d marketing edits a template rows=%s [1]\n', n);
  insert into public.email_sends (template_id, to_email, subject, status) values (t, 'vera@example.com', 'Hi', 'sent');
  r := r || E'4e marketing logs a send [ok]\n';
  begin
    insert into public.email_unsubscribes (email) values ('y@example.com');
    r := r || E'4f marketing adds an unsubscribe ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4f marketing adds an unsubscribe denied (link only) [ok]\n'; end;
  select count(*) into n from public.notifications where user_id <> b; r := r || format(E'4g marketing reads others'' notifications=%s [0, no notifications.view]\n', n);
  execute 'reset role';

  -- Support: notifications.view, so the delivery log can show titles
  update public.platform_staff set role = 'support' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.notifications where user_id = a and type = 'inbox_message';
  r := r || format(E'5a support reads notification titles=%s [at least 5]\n', n);
  begin
    update public.notifications set read_at = now() where user_id = a;
    get diagnostics n = row_count;
    r := r || format(E'5b support marks others'' notifications read rows=%s [0]\n', n);
  exception when insufficient_privilege then r := r || E'5b support marks others'' notifications read denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
