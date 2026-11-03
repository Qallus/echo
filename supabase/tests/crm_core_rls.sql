-- CRM security checks (S5a). Run in the Supabase SQL Editor after the
-- 20261102140000_crm_core migration. Acts as a visitor, a customer (B), B as
-- Finance (read-only CRM), B as Support (manages the CRM) and Support without
-- MFA, then ends with RAISE, so nothing is kept. Each line should match the
-- brackets; FAIL is a problem.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; co uuid; ct uuid; dl uuid; closed timestamptz;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b; -- B starts as a customer

  -- Seed one record of each kind (as the table owner, inside this run only)
  insert into public.crm_companies (name, status) values ('RLS Test Co', 'prospect') returning id into co;
  insert into public.crm_contacts (first_name, email, company_id) values ('Rita', 'rita@example.com', co) returning id into ct;
  insert into public.crm_deals (title, company_id, contact_id, value_cents) values ('RLS Test Deal', co, ct, 120000) returning id into dl;
  insert into public.crm_activities (kind, body, deal_id) values ('note', 'Private note', dl);

  -- Signed-out visitor
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform 1 from public.crm_companies; r := r || E'1a visitor reads clients ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1a visitor reads clients denied [ok]\n'; end;
  begin perform public.crm_staff(); r := r || E'1b visitor lists staff ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1b visitor lists staff denied [ok]\n'; end;
  execute 'reset role';

  -- Customer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_companies; r := r || format(E'2a customer sees clients=%s [0]\n', n);
  select count(*) into n from public.crm_contacts; r := r || format(E'2b customer sees contacts=%s [0]\n', n);
  select count(*) into n from public.crm_deals; r := r || format(E'2c customer sees deals=%s [0]\n', n);
  select count(*) into n from public.crm_activities; r := r || format(E'2d customer sees activities=%s [0]\n', n);
  begin
    insert into public.crm_companies (name) values ('Hack Co');
    r := r || E'2e customer adds client ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2e customer adds client denied [ok]\n'; end;
  update public.crm_deals set value_cents = 1 where id = dl; get diagnostics n = row_count;
  r := r || format(E'2f customer edits deal rows=%s [0]\n', n);
  begin perform public.crm_staff(); r := r || E'2g customer lists staff ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2g customer lists staff denied [ok]\n'; end;
  begin perform public.admin_user_by_email('rita@example.com'); r := r || E'2h customer looks up accounts ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2h customer looks up accounts denied [ok]\n'; end;
  execute 'reset role';

  -- B as Finance: can read the CRM, can't change it
  insert into public.platform_staff (user_id, role) values (b, 'finance');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_deals where id = dl; r := r || format(E'3a finance sees deal=%s [1]\n', n);
  update public.crm_deals set stage = 'won' where id = dl; get diagnostics n = row_count;
  r := r || format(E'3b finance edits deal rows=%s [0]\n', n);
  begin
    insert into public.crm_activities (kind, body, deal_id) values ('note', 'x', dl);
    r := r || E'3c finance adds activity ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3c finance adds activity denied [ok]\n'; end;
  select count(*) into n from public.crm_staff(); r := r || format(E'3d finance lists staff=%s [at least 2]\n', n);
  execute 'reset role';

  -- B as Support: manages the CRM
  update public.platform_staff set role = 'support' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.crm_deals set stage = 'won' where id = dl; get diagnostics n = row_count;
  r := r || format(E'4a support moves deal to won rows=%s [1]\n', n);
  select closed_at into closed from public.crm_deals where id = dl;
  r := r || format(E'4b won deal has closed_at=%s [true]\n', closed is not null);
  update public.crm_deals set stage = 'proposal' where id = dl;
  select closed_at into closed from public.crm_deals where id = dl;
  r := r || format(E'4c reopened deal clears closed_at=%s [true]\n', closed is null);
  insert into public.crm_activities (kind, body, contact_id) values ('task', 'Call Rita', ct);
  r := r || E'4d support adds task [ok]\n';
  begin
    update public.crm_deals set created_by = b where id = dl;
    r := r || E'4e support rewrites created_by ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4e support rewrites created_by denied [ok]\n'; end;
  begin
    insert into public.crm_activities (kind, body) values ('note', 'orphan');
    r := r || E'4f activity with no record ALLOWED (FAIL)\n';
  exception when check_violation then r := r || E'4f activity with no record rejected [ok]\n'; end;
  delete from public.crm_companies where id = co; get diagnostics n = row_count;
  r := r || format(E'4g support deletes client rows=%s [1]\n', n);
  select count(*) into n from public.crm_contacts where id = ct and company_id is null;
  r := r || format(E'4h contact kept, unlinked=%s [1]\n', n);
  execute 'reset role';

  -- Support without MFA: nothing
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_contacts; r := r || format(E'5a support without MFA sees contacts=%s [0]\n', n);
  update public.crm_deals set value_cents = 1 where id = dl; get diagnostics n = row_count;
  r := r || format(E'5b support without MFA edits deal rows=%s [0]\n', n);
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
