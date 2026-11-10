-- MCP phase 2 (CRM and operations) checks: the writes the new resource and
-- action tools make, as an owner, a read-only analyst and a customer.
-- Run in the Supabase SQL Editor. Ends with RAISE, so nothing is kept.

do $$
declare
  o uuid; an uuid := gen_random_uuid(); c uuid := gen_random_uuid(); r text := E'\n'; n int; t text;
  bk uuid; ev uuid; pl uuid; tk uuid; wd uuid; dl uuid; ct uuid; ac uuid; rows jsonb;
begin
  select user_id into o from public.platform_staff where role = 'owner' order by created_at limit 1;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (an, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2-analyst@example.test', '{"full_name": "Analyst"}'),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2-customer@example.test', '{"full_name": "Customer"}');
  insert into public.platform_staff (user_id, role) values (an, 'analyst');

  -- Owner (two-step): every phase 2 write.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  insert into public.crm_contacts (first_name, email, role, lead_status) values ('P2', 'p2-lead@example.test', 'lead', 'new') returning id into ct;
  insert into public.bookings (title, starts_at, ends_at, name, email, contact_id, status)
  values ('Intro call', now() + interval '1 day', now() + interval '1 day 30 minutes', 'P2', 'p2-lead@example.test', ct, 'pending') returning id into bk;
  update public.bookings set status = 'confirmed' where id = bk; get diagnostics n = row_count; r := r || format(E'1a booking created and confirmed rows=%s [1]\n', n);
  insert into public.events (title, slug, starts_at, ends_at) values ('Launch', 'p2-launch', now() + interval '7 days', now() + interval '7 days 1 hour') returning id into ev;
  insert into public.event_registrations (event_id, name, email, contact_id) values (ev, 'P2', 'p2-lead@example.test', ct);
  r := r || E'1b event and registration [ok]\n';
  insert into public.plans (name) values ('P2 plan') returning id into pl;
  insert into public.plan_groups (plan_id, name, position) values (pl, 'To do', 0);
  insert into public.plan_tasks (plan_id, title, checklist, labels) values (pl, 'First task', '[{"id":"a","title":"Sub","done":false}]', '{x}') returning id into tk;
  update public.plan_tasks set status = 'complete' where id = tk;
  select (completed_at is not null)::text into t from public.plan_tasks where id = tk; r := r || format(E'1c plan task completed, completed_at set=%s [true]\n', t);
  insert into public.workspace_docs (title, content, content_text, visibility) values ('P2 doc', '{"type":"doc","content":[]}', 'hello', 'team') returning id into wd;
  insert into public.workspace_comments (doc_id, body) values (wd, 'Looks good');
  update public.workspace_comments set resolved = true where doc_id = wd; get diagnostics n = row_count; r := r || format(E'1d doc, comment resolved rows=%s [1]\n', n);
  insert into public.doc_folders (name) values ('P2 folder');
  insert into public.saved_reports (name, kind, range, shared) values ('P2 report', 'pipeline_by_stage', '90d', false);
  r := r || E'1e folder and saved report [ok]\n';
  insert into public.crm_activities (kind, body, contact_id, due_at) values ('task', 'Call back', ct, now()) returning id into ac;
  update public.crm_activities set done_at = now() where id = ac; get diagnostics n = row_count; r := r || format(E'1f task done rows=%s [1]\n', n);
  insert into public.crm_deals (title, stage, probability, contact_id) values ('P2 deal', 'new_working', 10, ct) returning id into dl;
  update public.crm_deals set checklist = '{"new_working:owner": true}' where id = dl;
  update public.crm_deals set stage = 'contacted', probability = 20 where id = dl; get diagnostics n = row_count; r := r || format(E'1g deal step ticked and moved rows=%s [1]\n', n);
  select count(*) into n from public.crm_deal_history where deal_id = dl and kind = 'stage'; r := r || format(E'1h stage history rows=%s [>=1]\n', n);
  select coalesce(jsonb_agg(x), '[]') into rows from public.admin_report('pipeline_by_stage', current_date - 90, current_date) x;
  r := r || format(E'1i admin_report rows=%s [>=1]\n', jsonb_array_length(rows));
  select count(*) into n from public.admin_series('leads', 'day', current_date - 6, current_date); r := r || format(E'1j admin_series points=%s [7]\n', n);
  perform public.admin_audit('crm.deal.step', 'crm_deal', dl::text, '{"via": "mcp"}');
  update public.card_leads set status = 'contacted' where false;
  update public.app_waitlist set status = 'notified' where false;
  r := r || E'1k audit, card lead and waitlist updates allowed [ok]\n';
  begin update public.crm_activities set kind = 'call' where id = ac; r := r || E'1l change activity kind ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1l activity kind is fixed after create [ok]\n'; end;
  begin update public.event_registrations set event_id = ev where event_id = ev; r := r || E'1m move registration to another event ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1m registration event is fixed [ok]\n'; end;
  begin insert into public.workspace_comments (doc_id, body, resolved) values (wd, 'x', true); r := r || E'1n create resolved comment ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1n comments start open [ok]\n'; end;
  execute 'reset role';

  -- Analyst: reads reports, can't change the CRM, plans or bookings.
  perform set_config('request.jwt.claims', json_build_object('sub', an, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  insert into public.saved_reports (name, kind, range, shared) values ('Analyst report', 'usage', '30d', false);
  r := r || E'2a analyst saves a report [ok]\n';
  begin insert into public.bookings (title, starts_at, ends_at, name) values ('x', now(), now() + interval '1 hour', 'x'); r := r || E'2b analyst books ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b analyst can''t book [ok]\n'; end;
  begin insert into public.plans (name) values ('x'); r := r || E'2c analyst makes a plan ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2c analyst can''t make plans [ok]\n'; end;
  update public.crm_deals set stage = 'qualified' where id = dl; get diagnostics n = row_count; r := r || format(E'2d analyst moves deal rows=%s [0]\n', n);
  select count(*) into n from public.saved_reports where name = 'P2 report'; r := r || format(E'2e analyst sees owner''s private report=%s [0]\n', n);
  execute 'reset role';

  -- Customer: sees none of it.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select (select count(*) from public.bookings) + (select count(*) from public.plans) + (select count(*) from public.workspace_docs)
    + (select count(*) from public.app_waitlist) + (select count(*) from public.crm_activities) + (select count(*) from public.events) into n;
  r := r || format(E'3a customer sees bookings, plans, docs, waitlist, activities, events=%s [0]\n', n);
  begin insert into public.plan_tasks (plan_id, title) values (pl, 'x'); r := r || E'3b customer adds a task ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3b customer can''t add tasks [ok]\n'; end;
  begin perform public.admin_report('pipeline_by_stage', current_date - 30, current_date); r := r || E'3c customer runs a report ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3c customer can''t run reports [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back):%', r;
end $$;
