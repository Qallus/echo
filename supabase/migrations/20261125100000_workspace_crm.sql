-- Per-workspace CRM: Contacts, Leads, Clients (crm_contacts, crm_companies,
-- crm_activities), Pipeline (crm_deals, crm_deal_history), Plans (plans,
-- plan_groups, plan_tasks), Workspace docs (workspace_docs, workspace_comments)
-- and Digital Business Cards (business_cards, card_events, card_leads).
--
-- workspace_id is null for Redial staff's own CRM (unchanged: private.staff_can)
-- and set for a customer's Personal or Business workspace, where its members
-- see and edit the rows. Staff can't see customer workspace rows unless they
-- are members of that workspace. Child tables follow their parent row.
-- Staff automations (rules) never run on customer rows.

-- 1. The column -------------------------------------------------------------
alter table public.crm_contacts   add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.crm_companies  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.crm_activities add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.crm_deals      add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.plans          add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.workspace_docs add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.business_cards add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

create index if not exists crm_contacts_workspace   on public.crm_contacts (workspace_id);
create index if not exists crm_companies_workspace  on public.crm_companies (workspace_id);
create index if not exists crm_activities_workspace on public.crm_activities (workspace_id);
create index if not exists crm_deals_workspace      on public.crm_deals (workspace_id);
create index if not exists plans_workspace          on public.plans (workspace_id);
create index if not exists workspace_docs_workspace on public.workspace_docs (workspace_id);
create index if not exists business_cards_workspace on public.business_cards (workspace_id);

-- Set once, on insert (rows don't move between workspaces).
grant insert (workspace_id) on public.crm_contacts, public.crm_companies, public.crm_activities, public.crm_deals,
  public.plans, public.workspace_docs, public.business_cards to authenticated;
grant select (workspace_id) on public.crm_contacts, public.crm_companies, public.crm_activities, public.crm_deals,
  public.plans, public.workspace_docs, public.business_cards to authenticated;

-- 2. Who may read or write a CRM row ----------------------------------------
-- Staff rows (no workspace): the staff permission. Workspace rows: members.
create or replace function private.crm_access(ws uuid, permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when ws is null then private.staff_can(permission) else private.is_member(ws) end;
$$;
-- Deleting in a workspace: its owner or admins (staff rows: the permission).
create or replace function private.crm_manage(ws uuid, permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when ws is null then private.staff_can(permission)
    else private.has_role(ws, array['owner', 'admin']::public.workspace_role[]) end;
$$;
revoke execute on function private.crm_access(uuid, text), private.crm_manage(uuid, text) from public, anon;
grant execute on function private.crm_access(uuid, text), private.crm_manage(uuid, text) to authenticated;

-- 3. Policies ---------------------------------------------------------------
-- Contacts, companies, activities, deals: same shape.
do $$
declare t text;
begin
  foreach t in array array['crm_contacts', 'crm_companies', 'crm_activities', 'crm_deals'] loop
    execute format('drop policy if exists %1$I on public.%2$I', t || '_select', t);
    execute format('drop policy if exists %1$I on public.%2$I', t || '_insert', t);
    execute format('drop policy if exists %1$I on public.%2$I', t || '_update', t);
    execute format('drop policy if exists %1$I on public.%2$I', t || '_delete', t);
    execute format($p$create policy %1$I on public.%2$I for select to authenticated
      using ((select private.crm_access(workspace_id, 'crm.view')))$p$, t || '_select', t);
    execute format($p$create policy %1$I on public.%2$I for insert to authenticated
      with check ((select private.crm_access(workspace_id, 'crm.manage')))$p$, t || '_insert', t);
    execute format($p$create policy %1$I on public.%2$I for update to authenticated
      using ((select private.crm_access(workspace_id, 'crm.manage')))
      with check ((select private.crm_access(workspace_id, 'crm.manage')))$p$, t || '_update', t);
    execute format($p$create policy %1$I on public.%2$I for delete to authenticated
      using ((select private.crm_manage(workspace_id, 'crm.manage')))$p$, t || '_delete', t);
  end loop;
end $$;

-- Deal history follows its deal.
drop policy if exists crm_deal_history_select on public.crm_deal_history;
create policy crm_deal_history_select on public.crm_deal_history for select to authenticated
  using (exists (select 1 from public.crm_deals d where d.id = crm_deal_history.deal_id));

-- Plans; groups and tasks follow their plan.
drop policy if exists plans_select on public.plans;
drop policy if exists plans_write on public.plans;
create policy plans_select on public.plans for select to authenticated
  using ((select private.crm_access(workspace_id, 'crm.view')));
create policy plans_insert on public.plans for insert to authenticated
  with check (case when workspace_id is null then (select private.staff_can('crm.manage') or private.staff_can('projects.manage'))
    else (select private.is_member(workspace_id)) end);
create policy plans_update on public.plans for update to authenticated
  using (case when workspace_id is null then (select private.staff_can('crm.manage') or private.staff_can('projects.manage'))
    else (select private.is_member(workspace_id)) end)
  with check (case when workspace_id is null then (select private.staff_can('crm.manage') or private.staff_can('projects.manage'))
    else (select private.is_member(workspace_id)) end);
create policy plans_delete on public.plans for delete to authenticated
  using (case when workspace_id is null then (select private.staff_can('crm.manage') or private.staff_can('projects.manage'))
    else (select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])) or owner_id = (select auth.uid()) end);

-- A plan's groups and tasks: whoever can edit the plan (staff: the permissions).
create or replace function private.can_edit_plan(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.plans x where x.id = p and case when x.workspace_id is null
      then private.staff_can('crm.manage') or private.staff_can('projects.manage')
      else private.is_member(x.workspace_id) end);
$$;
revoke execute on function private.can_edit_plan(uuid) from public, anon;
grant execute on function private.can_edit_plan(uuid) to authenticated;

drop policy if exists plan_groups_select on public.plan_groups;
drop policy if exists plan_groups_write on public.plan_groups;
create policy plan_groups_select on public.plan_groups for select to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_groups.plan_id));
create policy plan_groups_write on public.plan_groups for all to authenticated
  using ((select private.can_edit_plan(plan_id))) with check ((select private.can_edit_plan(plan_id)));

drop policy if exists plan_tasks_select on public.plan_tasks;
drop policy if exists plan_tasks_write on public.plan_tasks;
create policy plan_tasks_select on public.plan_tasks for select to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_tasks.plan_id));
create policy plan_tasks_write on public.plan_tasks for all to authenticated
  using ((select private.can_edit_plan(plan_id))) with check ((select private.can_edit_plan(plan_id)));

-- Workspace docs: team docs for every member, private docs for their author.
drop policy if exists workspace_docs_select on public.workspace_docs;
drop policy if exists workspace_docs_insert on public.workspace_docs;
drop policy if exists workspace_docs_update on public.workspace_docs;
drop policy if exists workspace_docs_delete on public.workspace_docs;
create policy workspace_docs_select on public.workspace_docs for select to authenticated
  using ((select private.crm_access(workspace_id, 'crm.view')) and (visibility = 'team' or created_by = (select auth.uid())));
create policy workspace_docs_insert on public.workspace_docs for insert to authenticated
  with check ((select private.crm_access(workspace_id, 'crm.view')));
create policy workspace_docs_update on public.workspace_docs for update to authenticated
  using ((select private.crm_access(workspace_id, 'crm.view')) and (created_by = (select auth.uid()) or (visibility = 'team' and
    case when workspace_id is null then (select private.staff_can('crm.manage') or private.staff_can('projects.manage')) else true end)))
  with check ((select private.crm_access(workspace_id, 'crm.view')) and (created_by = (select auth.uid()) or (visibility = 'team' and
    case when workspace_id is null then (select private.staff_can('crm.manage') or private.staff_can('projects.manage')) else true end)));
create policy workspace_docs_delete on public.workspace_docs for delete to authenticated
  using ((select private.crm_access(workspace_id, 'crm.view')) and (created_by = (select auth.uid()) or (visibility = 'team' and
    (select private.crm_manage(workspace_id, 'crm.manage')))));
-- Comments already follow their doc (the existing policies check workspace_docs).

-- Business cards: workspace members manage their own cards; owners/admins all.
drop policy if exists business_cards_select on public.business_cards;
drop policy if exists business_cards_write on public.business_cards;
create policy business_cards_select on public.business_cards for select to authenticated
  using ((select private.crm_access(workspace_id, 'crm.view')));
create policy business_cards_write on public.business_cards for all to authenticated
  using (case when workspace_id is null
      then (select private.staff_can('crm.manage')) or (owner_id = (select auth.uid()) and (select private.staff_can('crm.view')))
      else (select private.is_member(workspace_id)) and (owner_id = (select auth.uid()) or (select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))) end)
  with check (case when workspace_id is null
      then (select private.staff_can('crm.manage')) or (owner_id = (select auth.uid()) and (select private.staff_can('crm.view')))
      else (select private.is_member(workspace_id)) and (owner_id = (select auth.uid()) or (select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))) end);

drop policy if exists card_events_select on public.card_events;
create policy card_events_select on public.card_events for select to authenticated
  using (exists (select 1 from public.business_cards c where c.id = card_events.card_id));

drop policy if exists card_leads_select on public.card_leads;
drop policy if exists card_leads_update on public.card_leads;
drop policy if exists card_leads_delete on public.card_leads;
create policy card_leads_select on public.card_leads for select to authenticated
  using (exists (select 1 from public.business_cards c where c.id = card_leads.card_id));
create policy card_leads_update on public.card_leads for update to authenticated
  using (exists (select 1 from public.business_cards c where c.id = card_leads.card_id
    and ((select private.crm_access(c.workspace_id, 'crm.manage')) or c.owner_id = (select auth.uid()))))
  with check (exists (select 1 from public.business_cards c where c.id = card_leads.card_id
    and ((select private.crm_access(c.workspace_id, 'crm.manage')) or c.owner_id = (select auth.uid()))));
create policy card_leads_delete on public.card_leads for delete to authenticated
  using (exists (select 1 from public.business_cards c where c.id = card_leads.card_id
    and (select private.crm_manage(c.workspace_id, 'crm.manage'))));

-- 4. Staff automations stay on staff rows -----------------------------------
create or replace function private.rules_on_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_id is not null then return null; end if;
  if new.role = 'lead' and (tg_op = 'INSERT' or old.role is distinct from 'lead') then
    perform private.queue_rules('lead_created', new.id::text, null, null, new.id, null, null);
  end if;
  return null;
end $$;

create or replace function private.rules_on_deal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_id is not null then return null; end if;
  if tg_op = 'INSERT' then
    perform private.queue_rules('added_to_pipeline', new.id::text, null, new.id, new.contact_id, null, null);
  elsif new.stage is distinct from old.stage then
    perform private.queue_rules('stage_changed', new.id || ':' || new.stage || ':' || extract(epoch from new.stage_entered_at)::bigint, new.stage, new.id, new.contact_id, null, null);
    if new.stage in ('closed_won', 'closed_lost') then
      perform private.queue_rules(new.stage, new.id::text, null, new.id, new.contact_id, null, null);
    end if;
  end if;
  return null;
end $$;

-- 5. Per-workspace pipeline stages (empty = the built-in stages) -----------
create table if not exists public.workspace_crm_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  stages jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.workspace_crm_settings enable row level security;
grant select, insert, update on public.workspace_crm_settings to authenticated;
create policy workspace_crm_settings_select on public.workspace_crm_settings for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy workspace_crm_settings_insert on public.workspace_crm_settings for insert to authenticated
  with check ((select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy workspace_crm_settings_update on public.workspace_crm_settings for update to authenticated
  using ((select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])))
  with check ((select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
