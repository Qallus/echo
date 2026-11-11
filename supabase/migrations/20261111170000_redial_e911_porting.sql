-- Redial phone service P3: the 911 address on each line, and requests to
-- bring (port) an existing number to Redial.
--
-- 911: the address is registered with Twilio (an emergency-enabled Address on
-- the line's number). This table is a copy for display; the app checks Twilio
-- itself before turning on desk phones, so editing a row can't skip the step.
--
-- Porting: the member fills in a request; staff work it from Admin > Redial
-- and the CRM. The account number and PIN are stored encrypted (the app's
-- key) and only shown to staff through an audited action.

create table public.redial_e911 (
  line_id uuid primary key references public.redial_lines (id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  street text not null check (char_length(street) between 1 and 200),
  street2 text check (char_length(street2) <= 100),
  city text not null check (char_length(city) between 1 and 100),
  region text not null check (region ~ '^[A-Z]{2}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  country text not null default 'US' check (country in ('US')),
  address_sid text check (address_sid ~ '^AD[0-9a-f]{32}$'),
  status text not null default 'pending' check (status in ('pending', 'registered', 'failed')),
  message text check (char_length(message) <= 500),
  updated_at timestamptz not null default now()
);
create trigger redial_e911_updated_at before update on public.redial_e911 for each row execute function public.set_updated_at();

revoke all on public.redial_e911 from anon, authenticated;
grant select on public.redial_e911 to authenticated;
grant insert (line_id, customer_name, street, street2, city, region, postal_code, address_sid, status, message) on public.redial_e911 to authenticated;
grant update (customer_name, street, street2, city, region, postal_code, address_sid, status, message) on public.redial_e911 to authenticated;
alter table public.redial_e911 enable row level security;

create policy "redial_e911_select" on public.redial_e911 for select to authenticated
  using ((select private.owns_redial_line(line_id)) or (select private.staff_can('users.view')));
create policy "redial_e911_insert" on public.redial_e911 for insert to authenticated
  with check ((select private.owns_redial_line(line_id)));
create policy "redial_e911_update" on public.redial_e911 for update to authenticated
  using ((select private.owns_redial_line(line_id))) with check ((select private.owns_redial_line(line_id)));

-- ---------------------------------------------------------------------------
-- Number porting requests.
-- ---------------------------------------------------------------------------
create table public.redial_port_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  line_id uuid references public.redial_lines (id) on delete set null,
  number text not null check (number ~ '^\+1[2-9][0-9]{9}$'),
  number_type text not null default 'mobile' check (number_type in ('mobile', 'landline', 'voip')),
  carrier text not null check (char_length(carrier) between 1 and 100),
  account_name text not null check (char_length(account_name) between 1 and 120),
  account_number_enc text not null check (char_length(account_number_enc) <= 500),
  pin_enc text check (char_length(pin_enc) <= 500),
  account_hint text check (char_length(account_hint) <= 8),
  service_street text not null check (char_length(service_street) between 1 and 200),
  service_city text not null check (char_length(service_city) between 1 and 100),
  service_region text not null check (service_region ~ '^[A-Z]{2}$'),
  service_postal_code text not null check (service_postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  authorized_name text not null check (char_length(authorized_name) between 1 and 120),
  authorized_at timestamptz not null default now(),
  wanted_date date,
  note text check (char_length(note) <= 1000),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'needs_info', 'with_carrier', 'scheduled', 'completed', 'rejected', 'cancelled')),
  foc_date date,
  staff_note text check (char_length(staff_note) <= 1000),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index redial_port_requests_owner_idx on public.redial_port_requests (owner_id, created_at desc);
create index redial_port_requests_line_idx on public.redial_port_requests (line_id);
create index redial_port_requests_contact_idx on public.redial_port_requests (contact_id);
create unique index redial_port_requests_open_idx on public.redial_port_requests (number)
  where status not in ('completed', 'rejected', 'cancelled');
create trigger redial_port_requests_updated_at before update on public.redial_port_requests for each row execute function public.set_updated_at();

-- Members read their own requests and create them through
-- redial_port_submit(); staff change status through admin_redial_port_status().
revoke all on public.redial_port_requests from anon, authenticated;
grant select on public.redial_port_requests to authenticated;
alter table public.redial_port_requests enable row level security;
create policy "redial_port_select" on public.redial_port_requests for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.staff_can('users.view')));

-- Submit (or cancel) a request, and note it on the member's CRM contact.
create function public.redial_port_submit(
  p_line uuid, p_number text, p_number_type text, p_carrier text, p_account_name text,
  p_account_number_enc text, p_pin_enc text, p_account_hint text,
  p_street text, p_city text, p_region text, p_postal text,
  p_authorized_name text, p_wanted_date date, p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  v_contact uuid;
  v_id uuid;
  mail text;
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_line is not null and not private.owns_redial_line(p_line) then raise exception 'Line not found' using errcode = '42501'; end if;
  if (select count(*) from public.redial_port_requests where owner_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many requests today' using errcode = 'P0001';
  end if;
  select contact_id into v_contact from public.redial_setups where user_id = me;
  if v_contact is null then
    select email into mail from auth.users where id = me;
    select id into v_contact from public.crm_contacts where lower(email) = lower(mail) order by created_at limit 1;
  end if;
  insert into public.redial_port_requests (
    owner_id, line_id, number, number_type, carrier, account_name, account_number_enc, pin_enc, account_hint,
    service_street, service_city, service_region, service_postal_code, authorized_name, wanted_date, note, contact_id
  ) values (
    me, p_line, p_number, p_number_type, trim(p_carrier), trim(p_account_name), p_account_number_enc, p_pin_enc, p_account_hint,
    trim(p_street), trim(p_city), upper(p_region), trim(p_postal), trim(p_authorized_name), p_wanted_date, nullif(trim(coalesce(p_note, '')), ''), v_contact
  ) returning id into v_id;
  if v_contact is not null then
    insert into public.crm_activities (kind, body, contact_id, created_by)
    values ('task', 'Redial number port requested: ' || p_number || ' from ' || trim(p_carrier) || '. Review it in Admin → Redial → Number ports.', v_contact, me);
  end if;
  return v_id;
end $$;
revoke execute on function public.redial_port_submit(uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, text) from public, anon;
grant execute on function public.redial_port_submit(uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, text) to authenticated;

create function public.redial_port_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.redial_port_requests set status = 'cancelled'
  where id = p_id and owner_id = (select auth.uid()) and status in ('submitted', 'in_review', 'needs_info');
  if not found then raise exception 'This request can''t be cancelled here. Contact Redial support.' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.redial_port_cancel(uuid) from public, anon;
grant execute on function public.redial_port_cancel(uuid) to authenticated;

-- Staff queue (with the member's email) and status changes (audited).
create function public.admin_redial_ports()
returns table (
  id uuid, owner_id uuid, email text, full_name text, line_id uuid, number text, number_type text, carrier text, account_name text,
  account_hint text, has_pin boolean, service_street text, service_city text, service_region text, service_postal_code text,
  authorized_name text, authorized_at timestamptz, wanted_date date, note text, status text, foc_date date, staff_note text,
  contact_id uuid, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.owner_id, u.email::text, p.full_name, r.line_id, r.number, r.number_type, r.carrier, r.account_name,
         r.account_hint, r.pin_enc is not null, r.service_street, r.service_city, r.service_region, r.service_postal_code,
         r.authorized_name, r.authorized_at, r.wanted_date, r.note, r.status, r.foc_date, r.staff_note,
         r.contact_id, r.created_at, r.updated_at
  from public.redial_port_requests r
  join auth.users u on u.id = r.owner_id
  left join public.profiles p on p.id = r.owner_id
  where private.staff_can('users.view')
  order by case when r.status in ('completed', 'rejected', 'cancelled') then 1 else 0 end, r.created_at desc
  limit 200;
$$;
revoke execute on function public.admin_redial_ports() from public, anon;
grant execute on function public.admin_redial_ports() to authenticated;

create function public.admin_redial_port_status(p_id uuid, p_status text, p_foc date, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_contact uuid;
  v_number text;
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  if p_status not in ('in_review', 'needs_info', 'with_carrier', 'scheduled', 'completed', 'rejected', 'submitted') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  update public.redial_port_requests
  set status = p_status, foc_date = coalesce(p_foc, foc_date), staff_note = nullif(left(trim(coalesce(p_note, '')), 1000), '')
  where id = p_id
  returning contact_id, number into v_contact, v_number;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), 'redial.port.status', 'redial_port_request', p_id::text, jsonb_build_object('status', p_status, 'foc_date', p_foc, 'note', p_note));
  if v_contact is not null then
    insert into public.crm_activities (kind, body, contact_id, created_by)
    values ('note', 'Number port ' || v_number || ': ' || replace(p_status, '_', ' ') || coalesce(' (date ' || p_foc::text || ')', '') || coalesce('. ' || nullif(trim(p_note), ''), ''), v_contact, (select auth.uid()));
  end if;
end $$;
revoke execute on function public.admin_redial_port_status(uuid, text, date, text) from public, anon;
grant execute on function public.admin_redial_port_status(uuid, text, date, text) to authenticated;

-- The encrypted account number and PIN for one request (staff, audited in
-- the app action that decrypts them).
create function public.admin_redial_port_secrets(p_id uuid) returns table (account_number_enc text, pin_enc text)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('users.manage') then raise exception 'Staff only' using errcode = '42501'; end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id, detail)
  values ((select auth.uid()), 'redial.port.reveal', 'redial_port_request', p_id::text, '{}'::jsonb);
  return query select r.account_number_enc, r.pin_enc from public.redial_port_requests r where r.id = p_id;
end $$;
revoke execute on function public.admin_redial_port_secrets(uuid) from public, anon;
grant execute on function public.admin_redial_port_secrets(uuid) to authenticated;
