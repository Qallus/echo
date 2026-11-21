-- Connected accounts (Google first) and two-way calendar sync.
--
-- account_connections: one row per person per provider. The access and
--   refresh tokens are encrypted by the app (AES-256-GCM, AI_KEYS_SECRET)
--   before they get here, so the owner reading their own row sees only
--   ciphertext. Only the owner can see or change it. Disconnecting deletes
--   the row (and its links).
-- calendar_sync_links: which Redial event matches which Google event, per
--   connection, so edits on either side update the other instead of making
--   copies.
--
-- Everything runs as the signed-in person (no service role): Redial pushes a
-- change to Google when it's saved, and pulls Google's changes when the
-- calendar opens or on Sync now.

create table public.account_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google')),
  account_email text check (char_length(account_email) <= 320),
  account_id text check (char_length(account_id) <= 255),
  scopes text[] not null default '{}' check (cardinality(scopes) <= 30),
  access_token text check (char_length(access_token) <= 8000),
  refresh_token text check (char_length(refresh_token) <= 4000),
  expires_at timestamptz,
  calendar_id text not null default 'primary' check (char_length(calendar_id) between 1 and 300),
  workspace_id uuid references public.workspaces (id) on delete set null,
  sync_token text check (char_length(sync_token) <= 2000),
  status text not null default 'active' check (status in ('active', 'error')),
  last_error text check (char_length(last_error) <= 500),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create index account_connections_workspace_idx on public.account_connections (workspace_id);
create trigger account_connections_updated_at before update on public.account_connections for each row execute function public.set_updated_at();

create table public.calendar_sync_links (
  connection_id uuid not null references public.account_connections (id) on delete cascade,
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  google_event_id text not null check (char_length(google_event_id) between 1 and 1024),
  google_updated timestamptz,
  synced_at timestamptz not null default now(),
  primary key (connection_id, event_id),
  unique (connection_id, google_event_id)
);
create index calendar_sync_links_event_idx on public.calendar_sync_links (event_id);

revoke all on public.account_connections, public.calendar_sync_links from anon, authenticated;
grant select, delete on public.account_connections to authenticated;
grant insert (provider, account_email, account_id, scopes, access_token, refresh_token, expires_at, calendar_id, workspace_id, sync_token, status, last_error, last_synced_at),
      update (account_email, account_id, scopes, access_token, refresh_token, expires_at, calendar_id, workspace_id, sync_token, status, last_error, last_synced_at)
  on public.account_connections to authenticated;
grant select, insert, update, delete on public.calendar_sync_links to authenticated;

alter table public.account_connections enable row level security;
alter table public.calendar_sync_links enable row level security;

create policy "account_connections_select" on public.account_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy "account_connections_insert" on public.account_connections for insert to authenticated
  with check (user_id = (select auth.uid()) and (workspace_id is null or (select private.is_member(workspace_id))));
create policy "account_connections_update" on public.account_connections for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (workspace_id is null or (select private.is_member(workspace_id))));
create policy "account_connections_delete" on public.account_connections for delete to authenticated
  using (user_id = (select auth.uid()));

-- A link is yours when its connection is yours; a new link must point at an
-- event you can see.
create policy "calendar_sync_links_select" on public.calendar_sync_links for select to authenticated
  using (exists (select 1 from public.account_connections c where c.id = connection_id and c.user_id = (select auth.uid())));
create policy "calendar_sync_links_insert" on public.calendar_sync_links for insert to authenticated
  with check (exists (select 1 from public.account_connections c where c.id = connection_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.calendar_events e where e.id = event_id and (select private.is_member(e.workspace_id))));
create policy "calendar_sync_links_update" on public.calendar_sync_links for update to authenticated
  using (exists (select 1 from public.account_connections c where c.id = connection_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.account_connections c where c.id = connection_id and c.user_id = (select auth.uid())));
create policy "calendar_sync_links_delete" on public.calendar_sync_links for delete to authenticated
  using (exists (select 1 from public.account_connections c where c.id = connection_id and c.user_id = (select auth.uid())));

notify pgrst, 'reload schema';
