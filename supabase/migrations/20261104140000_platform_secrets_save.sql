-- Saving an integration key failed with "permission denied for table
-- platform_secrets": INSERT ... ON CONFLICT DO UPDATE needs SELECT on the
-- table's columns, and ciphertext is deliberately unreadable through the API.
-- Saves now go through this function (settings.manage, MFA-verified), which
-- upserts without exposing ciphertext.

create function public.admin_save_secret(p_key text, p_ciphertext text, p_hint text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('settings.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.platform_secrets (key, ciphertext, hint, updated_by)
  values (p_key, p_ciphertext, p_hint, (select auth.uid()))
  on conflict (key) do update set ciphertext = excluded.ciphertext, hint = excluded.hint;
end $$;
revoke execute on function public.admin_save_secret(text, text, text) from public, anon;
grant execute on function public.admin_save_secret(text, text, text) to authenticated;
