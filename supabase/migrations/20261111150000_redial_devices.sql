-- Redial phone service P2: desk, cordless and Wi-Fi phones (SIP) on a line.
-- Each phone signs in to Redial's Twilio SIP domain with its own username and
-- password, and downloads its settings from an auto-setup address. The
-- password (encrypted) and the auto-setup token (hashed) are never readable
-- through the API; only the provisioning route and the device actions use
-- them. The line owner manages phones; staff can see them.

create table public.redial_devices (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  model text not null check (char_length(model) <= 40),
  vendor text not null check (vendor in ('grandstream', 'yealink', 'poly', 'other')),
  mac text check (mac ~ '^[0-9a-f]{12}$'),
  sip_username text not null unique check (sip_username ~ '^[a-z0-9_]{6,32}$'),
  credential_sid text check (credential_sid ~ '^CR[0-9a-f]{32}$'),
  secret_enc text not null check (char_length(secret_enc) <= 500),
  provision_token_hash text not null unique check (char_length(provision_token_hash) = 64),
  ring boolean not null default true,
  last_provisioned_at timestamptz,
  last_registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index redial_devices_mac_idx on public.redial_devices (mac) where mac is not null;
create index redial_devices_line_idx on public.redial_devices (line_id);
create index redial_devices_owner_idx on public.redial_devices (owner_id);
create trigger redial_devices_updated_at before update on public.redial_devices for each row execute function public.set_updated_at();

revoke all on public.redial_devices from anon, authenticated;
grant select (id, line_id, owner_id, label, model, vendor, mac, sip_username, credential_sid, ring, last_provisioned_at, last_registered_at, created_at, updated_at)
  on public.redial_devices to authenticated;
grant insert (line_id, label, model, vendor, mac, sip_username, credential_sid, secret_enc, provision_token_hash, ring) on public.redial_devices to authenticated;
grant update (label, ring, credential_sid, secret_enc, provision_token_hash) on public.redial_devices to authenticated;
grant delete on public.redial_devices to authenticated;
alter table public.redial_devices enable row level security;

create policy "redial_devices_select" on public.redial_devices for select to authenticated
  using ((select private.owns_redial_line(line_id)) or (select private.staff_can('users.view')));
create policy "redial_devices_insert" on public.redial_devices for insert to authenticated
  with check ((select private.owns_redial_line(line_id)) and owner_id = (select auth.uid()));
create policy "redial_devices_update" on public.redial_devices for update to authenticated
  using ((select private.owns_redial_line(line_id))) with check ((select private.owns_redial_line(line_id)));
create policy "redial_devices_delete" on public.redial_devices for delete to authenticated
  using ((select private.owns_redial_line(line_id)));
