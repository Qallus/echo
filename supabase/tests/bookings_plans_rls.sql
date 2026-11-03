-- Bookings, plans and team checks. Run in the Supabase SQL Editor after
-- 20261103140000_bookings_plans. Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; t uuid; p uuid; g uuid; slot timestamptz; bk uuid;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b;
  insert into public.booking_types (name, slug, minutes, min_notice_hours) values ('RLS Discovery', 'rls-discovery', 30, 0) returning id into t;
  insert into public.plans (name) values ('RLS plan') returning id into p;
  insert into public.plan_groups (plan_id, name) values (p, 'To Do') returning id into g;
  insert into public.plan_tasks (plan_id, group_id, title) values (p, g, 'Task one');

  -- Visitor: sees open times and can book, nothing else
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select count(*) into n from public.booking_type_public('rls-discovery'); r := r || format(E'1a visitor sees the type=%s [1]\n', n);
  select min(x.starts_at) into slot from public.booking_slots('rls-discovery', current_date, current_date + 14) x;
  r := r || format(E'1b visitor finds an open time=%s [true, if any weekday hours remain this fortnight]\n', slot is not null);
  if slot is not null then
    bk := public.book_appointment('rls-discovery', slot, 'Bea Booker', 'bea@example.com', '', 'Acme', 'Hello');
    r := r || E'1c visitor books it [ok]\n';
    begin perform public.book_appointment('rls-discovery', slot, 'Second', 'second@example.com', '', '', ''); r := r || E'1d same time booked twice ALLOWED (FAIL)\n';
    exception when others then r := r || E'1d same time booked twice rejected [ok]\n'; end;
  end if;
  begin perform 1 from public.bookings; r := r || E'1e visitor reads bookings ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1e visitor reads bookings denied [ok]\n'; end;
  begin perform 1 from public.plans; r := r || E'1f visitor reads plans ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1f visitor reads plans denied [ok]\n'; end;
  execute 'reset role';
  if bk is not null then
    select count(*) into n from public.crm_contacts where email = 'bea@example.com' and role = 'lead'; r := r || format(E'1g booker saved as a lead=%s [1]\n', n);
    select count(*) into n from public.notifications where type = 'booking' and user_id = a and created_at > now() - interval '1 minute'; r := r || format(E'1h owner notified=%s [1]\n', n);
  end if;

  -- Customer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.bookings; r := r || format(E'2a customer sees bookings=%s [0]\n', n);
  select count(*) into n from public.plan_tasks; r := r || format(E'2b customer sees plan tasks=%s [0]\n', n);
  begin perform public.crm_staff(); r := r || E'2c customer lists staff ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2c customer lists staff denied [ok]\n'; end;
  update public.platform_settings set value = '{}' where key = 'booking_availability'; get diagnostics n = row_count;
  r := r || format(E'2d customer edits availability rows=%s [0]\n', n);
  execute 'reset role';

  -- Finance: reads, can't change
  insert into public.platform_staff (user_id, role) values (b, 'finance');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.plan_tasks where plan_id = p; r := r || format(E'3a finance sees plan tasks=%s [1]\n', n);
  update public.plan_tasks set status = 'complete' where plan_id = p; get diagnostics n = row_count;
  r := r || format(E'3b finance edits a task rows=%s [0]\n', n);
  select count(*) into n from public.crm_staff(); r := r || format(E'3c finance sees the team=%s [at least 2]\n', n);
  execute 'reset role';

  -- Support: works bookings and plans
  update public.platform_staff set role = 'support' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.plan_tasks set status = 'complete' where plan_id = p; get diagnostics n = row_count;
  r := r || format(E'4a support completes a task rows=%s [1]\n', n);
  select count(*) into n from public.plan_tasks where plan_id = p and completed_at is not null; r := r || format(E'4b completed_at set=%s [1]\n', n);
  insert into public.bookings (title, starts_at, ends_at, name) values ('Call', now() + interval '2 days', now() + interval '2 days 30 minutes', 'Sam');
  r := r || E'4c support adds a booking [ok]\n';
  update public.platform_settings set value = value where key = 'booking_availability'; get diagnostics n = row_count;
  r := r || format(E'4d support edits availability rows=%s [1]\n', n);
  begin
    update public.bookings set reminder_sent_at = now();
    r := r || E'4e support marks reminders sent ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4e support marks reminders sent denied (cron only) [ok]\n'; end;
  update public.crm_companies set latitude = 33.4, longitude = -112.0 where false;
  r := r || E'4f support can set map coordinates [ok]\n';
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
