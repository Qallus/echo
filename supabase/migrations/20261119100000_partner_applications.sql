-- Website: the Partners, Careers and Reseller program forms (/partners).
-- Each submission lands in Admin → Communications → Inbox like the contact
-- form, and adds (or updates) a CRM contact tagged by program, so staff can
-- filter Contacts and build email or text audiences for one group at a time
-- (for example every "partner-influencer", or "careers-business-sales").
-- Business applicants also get a CRM company. Contact consent is optional and
-- stored with its wording; tag "contact-ok" marks people who agreed.

create function public.submit_partner_form(p jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_program text := p->>'program';
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_name text := left(trim(coalesce(p->>'name', '')), 200);
  v_first text;
  v_last text;
  v_phone text := left(nullif(trim(coalesce(p->>'phone', '')), ''), 40);
  v_company text := left(nullif(trim(coalesce(p->>'company', '')), ''), 200);
  v_website text := left(nullif(trim(coalesce(p->>'website', '')), ''), 300);
  v_location text := left(nullif(trim(coalesce(p->>'location', '')), ''), 100);
  v_body text := left(trim(coalesce(p->>'message', '')), 10000);
  v_answers jsonb := case when jsonb_typeof(p->'answers') = 'object' and pg_column_size(p->'answers') <= 8000 then p->'answers' else '{}'::jsonb end;
  v_consent boolean := coalesce((p->>'consent_contact')::boolean, false);
  v_label text;
  v_group text;
  v_role text;
  v_tags text[];
  v_company_id uuid;
  v_contact uuid;
  v_app jsonb;
begin
  -- program → (group, label, CRM role)
  select g, l, r into v_group, v_label, v_role from (values
    ('partner-reseller', 'Partners', 'Reseller', 'partner'),
    ('partner-affiliate', 'Partners', 'Affiliate', 'partner'),
    ('partner-influencer', 'Partners', 'Influencer', 'partner'),
    ('partner-live-agent', 'Partners', 'Live Agent', 'partner'),
    ('careers-support', 'Careers', 'Support team', 'contact'),
    ('careers-residential-sales', 'Careers', 'Residential sales', 'contact'),
    ('careers-business-sales', 'Careers', 'Business sales', 'contact'),
    ('reseller-program', 'Reseller program', 'Sales and BPO teams', 'partner')
  ) as t(k, g, l, r) where k = v_program;
  if v_group is null then raise exception 'Choose a program.' using errcode = '22023'; end if;
  if v_name = '' then raise exception 'Enter your name.' using errcode = '22023'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 200 then raise exception 'Enter a valid email address.' using errcode = '22023'; end if;
  if v_group = 'Reseller program' and v_company is null then raise exception 'Enter your company name.' using errcode = '22023'; end if;
  if (select count(*) from public.inbox_messages where lower(from_email) = v_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages. Try again later.' using errcode = '54000';
  end if;

  v_first := left(split_part(v_name, ' ', 1), 100);
  v_last := left(nullif(trim(substr(v_name, char_length(split_part(v_name, ' ', 1)) + 1)), ''), 100);
  v_tags := array[case v_group when 'Partners' then 'partner-program' when 'Careers' then 'careers' else 'reseller-program' end, v_program]
            || case when v_consent then array['contact-ok'] else array[]::text[] end;
  v_app := jsonb_build_object('program', v_program, 'group', v_group, 'track', v_label, 'company', v_company, 'website', v_website,
                              'location', v_location, 'answers', v_answers, 'consent_contact', v_consent,
                              'consent_text', left(p->>'consent_text', 1000), 'submitted_at', now());

  -- Admin Inbox (staff are notified by the inbox trigger).
  insert into public.inbox_messages (channel, from_name, from_email, phone, company, topic, subject, body)
  values ('form', v_name, v_email, v_phone, v_company, left(v_group || ': ' || v_label, 60),
          left('Website: ' || v_group || ': ' || v_label, 300), coalesce(nullif(v_body, ''), '(no message)'));

  -- CRM company for business applicants: reuse one with the same name.
  if v_company is not null and v_group <> 'Careers' then
    select c.id into v_company_id from public.crm_companies c where lower(c.name) = lower(v_company) order by c.created_at limit 1;
    if v_company_id is null then
      insert into public.crm_companies (name, status, website, email, phone, tags, notes)
      values (v_company, 'prospect', v_website, v_email, v_phone, v_tags, 'Applied on the website: ' || v_group || ', ' || v_label || '.')
      returning id into v_company_id;
    else
      update public.crm_companies c set tags = (array(select distinct t from unnest(c.tags || v_tags) t))[1:20] where c.id = v_company_id;
    end if;
  end if;

  -- CRM contact: reuse the one with this email, otherwise add one.
  select c.id into v_contact from public.crm_contacts c where lower(c.email) = v_email order by c.created_at limit 1;
  if v_contact is null then
    insert into public.crm_contacts (first_name, last_name, email, phone, company_id, source, role, lead_status, tags, interest, city, notes, details)
    values (v_first, v_last, v_email, v_phone, v_company_id, 'Website: ' || v_group, v_role, 'new', v_tags, left(v_group || ': ' || v_label, 200),
            v_location, nullif(left(v_body, 4000), ''), jsonb_build_object('application', v_app));
  else
    update public.crm_contacts c set
      tags = (array(select distinct t from unnest(c.tags || v_tags) t))[1:20],
      phone = coalesce(c.phone, v_phone),
      company_id = coalesce(c.company_id, v_company_id),
      details = c.details || jsonb_build_object('application', v_app)
    where c.id = v_contact;
  end if;
end $$;
revoke execute on function public.submit_partner_form(jsonb) from public;
grant execute on function public.submit_partner_form(jsonb) to anon, authenticated;
