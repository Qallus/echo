-- Redial setup wizard, part 2 (docs/REDIAL_GROWTH_AND_AUTOMATION_PLAN.md, B2).
-- * redial_setup_submit(): the person submits their answers. It adds them to
--   the CRM as a lead (contact; Business accounts also get a company and a
--   pipeline deal), so staff can follow up. Runs as the database because
--   customers can't write the CRM; it only ever touches the caller's own setup.
-- * Assigning a number (admin_redial_assign) now applies the answers to the
--   new line: screening, assistant, ring number, VIP/block lists, transfer
--   list. The setup becomes active.
-- * admin_redial_setups() and admin_redial_setup_status() for the admin queue.

alter table public.redial_setups
  add column contact_id uuid references public.crm_contacts (id) on delete set null,
  add column deal_id uuid references public.crm_deals (id) on delete set null,
  add column staff_note text check (char_length(staff_note) <= 1000);
create index redial_setups_contact_idx on public.redial_setups (contact_id);
create index redial_setups_deal_idx on public.redial_setups (deal_id);

-- ---------------------------------------------------------------------------
-- Submit: mark submitted and add to the CRM.
-- ---------------------------------------------------------------------------
create function public.redial_setup_submit() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  s public.redial_setups;
  a jsonb;
  mail text;
  full_name text;
  company text;
  business boolean;
  v_contact uuid;
  v_company uuid;
  v_deal uuid;
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into s from public.redial_setups where user_id = me for update;
  if not found then raise exception 'Nothing to submit yet.' using errcode = 'P0001'; end if;
  if s.status = 'active' then return 'active'; end if;
  a := s.answers;
  if a -> 'about' ->> 'phone' is null then raise exception 'Finish the first step first.' using errcode = 'P0001'; end if;

  select email into mail from auth.users where id = me;
  full_name := coalesce(nullif(trim(a -> 'about' ->> 'fullName'), ''), mail);
  business := a -> 'about' ->> 'accountType' = 'business';
  company := nullif(trim(coalesce(a -> 'about' ->> 'company', '')), '');

  if business and company is not null then
    select id into v_company from public.crm_companies where lower(name) = lower(company) order by created_at limit 1;
    if v_company is null then
      insert into public.crm_companies (name, status, website, industry, phone, created_by)
      values (left(company, 200), 'prospect', left(a -> 'about' ->> 'website', 300), left(a -> 'about' ->> 'industry', 100), a -> 'about' ->> 'phone', me)
      returning id into v_company;
    end if;
  end if;

  select id into v_contact from public.crm_contacts where lower(email) = lower(mail) order by created_at limit 1;
  if v_contact is null then
    insert into public.crm_contacts (first_name, last_name, email, phone, company_id, role, lead_status, source, interest, created_by, details)
    values (
      left(split_part(full_name, ' ', 1), 100), nullif(left(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), 100), ''),
      mail, a -> 'about' ->> 'phone', v_company, 'lead', 'new', 'Redial setup',
      case when business then 'Redial for business' else 'Redial personal' end, me,
      jsonb_build_object('redial_setup', jsonb_build_object('carrier', a -> 'phone' ->> 'carrier', 'route', a -> 'route' ->> 'method', 'plan', a -> 'plan' ->> 'priceKey', 'team_size', a -> 'about' ->> 'teamSize'))
    ) returning id into v_contact;
  else
    update public.crm_contacts set
      phone = coalesce(phone, a -> 'about' ->> 'phone'),
      company_id = coalesce(company_id, v_company),
      lead_status = coalesce(lead_status, 'new'),
      details = details || jsonb_build_object('redial_setup', jsonb_build_object('carrier', a -> 'phone' ->> 'carrier', 'route', a -> 'route' ->> 'method', 'plan', a -> 'plan' ->> 'priceKey', 'team_size', a -> 'about' ->> 'teamSize'))
    where id = v_contact;
  end if;

  v_deal := s.deal_id;
  if business and v_deal is null then
    insert into public.crm_deals (title, stage, company_id, contact_id, source, products, next_step, next_step_type, created_by)
    values (left('Redial · ' || coalesce(company, full_name), 200), 'new_working', v_company, v_contact, 'Redial setup', array['Redial'],
            'Assign a Redial number and welcome them', 'call', me)
    returning id into v_deal;
  end if;

  update public.redial_setups set status = 'submitted', contact_id = v_contact, deal_id = v_deal where user_id = me;
  return 'submitted';
end $$;
revoke execute on function public.redial_setup_submit() from public, anon;
grant execute on function public.redial_setup_submit() to authenticated;

-- ---------------------------------------------------------------------------
-- Apply a person's answers to a line they own (called when a number is
-- assigned). Invalid or missing answers are skipped, never fatal.
-- ---------------------------------------------------------------------------
create function private.redial_setup_apply(p_user uuid, p_line uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a jsonb;
  line public.redial_lines;
  hours text;
  n text;
  e jsonb;
begin
  select answers into a from public.redial_setups where user_id = p_user;
  if a is null then return; end if;
  select * into line from public.redial_lines where id = p_line and owner_id = p_user;
  if not found then return; end if;

  if a -> 'screening' ->> 'mode' in ('unknown', 'all', 'off') then
    update public.redial_lines set mode = a -> 'screening' ->> 'mode' where id = p_line;
  end if;
  if a -> 'screening' -> 'hours' ->> 'start' is not null then
    hours := 'Business hours: ' || (a -> 'screening' -> 'hours' ->> 'start') || ' to ' || (a -> 'screening' -> 'hours' ->> 'end')
      || case when (a -> 'screening' -> 'hours' ->> 'weekdays')::boolean then ', Monday to Friday.' else ', every day.' end;
  end if;
  update public.redial_lines set
    assistant_name = coalesce(nullif(left(trim(a -> 'assistant' ->> 'name'), 40), ''), assistant_name),
    voice = case when a -> 'assistant' ->> 'voice' in ('ara', 'eve', 'rex', 'sal', 'leo') then a -> 'assistant' ->> 'voice' else voice end,
    greeting = coalesce(nullif(left(trim(a -> 'assistant' ->> 'greeting'), 500), ''), greeting),
    about = left(nullif(concat_ws(E'\n', nullif(trim(a -> 'assistant' ->> 'about'), ''), hours), ''), 4000),
    allow_connect = coalesce((a -> 'after' ->> 'putThrough')::boolean, allow_connect),
    forward_to = case when (a -> 'after' ->> 'forwardTo') ~ '^\+[1-9][0-9]{7,14}$' and a -> 'after' ->> 'forwardTo' <> line.number
                      then a -> 'after' ->> 'forwardTo' else forward_to end
  where id = p_line;

  for n in select jsonb_array_elements_text(coalesce(a -> 'screening' -> 'vip', '[]')) loop
    if n ~ '^\+[1-9][0-9]{7,14}$' then
      insert into public.redial_list_entries (line_id, number, kind, label) values (p_line, n, 'vip', 'From setup') on conflict (line_id, number) do nothing;
    end if;
  end loop;
  for n in select jsonb_array_elements_text(coalesce(a -> 'screening' -> 'block', '[]')) loop
    if n ~ '^\+[1-9][0-9]{7,14}$' then
      insert into public.redial_list_entries (line_id, number, kind, label) values (p_line, n, 'block', 'From setup') on conflict (line_id, number) do nothing;
    end if;
  end loop;
  for e in select jsonb_array_elements(coalesce(a -> 'after' -> 'directory', '[]')) loop
    if e ->> 'number' ~ '^\+[1-9][0-9]{7,14}$' and length(trim(coalesce(e ->> 'label', ''))) between 1 and 80 then
      insert into public.redial_directory (line_id, label, number, created_by) values (p_line, trim(e ->> 'label'), e ->> 'number', p_user)
      on conflict (line_id, number) do nothing;
    end if;
  end loop;

  update public.redial_setups set line_id = p_line, status = 'active' where user_id = p_user;
end $$;
revoke execute on function private.redial_setup_apply(uuid, uuid) from public, anon, authenticated;

-- Assigning a number now also applies the member's setup answers.
create or replace function public.admin_redial_assign(p_email text, p_number text, p_label text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'No Echo account uses that email.' using errcode = 'P0002'; end if;
  insert into public.redial_lines (owner_id, number, label) values (v_user, p_number, coalesce(nullif(trim(p_label), ''), 'My line'))
  returning id into v_id;
  perform private.redial_setup_apply(v_user, v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Admin queue.
-- ---------------------------------------------------------------------------
create function public.admin_redial_setups()
returns table (
  user_id uuid, email text, full_name text, account_type text, status text, step smallint, answers jsonb,
  line_id uuid, contact_id uuid, deal_id uuid, staff_note text, submitted_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select s.user_id, u.email::text, p.full_name, p.account_type, s.status, s.step, s.answers,
         s.line_id, s.contact_id, s.deal_id, s.staff_note, s.submitted_at, s.updated_at
  from public.redial_setups s
  join auth.users u on u.id = s.user_id
  left join public.profiles p on p.id = s.user_id
  where private.staff_can('users.view')
  order by case s.status when 'submitted' then 0 when 'needs_info' then 1 when 'draft' then 2 else 3 end, coalesce(s.submitted_at, s.updated_at) desc
  limit 200;
$$;
revoke execute on function public.admin_redial_setups() from public, anon;
grant execute on function public.admin_redial_setups() to authenticated;

-- Staff ask for more information (with a note the member sees) or reopen.
create function public.admin_redial_setup_status(p_user uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  if p_status not in ('needs_info', 'submitted', 'draft') then raise exception 'Unknown status' using errcode = '22023'; end if;
  update public.redial_setups set status = p_status, staff_note = nullif(left(trim(coalesce(p_note, '')), 1000), '') where user_id = p_user;
  if not found then raise exception 'Setup not found' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), 'redial.setup.status', 'redial_setup', p_user::text, jsonb_build_object('status', p_status, 'note', p_note));
end $$;
revoke execute on function public.admin_redial_setup_status(uuid, text, text) from public, anon;
grant execute on function public.admin_redial_setup_status(uuid, text, text) to authenticated;
