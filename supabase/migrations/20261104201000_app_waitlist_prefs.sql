-- App waitlist: each person chooses how often we text them and which updates
-- they want (launch news, beta invites, new features, tips, offers), instead
-- of a fixed message count. Automations and staff should respect both.

alter table public.app_waitlist
  add column sms_frequency text not null default 'major' check (sms_frequency in ('major', 'monthly', 'weekly', 'all')),
  add column update_topics text[] not null default '{launch}' check (update_topics <@ array['launch', 'beta', 'features', 'tips', 'offers']::text[]);
grant update (sms_frequency, update_topics) on public.app_waitlist to authenticated;

create or replace function public.join_app_waitlist(p jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_first text := left(trim(coalesce(p->>'first_name', '')), 100);
  v_last text := left(trim(coalesce(p->>'last_name', '')), 100);
  v_phone text := left(trim(coalesce(p->>'phone', '')), 40);
  v_platforms text[] := array(select distinct x from jsonb_array_elements_text(coalesce(p->'platforms', '[]')) x where x in ('ios', 'android'));
  v_products text[] := array(select distinct x from jsonb_array_elements_text(coalesce(p->'products', '[]')) x where x in ('echo', 'redial'));
  v_type text := case when p->>'account_type' = 'business' then 'business' else 'personal' end;
  v_team text := case when p->>'team_size' in ('1', '2-10', '11-50', '51-200', '200+') then p->>'team_size' end;
  v_sms boolean := coalesce((p->>'consent_sms')::boolean, false);
  v_call boolean := coalesce((p->>'consent_call')::boolean, false);
  v_freq text := case when p->>'sms_frequency' in ('major', 'monthly', 'weekly', 'all') then p->>'sms_frequency' else 'major' end;
  v_topics text[] := array(select distinct x from jsonb_array_elements_text(coalesce(p->'update_topics', '["launch"]')) x where x in ('launch', 'beta', 'features', 'tips', 'offers'));
  v_tags text[];
  v_contact uuid;
  v_entry uuid;
  s record;
begin
  if v_first = '' or v_last = '' then raise exception 'Enter your first and last name.' using errcode = '22023'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 200 then raise exception 'Enter a valid email address.' using errcode = '22023'; end if;
  if v_phone !~ '^\+[1-9]\d{7,14}$' then raise exception 'Enter a valid phone number.' using errcode = '22023'; end if;
  if cardinality(v_platforms) = 0 then raise exception 'Choose iPhone, Android or both.' using errcode = '22023'; end if;
  if (select count(*) from public.app_waitlist where created_at > now() - interval '1 hour') >= 200
     or exists (select 1 from public.app_waitlist w where lower(w.email) = v_email and w.updated_at > now() - interval '1 minute') then
    raise exception 'Too many sign-ups right now. Try again in a minute.' using errcode = '54000';
  end if;

  v_tags := array['app-waitlist'] || array(select 'app-' || x from unnest(v_platforms) x) || array(select 'wants-' || x from unnest(v_products) x) || array[v_type];

  -- CRM: reuse the contact with this email, otherwise add a lead.
  select c.id into v_contact from public.crm_contacts c where lower(c.email) = v_email order by c.created_at limit 1;
  if v_contact is null then
    insert into public.crm_contacts (first_name, last_name, email, phone, source, role, lead_status, tags, interest, notes, details)
    values (v_first, v_last, v_email, v_phone, 'App waitlist', 'lead', 'new', v_tags,
            left(nullif(trim(coalesce(p->>'use_case', '')), ''), 100), left(nullif(trim(coalesce(p->>'questions', '')), ''), 4000),
            jsonb_build_object('app_waitlist', jsonb_build_object('platforms', v_platforms, 'products', v_products, 'account_type', v_type)))
    returning id into v_contact;
  else
    update public.crm_contacts c set
      tags = array(select distinct t from unnest(c.tags || v_tags) t),
      phone = coalesce(c.phone, v_phone),
      details = c.details || jsonb_build_object('app_waitlist', jsonb_build_object('platforms', v_platforms, 'products', v_products, 'account_type', v_type))
    where c.id = v_contact;
  end if;

  insert into public.app_waitlist (first_name, last_name, email, phone, platforms, products, account_type, company, team_size, use_case, details, questions,
                                   consent_sms, consent_call, consent_text, consent_at, source_page, contact_id, sms_frequency, update_topics)
  values (v_first, v_last, v_email, v_phone, v_platforms, v_products, v_type, left(nullif(trim(coalesce(p->>'company', '')), ''), 200), v_team,
          left(nullif(trim(coalesce(p->>'use_case', '')), ''), 100), left(nullif(trim(coalesce(p->>'details', '')), ''), 2000),
          left(nullif(trim(coalesce(p->>'questions', '')), ''), 4000), v_sms, v_call, left(p->>'consent_text', 1000), now(),
          left(p->>'source_page', 200), v_contact, v_freq, v_topics)
  on conflict ((lower(email))) do update set
    first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone,
    platforms = array(select distinct x from unnest(public.app_waitlist.platforms || excluded.platforms) x),
    products = array(select distinct x from unnest(public.app_waitlist.products || excluded.products) x),
    account_type = excluded.account_type, company = coalesce(excluded.company, public.app_waitlist.company),
    team_size = coalesce(excluded.team_size, public.app_waitlist.team_size), use_case = coalesce(excluded.use_case, public.app_waitlist.use_case),
    details = coalesce(excluded.details, public.app_waitlist.details), questions = coalesce(excluded.questions, public.app_waitlist.questions),
    consent_sms = excluded.consent_sms, consent_call = excluded.consent_call, sms_frequency = excluded.sms_frequency, update_topics = excluded.update_topics, consent_text = excluded.consent_text, consent_at = now(),
    status = case when public.app_waitlist.status = 'unsubscribed' then 'waiting' else public.app_waitlist.status end,
    contact_id = coalesce(public.app_waitlist.contact_id, excluded.contact_id)
  returning id into v_entry;

  -- Let staff who handle communications know.
  for s in select user_id, role from public.platform_staff loop
    if 'comms.view' = any(private.role_permissions(s.role)) then
      perform private.notify(s.user_id, 'app_waitlist', 'App waitlist: ' || v_first || ' ' || v_last,
        array_to_string(array(select case x when 'ios' then 'iPhone' else 'Android' end from unnest(v_platforms) x), ' and ') || ' · ' || v_type,
        '/admin/waitlist', jsonb_build_object('entry_id', v_entry));
    end if;
  end loop;
end $$;
