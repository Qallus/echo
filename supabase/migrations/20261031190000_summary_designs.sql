-- Echo: summary designs (the Summary Builder). A design is the branding for
-- exported and shared summaries: logo, header, colors, footer and which blocks
-- appear. Owners edit their designs; a design attached to a Business workspace
-- can be used by everyone in it.

create table public.summary_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index summary_designs_user on public.summary_designs (user_id);
create unique index summary_designs_one_default on public.summary_designs (user_id) where is_default;
create trigger summary_designs_updated_at before update on public.summary_designs
  for each row execute function public.set_updated_at();

revoke all on public.summary_designs from anon, authenticated;
grant select, insert, update, delete on public.summary_designs to authenticated;
grant all on public.summary_designs to service_role;
alter table public.summary_designs enable row level security;

create policy "summary_designs_select" on public.summary_designs for select to authenticated
  using (user_id = (select auth.uid()) or (workspace_id is not null and private.is_member(workspace_id)));
create policy "summary_designs_insert" on public.summary_designs for insert to authenticated
  with check (user_id = (select auth.uid()) and (workspace_id is null or private.is_member(workspace_id)));
create policy "summary_designs_update" on public.summary_designs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (workspace_id is null or private.is_member(workspace_id)));
create policy "summary_designs_delete" on public.summary_designs for delete to authenticated
  using (user_id = (select auth.uid()));

-- Logos and images for designs: public read (they appear on shared reports),
-- each user writes only in their own folder: branding/<user_id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "branding_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "branding_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "branding_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "branding_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = (select auth.uid())::text);
