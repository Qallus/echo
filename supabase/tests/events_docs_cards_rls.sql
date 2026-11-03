-- Events, documents, workspace and business card checks. Run in the Supabase
-- SQL Editor after 20261103150000_events and 20261103160000_docs_cards.
-- Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; s text; ev uuid; team uuid; priv uuid; card uuid; theirs uuid;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b;
  insert into public.events (title, slug, starts_at, ends_at, capacity, status) values ('RLS Workshop', 'rls-workshop', now() + interval '3 days', now() + interval '3 days 2 hours', 3, 'published') returning id into ev;
  insert into public.events (title, slug, starts_at, ends_at, status) values ('RLS Draft', 'rls-draft', now() + interval '5 days', now() + interval '7 days', 'draft');
  insert into public.documents (name, path, size) values ('contract.pdf', 'rls/contract.pdf', 100);
  insert into public.workspace_docs (title, visibility, created_by) values ('Team page', 'team', a) returning id into team;
  insert into public.workspace_docs (title, visibility, created_by) values ('Owner private', 'private', a) returning id into priv;
  insert into public.business_cards (slug, full_name, owner_id, email) values ('rls-card', 'Casey Card', a, 'casey@example.com') returning id into card;

  -- Visitor: public event and card functions only
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select count(*) into n from public.events_public('rls-workshop'); r := r || format(E'1a visitor sees the published event=%s [1]\n', n);
  select count(*) into n from public.events_public('rls-draft'); r := r || format(E'1b visitor sees the draft=%s [0]\n', n);
  s := public.event_register('rls-workshop', 'Rae Reg', 'rae@example.com', '', 'Acme', 2); r := r || format(E'1c visitor registers=%s [registered]\n', s);
  s := public.event_register('rls-workshop', 'Rae Reg', 'RAE@example.com', '', '', 1); r := r || format(E'1d same email again=%s [already]\n', s);
  begin perform public.event_register('rls-workshop', 'Too Many', 'many@example.com', '', '', 2); r := r || E'1e over capacity ALLOWED (FAIL)\n';
  exception when others then r := r || E'1e over capacity rejected [ok]\n'; end;
  begin perform public.event_register('rls-draft', 'Dee', 'dee@example.com', '', '', 1); r := r || E'1f register for a draft ALLOWED (FAIL)\n';
  exception when others then r := r || E'1f register for a draft rejected [ok]\n'; end;
  select spots_left into n from public.events_public('rls-workshop'); r := r || format(E'1g spots left=%s [1]\n', n);
  select count(*) into n from public.card_public('rls-card'); r := r || format(E'1h visitor opens the card=%s [1]\n', n);
  perform public.card_track('rls-card', 'view', 'test');
  perform public.card_track('rls-card', 'lead', 'forged');
  perform public.card_lead('rls-card', 'Lee Lead', 'lee@example.com', '', 'Lee Co', 'Hi');
  r := r || E'1i visitor views the card and shares details [ok]\n';
  foreach s in array array['events', 'event_registrations', 'documents', 'doc_folders', 'workspace_docs', 'business_cards', 'card_leads', 'card_events'] loop
    begin execute format('select count(*) from public.%I', s) into n; r := r || format(E'1j visitor reads %s ALLOWED (FAIL)\n', s);
    exception when insufficient_privilege then r := r || format(E'1j visitor reads %s denied [ok]\n', s); end;
  end loop;
  execute 'reset role';
  select count(*) into n from public.crm_contacts where email = 'rae@example.com' and source = 'Event'; r := r || format(E'1k registrant saved as a lead=%s [1]\n', n);
  select count(*) into n from public.card_events where card_id = card and kind = 'view'; r := r || format(E'1l card view counted=%s [1]\n', n);
  select count(*) into n from public.card_events where card_id = card and detail = 'forged'; r := r || format(E'1m forged lead event ignored=%s [0]\n', n);
  select count(*) into n from public.crm_contacts where email = 'lee@example.com' and owner_id = a; r := r || format(E'1n card lead owned by the card owner=%s [1]\n', n);
  select count(*) into n from public.notifications where type = 'card_lead' and user_id = a and created_at > now() - interval '1 minute'; r := r || format(E'1o card owner notified=%s [1]\n', n);

  -- Customer: nothing
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.events; r := r || format(E'2a customer sees events=%s [0]\n', n);
  select count(*) into n from public.documents; r := r || format(E'2b customer sees documents=%s [0]\n', n);
  select count(*) into n from public.workspace_docs; r := r || format(E'2c customer sees workspace pages=%s [0]\n', n);
  select count(*) into n from public.business_cards; r := r || format(E'2d customer sees cards=%s [0]\n', n);
  begin insert into public.workspace_docs (title) values ('Sneaky'); r := r || E'2e customer adds a page ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2e customer adds a page denied [ok]\n'; end;
  execute 'reset role';

  -- Finance (crm.view only): reads team things, writes only its own
  insert into public.platform_staff (user_id, role) values (b, 'finance');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.event_registrations where event_id = ev; r := r || format(E'3a finance sees registrations=%s [1]\n', n);
  update public.events set title = 'x' where id = ev; get diagnostics n = row_count; r := r || format(E'3b finance edits an event rows=%s [0]\n', n);
  select count(*) into n from public.documents where path = 'rls/contract.pdf'; r := r || format(E'3c finance sees documents=%s [1]\n', n);
  update public.documents set name = 'x' where path = 'rls/contract.pdf'; get diagnostics n = row_count; r := r || format(E'3d finance renames a document rows=%s [0]\n', n);
  select count(*) into n from public.workspace_docs where id in (team, priv); r := r || format(E'3e finance sees team page, not the private one=%s [1]\n', n);
  update public.workspace_docs set title = 'x' where id = team; get diagnostics n = row_count; r := r || format(E'3f finance edits a team page rows=%s [0]\n', n);
  insert into public.workspace_docs (title, visibility) values ('Finance notes', 'private');
  update public.workspace_docs set title = 'Finance notes v2' where created_by = b; get diagnostics n = row_count; r := r || format(E'3g finance edits its own page rows=%s [1]\n', n);
  insert into public.workspace_comments (doc_id, body) values (team, 'Looks good'); r := r || E'3h finance comments on a team page [ok]\n';
  begin insert into public.workspace_comments (doc_id, body) values (priv, 'Peek'); r := r || E'3i finance comments on a private page ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3i finance comments on a private page denied [ok]\n'; end;
  insert into public.business_cards (slug, full_name, owner_id) values ('rls-finance', 'Fin Ance', b) returning id into theirs;
  r := r || E'3j finance creates its own card [ok]\n';
  begin insert into public.business_cards (slug, full_name, owner_id) values ('rls-other', 'Other', a); r := r || E'3k finance creates a card for someone else ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3k finance creates a card for someone else denied [ok]\n'; end;
  update public.business_cards set title = 'x' where id = card; get diagnostics n = row_count; r := r || format(E'3l finance edits the owner''s card rows=%s [0]\n', n);
  begin insert into public.card_events (card_id, kind) values (card, 'view'); r := r || E'3m staff writes analytics directly ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3m staff writes analytics directly denied [ok]\n'; end;
  execute 'reset role';

  -- Support (crm.manage): edits team pages, events and documents; private pages stay private
  update public.platform_staff set role = 'support' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.workspace_docs set title = 'Team page v2' where id = team; get diagnostics n = row_count; r := r || format(E'4a support edits a team page rows=%s [1]\n', n);
  select updated_by::text into s from public.workspace_docs where id = team; r := r || format(E'4b updated_by is support=%s [true]\n', s = b::text);
  update public.workspace_docs set title = 'x' where id = priv; get diagnostics n = row_count; r := r || format(E'4c support edits the owner''s private page rows=%s [0]\n', n);
  update public.events set capacity = 10 where id = ev; get diagnostics n = row_count; r := r || format(E'4d support edits an event rows=%s [1]\n', n);
  update public.documents set tags = '{contract}' where path = 'rls/contract.pdf'; get diagnostics n = row_count; r := r || format(E'4e support tags a document rows=%s [1]\n', n);
  update public.business_cards set title = 'Founder' where id = card; get diagnostics n = row_count; r := r || format(E'4f support edits any card rows=%s [1]\n', n);
  execute 'reset role';

  -- Staff without MFA (with the two-step requirement on, whatever Settings says)
  update public.platform_settings set value = '{"requireMfa": true}' where key = 'admin_security';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.workspace_docs; r := r || format(E'5a staff without MFA sees pages=%s [0]\n', n);
  select count(*) into n from public.documents; r := r || format(E'5b staff without MFA sees documents=%s [0]\n', n);
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
