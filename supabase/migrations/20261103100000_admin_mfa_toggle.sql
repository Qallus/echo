-- Owners can turn off the two-step requirement for staff (e.g. during
-- development). platform_settings "admin_security" = {"requireMfa": bool};
-- missing or true means two-step is required, as before. Customers are not
-- affected. Every staff permission check goes through private.mfa_verified().

insert into public.platform_settings (key, value) values ('admin_security', '{"requireMfa": true}') on conflict (key) do nothing;

create or replace function private.mfa_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
      or coalesce((select (value ->> 'requireMfa')::boolean from public.platform_settings where key = 'admin_security'), true) = false;
$$;
revoke execute on function private.mfa_verified() from public, anon;
grant execute on function private.mfa_verified() to authenticated;

-- Owners only (staff.manage).
create policy "settings_insert_admin_security" on public.platform_settings for insert to authenticated
  with check (key = 'admin_security' and private.staff_can('staff.manage'));
create policy "settings_update_admin_security" on public.platform_settings for update to authenticated
  using (key = 'admin_security' and private.staff_can('staff.manage')) with check (key = 'admin_security' and private.staff_can('staff.manage'));
