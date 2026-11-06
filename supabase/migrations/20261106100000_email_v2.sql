-- Email v2: templates gain a status (draft/active/archived), an HTML mode and
-- a revision number (saves check it, so two editors, or an editor and
-- Claude, can't silently overwrite each other). Bulk sends are grouped as
-- campaigns, audiences can be saved, test sends are logged as tests, and the
-- Claude connector gets one-time confirmations for anything it sends.

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
alter table public.email_templates
  add column status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  add column mode text not null default 'blocks' check (mode in ('blocks', 'html')),
  add column revision integer not null default 1,
  add column created_via text not null default 'admin' check (created_via in ('admin', 'claude')),
  add column updated_by uuid default auth.uid() references auth.users (id) on delete set null;
create index email_templates_updated_by_idx on public.email_templates (updated_by);
create index email_templates_status_idx on public.email_templates (status);

-- A content change bumps the revision; the send counter doesn't.
create function private.email_template_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.name, new.subject, new.preheader, new.category, new.schema, new.html, new.body_text, new.mode, new.status)
     is distinct from (old.name, old.subject, old.preheader, old.category, old.schema, old.html, old.body_text, old.mode, old.status) then
    new.revision := old.revision + 1;
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;
create trigger email_templates_revision before update on public.email_templates
  for each row execute function private.email_template_revision();

grant insert (status, mode, created_via), update (status, mode) on public.email_templates to authenticated;

-- ---------------------------------------------------------------------------
-- Campaigns: one row per bulk or multi-person send, with its totals
-- ---------------------------------------------------------------------------
create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.email_templates (id) on delete set null,
  subject text not null check (char_length(subject) <= 300),
  audience jsonb not null default '{}' check (pg_column_size(audience) <= 16384),
  audience_label text check (char_length(audience_label) <= 300),
  total integer not null default 0 check (total >= 0),
  sent integer not null default 0 check (sent >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  failed integer not null default 0 check (failed >= 0),
  status text not null default 'sending' check (status in ('sending', 'sent', 'partial', 'failed')),
  via text not null default 'admin' check (via in ('admin', 'claude')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index email_campaigns_created_idx on public.email_campaigns (created_at desc);
create index email_campaigns_template_idx on public.email_campaigns (template_id);
create index email_campaigns_created_by_idx on public.email_campaigns (created_by);

revoke all on public.email_campaigns from anon, authenticated;
grant select on public.email_campaigns to authenticated;
grant insert (template_id, subject, audience, audience_label, total, via),
      update (sent, skipped, failed, status, finished_at)
  on public.email_campaigns to authenticated;
alter table public.email_campaigns enable row level security;
create policy "email_campaigns_select" on public.email_campaigns for select to authenticated using ((select private.staff_can('comms.view')));
create policy "email_campaigns_insert" on public.email_campaigns for insert to authenticated with check ((select private.staff_can('comms.manage')));
create policy "email_campaigns_update" on public.email_campaigns for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));

-- Sends: test sends are logged as tests, and belong to a campaign when bulk.
alter table public.email_sends drop constraint email_sends_status_check;
alter table public.email_sends add constraint email_sends_status_check check (status in ('sent', 'failed', 'skipped', 'test'));
alter table public.email_sends add column campaign_id uuid references public.email_campaigns (id) on delete set null;
create index email_sends_campaign_idx on public.email_sends (campaign_id);
grant insert (campaign_id) on public.email_sends to authenticated;

-- ---------------------------------------------------------------------------
-- Saved audiences: a named filter (CRM contacts by role/status/tags/owner,
-- waitlist people who agreed to email, or customers), resolved at send time.
-- ---------------------------------------------------------------------------
create table public.email_audiences (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  definition jsonb not null check (pg_column_size(definition) <= 16384),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_audiences_created_by_idx on public.email_audiences (created_by);
create trigger email_audiences_updated_at before update on public.email_audiences
  for each row execute function public.set_updated_at();

revoke all on public.email_audiences from anon, authenticated;
grant select, delete on public.email_audiences to authenticated;
grant insert (name, description, definition), update (name, description, definition) on public.email_audiences to authenticated;
alter table public.email_audiences enable row level security;
create policy "email_audiences_select" on public.email_audiences for select to authenticated using ((select private.staff_can('comms.view')));
create policy "email_audiences_insert" on public.email_audiences for insert to authenticated with check ((select private.staff_can('comms.manage')));
create policy "email_audiences_update" on public.email_audiences for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "email_audiences_delete" on public.email_audiences for delete to authenticated using ((select private.staff_can('comms.manage')));

-- ---------------------------------------------------------------------------
-- Claude connector confirmations: a send tool returns a preview and one of
-- these; only the same person can use it, once, within 15 minutes.
-- ---------------------------------------------------------------------------
create table public.mcp_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id text check (char_length(client_id) <= 200),
  tool text not null check (char_length(tool) <= 80),
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  summary text check (char_length(summary) <= 2000),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index mcp_confirmations_user_idx on public.mcp_confirmations (user_id, created_at desc);

revoke all on public.mcp_confirmations from anon, authenticated;
grant select on public.mcp_confirmations to authenticated;
grant insert (client_id, tool, payload, summary), update (used_at) on public.mcp_confirmations to authenticated;
alter table public.mcp_confirmations enable row level security;
create policy "mcp_confirmations_select" on public.mcp_confirmations for select to authenticated using (user_id = (select auth.uid()));
create policy "mcp_confirmations_insert" on public.mcp_confirmations for insert to authenticated with check (user_id = (select auth.uid()));
-- Only an unused, unexpired confirmation can be marked used (once).
create policy "mcp_confirmations_use" on public.mcp_confirmations for update to authenticated
  using (user_id = (select auth.uid()) and used_at is null and expires_at > now())
  with check (user_id = (select auth.uid()));
