-- Prospecting (Admin -> Prospects): business phone numbers imported as
-- prospects, checked with Twilio Lookup (who carries the number: RingCentral,
-- Cox, Spectrum, other VoIP, landline, mobile), scored, and sent to the CRM
-- as leads. Spec: docs/Prospecting/06-PROSPECT-CARRIER-LOOKUP.md.
--
-- workspace_id is null for Redial's own (staff) prospect lists. It's there so
-- Business customers can get their own lists later without a rewrite; those
-- rows follow workspace membership.
--
-- Tables
--   prospects          one row per business number per list
--   phone_lookups      shared cache of Twilio results (one per number), so a
--                      number isn't paid for twice within the cache window
--   lookup_runs        each confirmed run: counts, estimated and actual cost
--   lookup_run_items   the queue a run works through
--
-- Running lookups spends money, so it needs the new prospects.run permission
-- (owner and admin). Viewing needs crm.view, editing crm.manage.

-- ---------------------------------------------------------------------------
-- 1. Permission: prospects.run for owner and admin.
-- ---------------------------------------------------------------------------
create or replace function private.role_permissions(r public.staff_role) returns text[]
language sql immutable set search_path = '' as $$
  select case r
    when 'owner' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'staff.manage', 'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view',
      'comms.view', 'comms.manage', 'social.manage', 'projects.manage', 'marketplace.view', 'marketplace.manage',
      'prospects.run']
    when 'admin' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view',
      'comms.view', 'comms.manage', 'social.manage', 'projects.manage', 'marketplace.view', 'marketplace.manage',
      'prospects.run']
    when 'support' then array[
      'dashboard.view', 'users.view', 'users.manage', 'workspaces.view', 'notifications.view', 'crm.view', 'crm.manage',
      'comms.view', 'comms.manage', 'projects.manage', 'marketplace.view', 'marketplace.manage']
    when 'finance' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'billing.manage', 'crm.view', 'marketplace.view']
    when 'marketing' then array[
      'dashboard.view', 'analytics.view', 'crm.view', 'crm.manage', 'content.manage',
      'comms.view', 'comms.manage', 'social.manage', 'marketplace.view']
    when 'analyst' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'ai.view']
    else array[]::text[]
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  business_name text check (char_length(business_name) <= 200),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  website text check (char_length(website) <= 300),
  address text check (char_length(address) <= 300),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 60),
  category text check (char_length(category) <= 100),
  source text not null default 'csv' check (source in ('csv', 'paste', 'places', 'manual')),
  source_ref text check (char_length(source_ref) <= 300),
  status text not null default 'new' check (status in ('new', 'queued', 'contacted', 'demo', 'won', 'lost', 'dnc')),
  score integer check (score between 0 and 100),
  notes text check (char_length(notes) <= 5000),
  crm_contact_id uuid references public.crm_contacts (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One row per number per list (Redial's own list has no workspace).
create unique index prospects_list_phone_key on public.prospects
  (coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), phone_e164);
create index prospects_workspace_status_idx on public.prospects (workspace_id, status);
create index prospects_phone_idx on public.prospects (phone_e164);
create index prospects_crm_contact_idx on public.prospects (crm_contact_id);
create index prospects_created_by_idx on public.prospects (created_by);
create trigger prospects_updated_at before update on public.prospects for each row execute function public.set_updated_at();

create table public.phone_lookups (
  phone_e164 text primary key check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  valid boolean,
  line_type text check (char_length(line_type) <= 40),
  carrier_name text check (char_length(carrier_name) <= 200),
  provider text check (char_length(provider) <= 40),
  confidence text check (confidence in ('confirmed', 'possible', 'unknown')),
  caller_name text check (char_length(caller_name) <= 200),
  caller_type text check (char_length(caller_type) <= 40),
  raw jsonb check (pg_column_size(raw) <= 8192),
  error_code integer,
  cost_cents numeric(10, 3) not null default 0,
  looked_up_at timestamptz not null default now()
);
create index phone_lookups_provider_idx on public.phone_lookups (provider);

create table public.lookup_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  requested_by uuid default auth.uid() references auth.users (id) on delete set null,
  total integer not null default 0 check (total >= 0),
  skipped_cached integer not null default 0 check (skipped_cached >= 0),
  processed integer not null default 0 check (processed >= 0),
  failed integer not null default 0 check (failed >= 0),
  include_caller_name boolean not null default false,
  est_cost_cents numeric(10, 3) not null default 0,
  actual_cost_cents numeric(10, 3) not null default 0,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index lookup_runs_workspace_created_idx on public.lookup_runs (workspace_id, created_at);
create index lookup_runs_requested_by_idx on public.lookup_runs (requested_by);
create index lookup_runs_open_idx on public.lookup_runs (status) where status in ('queued', 'running');

create table public.lookup_run_items (
  run_id uuid not null references public.lookup_runs (id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  status text not null default 'queued' check (status in ('queued', 'done', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  claimed_at timestamptz,
  error text check (char_length(error) <= 300),
  primary key (run_id, phone_e164)
);
create index lookup_run_items_queued_idx on public.lookup_run_items (run_id) where status = 'queued';

-- ---------------------------------------------------------------------------
-- 3. Access
-- ---------------------------------------------------------------------------
revoke all on public.prospects, public.phone_lookups, public.lookup_runs, public.lookup_run_items from anon, authenticated;
grant select, delete on public.prospects to authenticated;
grant insert (workspace_id, business_name, phone_e164, website, address, city, state, category, source, source_ref, status, score, notes, crm_contact_id),
      update (business_name, website, address, city, state, category, status, score, notes, crm_contact_id)
  on public.prospects to authenticated;
grant select, insert, update on public.phone_lookups to authenticated;
grant select, insert on public.lookup_runs to authenticated;
grant update (total, skipped_cached, processed, failed, actual_cost_cents, status, finished_at) on public.lookup_runs to authenticated;
grant select, insert, delete on public.lookup_run_items to authenticated;
grant update (status, attempts, claimed_at, error) on public.lookup_run_items to authenticated;

alter table public.prospects enable row level security;
alter table public.phone_lookups enable row level security;
alter table public.lookup_runs enable row level security;
alter table public.lookup_run_items enable row level security;

-- Prospects: Redial's list is staff (crm.view to see, crm.manage to change);
-- a workspace list follows membership.
create policy "prospects_select" on public.prospects for select to authenticated
  using (case when workspace_id is null then (select private.staff_can('crm.view')) else (select private.is_member(workspace_id)) end);
create policy "prospects_insert" on public.prospects for insert to authenticated
  with check (case when workspace_id is null then (select private.staff_can('crm.manage')) else (select private.is_member(workspace_id)) end);
create policy "prospects_update" on public.prospects for update to authenticated
  using (case when workspace_id is null then (select private.staff_can('crm.manage')) else (select private.is_member(workspace_id)) end)
  with check (case when workspace_id is null then (select private.staff_can('crm.manage')) else (select private.is_member(workspace_id)) end);
create policy "prospects_delete" on public.prospects for delete to authenticated
  using (case when workspace_id is null then (select private.staff_can('crm.manage')) else (select private.is_member(workspace_id)) end);

-- The lookup cache: staff read it; only people who can run lookups write it.
create policy "phone_lookups_select" on public.phone_lookups for select to authenticated
  using ((select private.staff_can('crm.view')));
create policy "phone_lookups_insert" on public.phone_lookups for insert to authenticated
  with check ((select private.staff_can('prospects.run')));
create policy "phone_lookups_update" on public.phone_lookups for update to authenticated
  using ((select private.staff_can('prospects.run'))) with check ((select private.staff_can('prospects.run')));

-- Runs and their queue: Redial's runs need prospects.run (customer runs come later).
create policy "lookup_runs_select" on public.lookup_runs for select to authenticated
  using (workspace_id is null and (select private.staff_can('crm.view')));
create policy "lookup_runs_insert" on public.lookup_runs for insert to authenticated
  with check (workspace_id is null and (select private.staff_can('prospects.run')));
create policy "lookup_runs_update" on public.lookup_runs for update to authenticated
  using (workspace_id is null and (select private.staff_can('prospects.run')))
  with check (workspace_id is null and (select private.staff_can('prospects.run')));

create policy "lookup_run_items_select" on public.lookup_run_items for select to authenticated
  using ((select private.staff_can('crm.view')));
create policy "lookup_run_items_insert" on public.lookup_run_items for insert to authenticated
  with check ((select private.staff_can('prospects.run')));
create policy "lookup_run_items_update" on public.lookup_run_items for update to authenticated
  using ((select private.staff_can('prospects.run'))) with check ((select private.staff_can('prospects.run')));
create policy "lookup_run_items_delete" on public.lookup_run_items for delete to authenticated
  using ((select private.staff_can('prospects.run')));

-- Prospecting settings (Twilio prices, monthly cap, cache days) live in
-- platform_settings under 'prospecting'; settings.manage can change them.
create policy "settings_insert_prospecting" on public.platform_settings for insert to authenticated
  with check (key = 'prospecting' and private.staff_can('settings.manage'));
create policy "settings_update_prospecting" on public.platform_settings for update to authenticated
  using (key = 'prospecting' and private.staff_can('settings.manage')) with check (key = 'prospecting' and private.staff_can('settings.manage'));

notify pgrst, 'reload schema';
