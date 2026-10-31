-- Echo: rich user profiles (photo, title, company, phone, time zone...) and
-- an avatars bucket. Teammates can read profile fields, except the phone
-- number: it's readable only through get_my_profile() and, when the owner
-- turns on phone_visible, list_workspace_members().

-- ---------------------------------------------------------------------------
-- Profile fields
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column job_title text check (char_length(job_title) <= 100),
  add column company text check (char_length(company) <= 120),
  add column phone text check (char_length(phone) <= 32),
  add column phone_visible boolean not null default false,
  add column timezone text check (char_length(timezone) <= 64),
  add column location text check (char_length(location) <= 100),
  add column bio text check (char_length(bio) <= 500),
  add column website text check (char_length(website) <= 200),
  add column linkedin text check (char_length(linkedin) <= 200),
  add column pronouns text check (char_length(pronouns) <= 30),
  add column updated_at timestamptz not null default now(),
  add constraint profiles_full_name_len check (char_length(full_name) <= 100);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Business sign-ups: their company is the Business workspace they created.
update public.profiles p
set company = w.name
from public.workspaces w
where w.created_by = p.id and not w.is_personal and p.company is null;

-- Column-level read access: everything except phone.
revoke select on public.profiles from authenticated;
grant select (
  id, full_name, avatar_url, job_title, company, phone_visible, timezone,
  location, bio, website, linkedin, pronouns, created_at, updated_at
) on public.profiles to authenticated;

-- Your own full profile, phone included.
create function public.get_my_profile()
returns setof public.profiles
language sql stable security definer set search_path = '' as $$
  select * from public.profiles where id = (select auth.uid());
$$;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Sign-up: also keep the company name on the profile.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  company text := left(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), 120);
begin
  insert into public.profiles (id, full_name, avatar_url, company)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url', nullif(company, ''));

  insert into public.workspaces (name, is_personal, created_by)
  values ('Personal workspace', true, new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, new.id, 'owner');

  if new.raw_user_meta_data ->> 'account_type' = 'business' and company <> '' then
    insert into public.workspaces (name, is_personal, created_by)
    values (company, false, new.id)
    returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws, new.id, 'owner');
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Team list: now with photo, title, company and (if shared) phone.
-- ---------------------------------------------------------------------------
drop function public.list_workspace_members(uuid);
create function public.list_workspace_members(ws uuid)
returns table (
  user_id uuid, email text, full_name text, role public.workspace_role, joined_at timestamptz,
  avatar_url text, job_title text, company text, phone text, timezone text, location text
)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, p.full_name, m.role, m.created_at,
         p.avatar_url, p.job_title, p.company,
         case when p.phone_visible or m.user_id = (select auth.uid()) then p.phone end,
         p.timezone, p.location
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = ws and private.is_member(ws)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;
revoke execute on function public.list_workspace_members(uuid) from public, anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Avatars: public read (shown on shared pages and emails), each user writes
-- only in their own folder: avatars/<user_id>/<file>.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Listing own files (to clean up the previous photo).
create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
