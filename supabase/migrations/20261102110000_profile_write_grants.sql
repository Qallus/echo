-- Echo: users may update only their own editable profile fields.
-- Supabase's default privileges had given signed-in users every table-level
-- write on profiles, so a suspended user could clear suspended_at on their
-- own row (RLS allows updating your own profile). Rows are created by the
-- sign-up trigger and removed with the account, so no insert/delete either.

revoke insert, update, delete, truncate, references, trigger on public.profiles from anon, authenticated;

grant update (
  full_name, avatar_url, job_title, company, phone, phone_visible, timezone, location,
  bio, website, linkedin, details, quiet_start, quiet_end
) on public.profiles to authenticated;
