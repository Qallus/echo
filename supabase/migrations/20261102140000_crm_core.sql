-- Super Admin S5a: the internal CRM back office. Clients (companies),
-- contacts, the sales pipeline (deals) and an activity timeline. Qallus staff
-- only: crm.view to read, crm.manage to write, both MFA-verified through
-- private.staff_can. Customers never see any of it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'prospect' check (status in ('prospect', 'client', 'partner', 'former')),
  website text check (char_length(website) <= 300),
  industry text check (char_length(industry) <= 100),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  address text check (char_length(address) <= 400),
  notes text check (char_length(notes) <= 10000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  owner_id uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_companies_owner_idx on public.crm_companies (owner_id);
create index crm_companies_name_idx on public.crm_companies (lower(name));

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text check (char_length(last_name) <= 100),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  title text check (char_length(title) <= 120),
  company_id uuid references public.crm_companies (id) on delete set null,
  source text check (char_length(source) <= 100),
  notes text check (char_length(notes) <= 10000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  owner_id uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_contacts_company_idx on public.crm_contacts (company_id);
create index crm_contacts_owner_idx on public.crm_contacts (owner_id);
create index crm_contacts_email_idx on public.crm_contacts (lower(email));

create table public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  stage text not null default 'lead' check (stage in ('lead', 'contacted', 'qualified', 'demo', 'proposal', 'won', 'lost')),
  value_cents bigint not null default 0 check (value_cents between 0 and 100000000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  company_id uuid references public.crm_companies (id) on delete set null,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  expected_close date,
  next_step text check (char_length(next_step) <= 300),
  next_step_due date,
  source text check (char_length(source) <= 100),
  lost_reason text check (char_length(lost_reason) <= 500),
  notes text check (char_length(notes) <= 10000),
  owner_id uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_deals_stage_idx on public.crm_deals (stage, updated_at desc);
create index crm_deals_company_idx on public.crm_deals (company_id);
create index crm_deals_contact_idx on public.crm_deals (contact_id);
create index crm_deals_owner_idx on public.crm_deals (owner_id);

-- Notes, calls, emails, meetings and tasks, attached to a client, contact
-- and/or deal.
create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'note' check (kind in ('note', 'call', 'email', 'meeting', 'task')),
  body text not null check (char_length(body) between 1 and 10000),
  due_at timestamptz,
  done_at timestamptz,
  company_id uuid references public.crm_companies (id) on delete cascade,
  contact_id uuid references public.crm_contacts (id) on delete cascade,
  deal_id uuid references public.crm_deals (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(company_id, contact_id, deal_id) >= 1)
);
create index crm_activities_company_idx on public.crm_activities (company_id, created_at desc);
create index crm_activities_contact_idx on public.crm_activities (contact_id, created_at desc);
create index crm_activities_deal_idx on public.crm_activities (deal_id, created_at desc);
create index crm_activities_open_tasks_idx on public.crm_activities (due_at) where kind = 'task' and done_at is null;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, and closed_at follows the deal's stage
-- ---------------------------------------------------------------------------
create trigger crm_companies_updated_at before update on public.crm_companies
  for each row execute function public.set_updated_at();
create trigger crm_contacts_updated_at before update on public.crm_contacts
  for each row execute function public.set_updated_at();
create trigger crm_deals_updated_at before update on public.crm_deals
  for each row execute function public.set_updated_at();

create function private.crm_deal_closed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.stage in ('won', 'lost') then
    if tg_op = 'INSERT' or old.stage not in ('won', 'lost') then new.closed_at := now(); end if;
  else
    new.closed_at := null;
  end if;
  return new;
end $$;
revoke execute on function private.crm_deal_closed() from public, anon, authenticated;
create trigger crm_deals_closed before insert or update of stage on public.crm_deals
  for each row execute function private.crm_deal_closed();

-- ---------------------------------------------------------------------------
-- Access: staff only. Column grants keep id, created_by and the timestamps
-- out of reach of the API.
-- ---------------------------------------------------------------------------
revoke all on public.crm_companies, public.crm_contacts, public.crm_deals, public.crm_activities from anon, authenticated;
grant select, delete on public.crm_companies, public.crm_contacts, public.crm_deals, public.crm_activities to authenticated;
grant insert (name, status, website, industry, phone, email, address, notes, tags, owner_id),
      update (name, status, website, industry, phone, email, address, notes, tags, owner_id)
  on public.crm_companies to authenticated;
grant insert (first_name, last_name, email, phone, title, company_id, source, notes, tags, owner_id),
      update (first_name, last_name, email, phone, title, company_id, source, notes, tags, owner_id)
  on public.crm_contacts to authenticated;
grant insert (title, stage, value_cents, currency, company_id, contact_id, expected_close, next_step, next_step_due, source, lost_reason, notes, owner_id),
      update (title, stage, value_cents, currency, company_id, contact_id, expected_close, next_step, next_step_due, source, lost_reason, notes, owner_id)
  on public.crm_deals to authenticated;
grant insert (kind, body, due_at, done_at, company_id, contact_id, deal_id),
      update (body, due_at, done_at)
  on public.crm_activities to authenticated;

alter table public.crm_companies enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_activities enable row level security;

create policy "crm_companies_select" on public.crm_companies for select to authenticated using ((select private.staff_can('crm.view')));
create policy "crm_companies_insert" on public.crm_companies for insert to authenticated with check ((select private.staff_can('crm.manage')));
create policy "crm_companies_update" on public.crm_companies for update to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));
create policy "crm_companies_delete" on public.crm_companies for delete to authenticated using ((select private.staff_can('crm.manage')));

create policy "crm_contacts_select" on public.crm_contacts for select to authenticated using ((select private.staff_can('crm.view')));
create policy "crm_contacts_insert" on public.crm_contacts for insert to authenticated with check ((select private.staff_can('crm.manage')));
create policy "crm_contacts_update" on public.crm_contacts for update to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));
create policy "crm_contacts_delete" on public.crm_contacts for delete to authenticated using ((select private.staff_can('crm.manage')));

create policy "crm_deals_select" on public.crm_deals for select to authenticated using ((select private.staff_can('crm.view')));
create policy "crm_deals_insert" on public.crm_deals for insert to authenticated with check ((select private.staff_can('crm.manage')));
create policy "crm_deals_update" on public.crm_deals for update to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));
create policy "crm_deals_delete" on public.crm_deals for delete to authenticated using ((select private.staff_can('crm.manage')));

create policy "crm_activities_select" on public.crm_activities for select to authenticated using ((select private.staff_can('crm.view')));
create policy "crm_activities_insert" on public.crm_activities for insert to authenticated with check ((select private.staff_can('crm.manage')));
create policy "crm_activities_update" on public.crm_activities for update to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));
create policy "crm_activities_delete" on public.crm_activities for delete to authenticated using ((select private.staff_can('crm.manage')));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Staff names for the Owner picker and activity authors.
create function public.crm_staff()
returns table (user_id uuid, name text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('crm.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select s.user_id, coalesce(nullif(p.full_name, ''), u.email::text), u.email::text
    from public.platform_staff s
    join auth.users u on u.id = s.user_id
    left join public.profiles p on p.id = s.user_id
    order by 2;
end $$;
revoke execute on function public.crm_staff() from public, anon;
grant execute on function public.crm_staff() to authenticated;

-- The Echo account for an email, so a contact can link to its Customer 360.
create function public.admin_user_by_email(p_email text)
returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('users.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return (select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1);
end $$;
revoke execute on function public.admin_user_by_email(text) from public, anon;
grant execute on function public.admin_user_by_email(text) to authenticated;
