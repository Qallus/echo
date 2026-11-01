-- Echo: extra profile details (prefix, more phones and emails, address,
-- birthday, custom fields) and drop the unused pronouns field.
--
-- details is a JSON array of { kind, label, value, shared }. Like phone, it
-- isn't readable through the table: you read your own through
-- get_my_profile(), and teammates get only the entries marked shared through
-- list_workspace_members().

alter table public.profiles
  drop column pronouns,
  add column details jsonb not null default '[]'::jsonb
    check (jsonb_typeof(details) = 'array' and jsonb_array_length(details) <= 20 and pg_column_size(details) <= 16384);

-- The table-level select was revoked in the profiles migration, so the new
-- column isn't readable by teammates. Re-state the column list without
-- pronouns (dropping the column already removed its grant).
revoke select on public.profiles from authenticated;
grant select (
  id, full_name, avatar_url, job_title, company, phone_visible, timezone,
  location, bio, website, linkedin, created_at, updated_at
) on public.profiles to authenticated;

-- Team list: add shared details (all of them for yourself).
drop function public.list_workspace_members(uuid);
create function public.list_workspace_members(ws uuid)
returns table (
  user_id uuid, email text, full_name text, role public.workspace_role, joined_at timestamptz,
  avatar_url text, job_title text, company text, phone text, timezone text, location text,
  details jsonb
)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, p.full_name, m.role, m.created_at,
         p.avatar_url, p.job_title, p.company,
         case when p.phone_visible or m.user_id = (select auth.uid()) then p.phone end,
         p.timezone, p.location,
         coalesce((
           select jsonb_agg(e)
           from jsonb_array_elements(p.details) e
           where m.user_id = (select auth.uid()) or (e ->> 'shared')::boolean is true
         ), '[]'::jsonb)
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = ws and private.is_member(ws)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;
revoke execute on function public.list_workspace_members(uuid) from public, anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;
