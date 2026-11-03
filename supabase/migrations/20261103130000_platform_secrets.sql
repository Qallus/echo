-- Integrations settings: service credentials edited in Admin -> Settings ->
-- Integrations instead of only in Coolify. Values are encrypted by the app
-- (AES-256-GCM, AI_KEYS_SECRET) before they reach the database; the ciphertext
-- column can't be read through the API. Owners and admins (settings.manage).
-- The server reads them with the service role in src/lib/secrets.ts only.

create table public.platform_secrets (
  key text primary key check (key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  ciphertext text not null check (char_length(ciphertext) <= 8192),
  hint text check (char_length(hint) <= 200),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index platform_secrets_updated_by_idx on public.platform_secrets (updated_by);

create function private.platform_secrets_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
revoke execute on function private.platform_secrets_touch() from public, anon, authenticated;
create trigger platform_secrets_touch before update on public.platform_secrets
  for each row execute function private.platform_secrets_touch();

revoke all on public.platform_secrets from anon, authenticated;
grant select (key, hint, updated_by, updated_at) on public.platform_secrets to authenticated;
-- Upserts (save) set the key in ON CONFLICT DO UPDATE too, so it needs update rights.
grant insert (key, ciphertext, hint), update (key, ciphertext, hint) on public.platform_secrets to authenticated;
grant delete on public.platform_secrets to authenticated;

alter table public.platform_secrets enable row level security;
create policy "platform_secrets_select" on public.platform_secrets for select to authenticated using ((select private.staff_can('settings.manage')));
create policy "platform_secrets_insert" on public.platform_secrets for insert to authenticated with check ((select private.staff_can('settings.manage')));
create policy "platform_secrets_update" on public.platform_secrets for update to authenticated
  using ((select private.staff_can('settings.manage'))) with check ((select private.staff_can('settings.manage')));
create policy "platform_secrets_delete" on public.platform_secrets for delete to authenticated using ((select private.staff_can('settings.manage')));
