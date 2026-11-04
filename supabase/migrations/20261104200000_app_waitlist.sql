-- Mobile app waitlist: people who want to hear when the iPhone or Android
-- app is ready. The public site calls join_app_waitlist() (no account
-- needed); it validates, rate-limits, saves the entry and files the person
-- in the CRM as a lead (source "App waitlist", tagged by app and product),
-- so the existing email templates, texts, automations and calls reach them.
-- Texts and calls only go to people who opted in (consent_sms / consent_call,
-- with the wording they agreed to and when).

create table public.app_waitlist (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  email text not null check (char_length(email) <= 200),
  phone text not null check (char_length(phone) <= 40),
  platforms text[] not null check (cardinality(platforms) between 1 and 2 and platforms <@ array['ios', 'android']::text[]),
  products text[] not null default '{}' check (products <@ array['echo', 'redial']::text[]),
  account_type text not null default 'personal' check (account_type in ('personal', 'business')),
  company text check (char_length(company) <= 200),
  team_size text check (team_size in ('1', '2-10', '11-50', '51-200', '200+')),
  use_case text check (char_length(use_case) <= 100),
  details text check (char_length(details) <= 2000),
  questions text check (char_length(questions) <= 4000),
  consent_email boolean not null default true,
  consent_sms boolean not null default false,
  consent_call boolean not null default false,
  consent_text text,
  consent_at timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'invited', 'joined', 'unsubscribed')),
  source_page text check (char_length(source_page) <= 200),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index app_waitlist_email_idx on public.app_waitlist (lower(email));
create index app_waitlist_contact_idx on public.app_waitlist (contact_id);
create index app_waitlist_created_idx on public.app_waitlist (created_at desc);
create trigger app_waitlist_updated_at before update on public.app_waitlist for each row execute function public.set_updated_at();

revoke all on public.app_waitlist from anon, authenticated;
grant select, delete on public.app_waitlist to authenticated;
grant update (status) on public.app_waitlist to authenticated;
alter table public.app_waitlist enable row level security;
create policy "app_waitlist_select" on public.app_waitlist for select to authenticated using ((select private.staff_can('comms.view')));
create policy "app_waitlist_update" on public.app_waitlist for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "app_waitlist_delete" on public.app_waitlist for delete to authenticated using ((select private.staff_can('comms.manage')));

-- p: first_name, last_name, email, phone (E.164), platforms[], products[],
-- account_type, company, team_size, use_case, details, questions,
-- consent_sms, consent_call, consent_text, source_page. Signing up again with
-- the same email updates the entry.
create function public.join_app_waitlist(p jsonb)
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
                                   consent_sms, consent_call, consent_text, consent_at, source_page, contact_id)
  values (v_first, v_last, v_email, v_phone, v_platforms, v_products, v_type, left(nullif(trim(coalesce(p->>'company', '')), ''), 200), v_team,
          left(nullif(trim(coalesce(p->>'use_case', '')), ''), 100), left(nullif(trim(coalesce(p->>'details', '')), ''), 2000),
          left(nullif(trim(coalesce(p->>'questions', '')), ''), 4000), v_sms, v_call, left(p->>'consent_text', 1000), now(),
          left(p->>'source_page', 200), v_contact)
  on conflict ((lower(email))) do update set
    first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone,
    platforms = array(select distinct x from unnest(public.app_waitlist.platforms || excluded.platforms) x),
    products = array(select distinct x from unnest(public.app_waitlist.products || excluded.products) x),
    account_type = excluded.account_type, company = coalesce(excluded.company, public.app_waitlist.company),
    team_size = coalesce(excluded.team_size, public.app_waitlist.team_size), use_case = coalesce(excluded.use_case, public.app_waitlist.use_case),
    details = coalesce(excluded.details, public.app_waitlist.details), questions = coalesce(excluded.questions, public.app_waitlist.questions),
    consent_sms = excluded.consent_sms, consent_call = excluded.consent_call, consent_text = excluded.consent_text, consent_at = now(),
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
revoke execute on function public.join_app_waitlist(jsonb) from public;
grant execute on function public.join_app_waitlist(jsonb) to anon, authenticated;
