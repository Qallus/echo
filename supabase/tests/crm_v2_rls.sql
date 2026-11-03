-- CRM v2 checks (pipeline stages, history, stage setup, lead fields). Run in
-- the Supabase SQL Editor after 20261103090000_crm_v2. Ends with RAISE, so
-- nothing is kept. Each line should match the brackets; FAIL is a problem.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; ct uuid; dl uuid; t timestamptz; s text;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b;

  insert into public.crm_contacts (first_name, role, lead_status) values ('Lena', 'lead', 'new') returning id into ct;
  insert into public.crm_deals (title, contact_id) values ('V2 Test Deal', ct) returning id into dl;

  select stage into s from public.crm_deals where id = dl;
  r := r || format(E'1a new deal starts at=%s [new_working]\n', s);
  select count(*) into n from public.crm_deal_history where deal_id = dl and kind = 'stage';
  r := r || format(E'1b history row on create=%s [1]\n', n);

  -- Customer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_deal_history; r := r || format(E'2a customer sees history=%s [0]\n', n);
  begin
    insert into public.crm_deal_history (deal_id, kind, stage) values (dl, 'stage', 'closed_won');
    r := r || E'2b customer writes history ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b customer writes history denied [ok]\n'; end;
  update public.platform_settings set value = '{"x":1}' where key = 'crm_stages'; get diagnostics n = row_count;
  r := r || format(E'2c customer edits stage setup rows=%s [0]\n', n);
  execute 'reset role';

  -- Finance: reads the CRM, can't change stage setup
  insert into public.platform_staff (user_id, role) values (b, 'finance');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_deal_history where deal_id = dl; r := r || format(E'3a finance sees history=%s [1]\n', n);
  update public.platform_settings set value = '{"x":1}' where key = 'crm_stages'; get diagnostics n = row_count;
  r := r || format(E'3b finance edits stage setup rows=%s [0]\n', n);
  execute 'reset role';

  -- Support: works the deal
  update public.platform_staff set role = 'support' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.crm_deals set stage = 'qualified', probability = 35, owner_id = b, checklist = '{"new_working:outreach": true}' where id = dl; get diagnostics n = row_count;
  r := r || format(E'4a support moves deal and ticks a step rows=%s [1]\n', n);
  select count(*) into n from public.crm_deal_history where deal_id = dl;
  r := r || format(E'4b history now=%s [3: created, stage, owner]\n', n);
  select actor::text into s from public.crm_deal_history where deal_id = dl and kind = 'owner';
  r := r || format(E'4c owner change recorded by support=%s [true]\n', s = b::text);
  update public.crm_deals set stage = 'closed_won' where id = dl;
  select closed_at into t from public.crm_deals where id = dl;
  r := r || format(E'4d closed_won sets closed_at=%s [true]\n', t is not null);
  begin
    update public.crm_deals set stage = 'won' where id = dl;
    r := r || E'4e old stage name ALLOWED (FAIL)\n';
  exception when check_violation then r := r || E'4e old stage name rejected [ok]\n'; end;
  update public.platform_settings set value = '{}' where key = 'crm_stages'; get diagnostics n = row_count;
  r := r || format(E'4f support edits stage setup rows=%s [1]\n', n);
  update public.crm_contacts set lead_status = 'in_pipeline', role = 'prospect', city = 'Phoenix' where id = ct; get diagnostics n = row_count;
  r := r || format(E'4g support updates lead fields rows=%s [1]\n', n);
  insert into public.crm_activities (kind, body, direction, duration_seconds, contact_id) values ('call', 'Discovery call', 'outbound', 600, ct);
  r := r || E'4h support logs a call [ok]\n';
  begin
    insert into public.crm_activities (kind, body, contact_id, external_id) values ('sms', 'x', ct, 'SM123');
    r := r || E'4i support sets external_id ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4i support sets external_id denied (webhooks only) [ok]\n'; end;
  begin
    update public.crm_activities set transcript = 'fake' where contact_id = ct;
    r := r || E'4j support edits transcript ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4j support edits transcript denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
