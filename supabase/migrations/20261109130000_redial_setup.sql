-- Redial setup wizard (docs/REDIAL_GROWTH_AND_AUTOMATION_PLAN.md, Track B).
-- * profiles.account_type: Personal or Business, chosen at signup (it used to
--   live only in auth metadata).
-- * redial_setups: one row per person with their setup answers, saved step by
--   step. People write their own answers and can submit them; staff read them
--   (and, in the next step, set the line and status).
-- The mobile number in step 1 is checked through the existing text-message
-- notification channel (channel_code_issue / channel_code_verify), so a
-- verified number also works for text alerts.

-- ---------------------------------------------------------------------------
-- Account type on the profile.
-- ---------------------------------------------------------------------------
alter table public.profiles add column account_type text not null default 'personal'
  check (account_type in ('personal', 'business'));

update public.profiles p set account_type = 'business'
from auth.users u
where u.id = p.id and u.raw_user_meta_data ->> 'account_type' = 'business';

grant select (account_type), update (account_type) on public.profiles to authenticated;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  company text := left(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), 120);
  kind text := case when new.raw_user_meta_data ->> 'account_type' = 'business' then 'business' else 'personal' end;
begin
  insert into public.profiles (id, full_name, avatar_url, company, account_type)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url', nullif(company, ''), kind);

  insert into public.workspaces (name, is_personal, created_by)
  values ('Personal workspace', true, new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, new.id, 'owner');

  if kind = 'business' and company <> '' then
    insert into public.workspaces (name, is_personal, created_by)
    values (company, false, new.id)
    returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws, new.id, 'owner');
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Setup answers.
-- ---------------------------------------------------------------------------
create table public.redial_setups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  step smallint not null default 1 check (step between 1 and 8),
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 32768),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'active', 'needs_info')),
  line_id uuid references public.redial_lines (id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index redial_setups_line_idx on public.redial_setups (line_id);
create index redial_setups_status_idx on public.redial_setups (status, updated_at desc);

create function private.redial_setups_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'submitted' and old.status is distinct from 'submitted' then new.submitted_at := now(); end if;
  return new;
end $$;
create trigger redial_setups_touch before update on public.redial_setups
  for each row execute function private.redial_setups_touch();

alter table public.redial_setups enable row level security;

revoke all on public.redial_setups from anon, authenticated;
grant select on public.redial_setups to authenticated;
grant insert (user_id, step, answers) on public.redial_setups to authenticated;
grant update (step, answers, status) on public.redial_setups to authenticated;

create policy "redial_setups_select" on public.redial_setups for select to authenticated
  using (user_id = (select auth.uid()) or (select private.staff_can('users.view')));
create policy "redial_setups_insert_own" on public.redial_setups for insert to authenticated
  with check (user_id = (select auth.uid()));
-- People can save and submit their own answers; only staff set active or needs_info.
create policy "redial_setups_update_own" on public.redial_setups for update to authenticated
  using (user_id = (select auth.uid()) and status in ('draft', 'submitted', 'needs_info'))
  with check (user_id = (select auth.uid()) and status in ('draft', 'submitted'));
