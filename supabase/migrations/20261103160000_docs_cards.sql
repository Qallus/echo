-- Super Admin batch C: documents (files in a private bucket), workspace
-- (shared rich-text docs with comments) and digital business cards (public
-- card pages, analytics, lead capture). Staff only, except the public card
-- functions.

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table public.doc_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  parent_id uuid references public.doc_folders (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index doc_folders_parent_idx on public.doc_folders (parent_id);
create index doc_folders_created_by_idx on public.doc_folders (created_by);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.doc_folders (id) on delete set null,
  name text not null check (char_length(name) between 1 and 255),
  path text not null unique check (char_length(path) <= 500),
  size bigint not null default 0 check (size >= 0),
  mime text check (char_length(mime) <= 200),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  notes text check (char_length(notes) <= 5000),
  company_id uuid references public.crm_companies (id) on delete set null,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  deal_id uuid references public.crm_deals (id) on delete set null,
  plan_id uuid references public.plans (id) on delete set null,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_folder_idx on public.documents (folder_id);
create index documents_company_idx on public.documents (company_id);
create index documents_contact_idx on public.documents (contact_id);
create index documents_deal_idx on public.documents (deal_id);
create index documents_plan_idx on public.documents (plan_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();

revoke all on public.doc_folders, public.documents from anon, authenticated;
grant select, delete on public.doc_folders, public.documents to authenticated;
grant insert (name, parent_id), update (name, parent_id) on public.doc_folders to authenticated;
grant insert (id, folder_id, name, path, size, mime, tags, notes, company_id, contact_id, deal_id, plan_id),
      update (folder_id, name, tags, notes, company_id, contact_id, deal_id, plan_id) on public.documents to authenticated;
alter table public.doc_folders enable row level security;
alter table public.documents enable row level security;
create policy "doc_folders_select" on public.doc_folders for select to authenticated using ((select private.staff_can('crm.view')));
create policy "doc_folders_write" on public.doc_folders for all to authenticated
  using ((select private.staff_can('crm.manage') or private.staff_can('projects.manage'))) with check ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')));
create policy "documents_select" on public.documents for select to authenticated using ((select private.staff_can('crm.view')));
create policy "documents_write" on public.documents for all to authenticated
  using ((select private.staff_can('crm.manage') or private.staff_can('projects.manage'))) with check ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')));

-- Files: private bucket "documents", path <document id>/<file name>. Staff
-- read (signed links); editors upload and delete.
insert into storage.buckets (id, name, public, file_size_limit) values ('documents', 'documents', false, 52428800) on conflict (id) do nothing;
create policy "documents_bucket_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select private.staff_can('crm.view')));
create policy "documents_bucket_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select private.staff_can('crm.manage') or private.staff_can('projects.manage')));
create policy "documents_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select private.staff_can('crm.manage') or private.staff_can('projects.manage')));

-- ---------------------------------------------------------------------------
-- Workspace: shared docs (team or private), nested pages, comments
-- ---------------------------------------------------------------------------
create table public.workspace_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled' check (char_length(title) between 1 and 200),
  icon text check (char_length(icon) <= 8),
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb check (pg_column_size(content) <= 2000000),
  content_text text not null default '' check (char_length(content_text) <= 500000),
  parent_id uuid references public.workspace_docs (id) on delete cascade,
  visibility text not null default 'team' check (visibility in ('team', 'private')),
  pinned boolean not null default false,
  company_id uuid references public.crm_companies (id) on delete set null,
  deal_id uuid references public.crm_deals (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_docs_parent_idx on public.workspace_docs (parent_id);
create index workspace_docs_company_idx on public.workspace_docs (company_id);
create index workspace_docs_deal_idx on public.workspace_docs (deal_id);
create index workspace_docs_created_by_idx on public.workspace_docs (created_by);
create index workspace_docs_updated_by_idx on public.workspace_docs (updated_by);
create index workspace_docs_updated_idx on public.workspace_docs (updated_at desc);

create function private.workspace_doc_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
revoke execute on function private.workspace_doc_touch() from public, anon, authenticated;
create trigger workspace_docs_touch before update on public.workspace_docs for each row execute function private.workspace_doc_touch();

create table public.workspace_comments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.workspace_docs (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  quote text check (char_length(quote) <= 500),
  resolved boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index workspace_comments_doc_idx on public.workspace_comments (doc_id, created_at);
create index workspace_comments_created_by_idx on public.workspace_comments (created_by);

revoke all on public.workspace_docs, public.workspace_comments from anon, authenticated;
grant select, delete on public.workspace_docs, public.workspace_comments to authenticated;
grant insert (title, icon, content, content_text, parent_id, visibility, pinned, company_id, deal_id),
      update (title, icon, content, content_text, parent_id, visibility, pinned, company_id, deal_id) on public.workspace_docs to authenticated;
grant insert (doc_id, body, quote), update (resolved) on public.workspace_comments to authenticated;
alter table public.workspace_docs enable row level security;
alter table public.workspace_comments enable row level security;
-- Team docs: any staff with CRM access reads, editors edit. Private docs:
-- only their author.
create policy "workspace_docs_select" on public.workspace_docs for select to authenticated
  using ((select private.staff_can('crm.view')) and (visibility = 'team' or created_by = (select auth.uid())));
create policy "workspace_docs_insert" on public.workspace_docs for insert to authenticated
  with check ((select private.staff_can('crm.view')));
create policy "workspace_docs_update" on public.workspace_docs for update to authenticated
  using ((select private.staff_can('crm.view')) and (created_by = (select auth.uid()) or (visibility = 'team' and (select private.staff_can('crm.manage') or private.staff_can('projects.manage')))))
  with check ((select private.staff_can('crm.view')) and (created_by = (select auth.uid()) or (visibility = 'team' and (select private.staff_can('crm.manage') or private.staff_can('projects.manage')))));
create policy "workspace_docs_delete" on public.workspace_docs for delete to authenticated
  using ((select private.staff_can('crm.view')) and (created_by = (select auth.uid()) or (visibility = 'team' and (select private.staff_can('crm.manage')))));
create policy "workspace_comments_select" on public.workspace_comments for select to authenticated
  using (exists (select 1 from public.workspace_docs d where d.id = doc_id));
create policy "workspace_comments_insert" on public.workspace_comments for insert to authenticated
  with check (exists (select 1 from public.workspace_docs d where d.id = doc_id));
create policy "workspace_comments_update" on public.workspace_comments for update to authenticated
  using (exists (select 1 from public.workspace_docs d where d.id = doc_id)) with check (exists (select 1 from public.workspace_docs d where d.id = doc_id));
create policy "workspace_comments_delete" on public.workspace_comments for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.staff_can('crm.manage')));

-- ---------------------------------------------------------------------------
-- Business cards
-- ---------------------------------------------------------------------------
create table public.business_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  owner_id uuid references auth.users (id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  title text check (char_length(title) <= 120),
  company text check (char_length(company) <= 120),
  bio text check (char_length(bio) <= 1000),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  website text check (char_length(website) <= 300),
  address text check (char_length(address) <= 300),
  photo_url text check (char_length(photo_url) <= 1000),
  logo_url text check (char_length(logo_url) <= 1000),
  accent text not null default '#18181b' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  theme text not null default 'light' check (theme in ('light', 'dark')),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and pg_column_size(links) <= 8192),
  lead_capture boolean not null default true,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_cards_owner_idx on public.business_cards (owner_id);
create index business_cards_created_by_idx on public.business_cards (created_by);
create trigger business_cards_updated_at before update on public.business_cards for each row execute function public.set_updated_at();

create table public.card_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.business_cards (id) on delete cascade,
  kind text not null check (kind in ('view', 'save', 'click', 'share', 'qr', 'nfc', 'lead')),
  detail text check (char_length(detail) <= 200),
  created_at timestamptz not null default now()
);
create index card_events_card_idx on public.card_events (card_id, created_at desc);

create table public.card_leads (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.business_cards (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  company text check (char_length(company) <= 200),
  message text check (char_length(message) <= 2000),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index card_leads_card_idx on public.card_leads (card_id, created_at desc);
create index card_leads_contact_idx on public.card_leads (contact_id);

revoke all on public.business_cards, public.card_events, public.card_leads from anon, authenticated;
grant select, delete on public.business_cards, public.card_leads to authenticated;
grant select on public.card_events to authenticated;
grant insert (slug, owner_id, full_name, title, company, bio, email, phone, website, address, photo_url, logo_url, accent, theme, links, lead_capture, active),
      update (slug, owner_id, full_name, title, company, bio, email, phone, website, address, photo_url, logo_url, accent, theme, links, lead_capture, active)
  on public.business_cards to authenticated;
alter table public.business_cards enable row level security;
alter table public.card_events enable row level security;
alter table public.card_leads enable row level security;
create policy "business_cards_select" on public.business_cards for select to authenticated using ((select private.staff_can('crm.view')));
create policy "business_cards_write" on public.business_cards for all to authenticated
  using ((select private.staff_can('crm.manage')) or owner_id = (select auth.uid()) and (select private.staff_can('crm.view')))
  with check ((select private.staff_can('crm.manage')) or owner_id = (select auth.uid()) and (select private.staff_can('crm.view')));
create policy "card_events_select" on public.card_events for select to authenticated using ((select private.staff_can('crm.view')));
create policy "card_leads_select" on public.card_leads for select to authenticated using ((select private.staff_can('crm.view')));
create policy "card_leads_delete" on public.card_leads for delete to authenticated using ((select private.staff_can('crm.manage')));

-- Card photos and logos: public bucket "cards" (images people see on the card).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']) on conflict (id) do nothing;
create policy "cards_bucket_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'cards' and (select private.staff_can('crm.view')));
create policy "cards_bucket_update" on storage.objects for update to authenticated
  using (bucket_id = 'cards' and (select private.staff_can('crm.view')));
create policy "cards_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cards' and (select private.staff_can('crm.manage')));

-- Public card page data (active cards only).
create function public.card_public(p_slug text)
returns table (slug text, full_name text, title text, company text, bio text, email text, phone text, website text, address text,
               photo_url text, logo_url text, accent text, theme text, links jsonb, lead_capture boolean)
language sql stable security definer set search_path = '' as $$
  select c.slug, c.full_name, c.title, c.company, c.bio, c.email, c.phone, c.website, c.address, c.photo_url, c.logo_url, c.accent, c.theme, c.links, c.lead_capture
  from public.business_cards c where c.slug = p_slug and c.active;
$$;
revoke execute on function public.card_public(text) from public;
grant execute on function public.card_public(text) to anon, authenticated;

-- Card analytics from the public page (views, saves, link clicks, shares).
create function public.card_track(p_slug text, p_kind text, p_detail text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_kind not in ('view', 'save', 'click', 'share', 'qr', 'nfc') then return; end if;
  select id into v_id from public.business_cards where slug = p_slug and active;
  if v_id is null then return; end if;
  insert into public.card_events (card_id, kind, detail) values (v_id, p_kind, left(p_detail, 200));
end $$;
revoke execute on function public.card_track(text, text, text) from public;
grant execute on function public.card_track(text, text, text) to anon, authenticated;

-- "Share your info" on a card: saves the lead, adds them to the CRM as a lead
-- owned by the card's owner, and notifies the owner. 5 per email per day.
create function public.card_lead(p_slug text, p_name text, p_email text, p_phone text, p_company text, p_message text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.business_cards;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := left(trim(coalesce(p_name, '')), 200);
  v_contact uuid;
begin
  select * into c from public.business_cards where slug = p_slug and active and lead_capture;
  if c.id is null then raise exception 'This card isn''t taking contact details' using errcode = '22023'; end if;
  if v_name = '' then raise exception 'Enter your name' using errcode = '22023'; end if;
  if v_email = '' and coalesce(trim(p_phone), '') = '' then raise exception 'Enter an email or phone number' using errcode = '22023'; end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if v_email <> '' and (select count(*) from public.card_leads where lower(email) = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Thanks, we already have your details.' using errcode = '54000';
  end if;
  if v_email <> '' then select id into v_contact from public.crm_contacts where lower(email) = v_email limit 1; end if;
  if v_contact is null then
    insert into public.crm_contacts (first_name, last_name, email, phone, source, role, lead_status, owner_id, notes)
    values (split_part(v_name, ' ', 1), nullif(substr(v_name, length(split_part(v_name, ' ', 1)) + 2), ''), nullif(v_email, ''),
            left(nullif(trim(p_phone), ''), 40), 'Business card', 'lead', 'new', c.owner_id, left(nullif(trim(p_message), ''), 2000))
    returning id into v_contact;
  end if;
  insert into public.card_leads (card_id, name, email, phone, company, message, contact_id)
  values (c.id, v_name, nullif(v_email, ''), left(nullif(trim(p_phone), ''), 40), left(nullif(trim(p_company), ''), 200), left(nullif(trim(p_message), ''), 2000), v_contact);
  insert into public.card_events (card_id, kind) values (c.id, 'lead');
  if c.owner_id is not null then
    perform private.notify(c.owner_id, 'card_lead', 'New contact from your card: ' || v_name, coalesce(nullif(v_email, ''), p_phone), '/admin/contacts/' || v_contact, '{}'::jsonb);
  end if;
end $$;
revoke execute on function public.card_lead(text, text, text, text, text, text) from public;
grant execute on function public.card_lead(text, text, text, text, text, text) to anon, authenticated;
