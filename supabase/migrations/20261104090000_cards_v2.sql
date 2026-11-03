-- Business cards v2: the full Channel-Cast card builder. Cards get a status
-- (draft, published, unpublished, archived), more profile and contact
-- fields, colors, and a design document (sections, splash page, QR, lead
-- form, media, automations). Leads get a status. Card videos can be uploaded.

alter table public.business_cards
  add column card_name text check (char_length(card_name) <= 120),
  add column status text not null default 'published' check (status in ('draft', 'published', 'unpublished', 'archived')),
  add column first_name text check (char_length(first_name) <= 60),
  add column last_name text check (char_length(last_name) <= 60),
  add column department text check (char_length(department) <= 120),
  add column sms_phone text check (char_length(sms_phone) <= 40),
  add column maps_url text check (char_length(maps_url) <= 1000),
  add column intro_video_url text check (char_length(intro_video_url) <= 1000),
  add column background_color text not null default '#ffffff' check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  add column text_color text not null default '#18181b' check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  add column background_image_url text check (char_length(background_image_url) <= 1000),
  add column nfc_status text not null default 'not_ordered' check (nfc_status in ('not_ordered', 'ordered', 'assigned', 'active')),
  add column design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object' and pg_column_size(design) <= 65536),
  add column published_at timestamptz;

alter table public.business_cards drop constraint business_cards_theme_check;
alter table public.business_cards add constraint business_cards_theme_check check (theme in ('light', 'dark', 'both'));
alter table public.business_cards drop constraint business_cards_links_check;
alter table public.business_cards add constraint business_cards_links_check check (jsonb_typeof(links) = 'array' and pg_column_size(links) <= 32768);

update public.business_cards set
  status = case when active then 'published' else 'unpublished' end,
  published_at = case when active then created_at end,
  card_name = full_name,
  background_color = case theme when 'dark' then '#09090b' else '#ffffff' end,
  text_color = case theme when 'dark' then '#fafafa' else '#18181b' end;

-- "Live" now follows the status.
alter table public.business_cards drop column active;
alter table public.business_cards add column active boolean generated always as (status = 'published') stored;

grant insert (card_name, status, first_name, last_name, department, sms_phone, maps_url, intro_video_url, background_color, text_color,
              background_image_url, nfc_status, design, published_at),
      update (card_name, status, first_name, last_name, department, sms_phone, maps_url, intro_video_url, background_color, text_color,
              background_image_url, nfc_status, design, published_at)
  on public.business_cards to authenticated;

-- Analytics: likes and copied links too.
alter table public.card_events drop constraint card_events_kind_check;
alter table public.card_events add constraint card_events_kind_check check (kind in ('view', 'save', 'click', 'share', 'qr', 'nfc', 'lead', 'like', 'copy'));

-- Leads inbox status. The card's owner or a CRM manager works the lead.
alter table public.card_leads add column status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'archived'));
grant update (status) on public.card_leads to authenticated;
create policy "card_leads_update" on public.card_leads for update to authenticated
  using ((select private.staff_can('crm.manage')) or exists (select 1 from public.business_cards c where c.id = card_id and c.owner_id = (select auth.uid())))
  with check ((select private.staff_can('crm.manage')) or exists (select 1 from public.business_cards c where c.id = card_id and c.owner_id = (select auth.uid())));

-- Splash videos (up to 100 MB) alongside photos and logos.
update storage.buckets set file_size_limit = 104857600,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
where id = 'cards';

-- Public card: everything the page shows, nothing about ownership.
drop function public.card_public(text);
create function public.card_public(p_slug text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', c.slug, 'card_name', c.card_name, 'display_name', c.full_name, 'first_name', c.first_name, 'last_name', c.last_name,
    'job_title', c.title, 'company_name', c.company, 'department', c.department, 'bio', c.bio,
    'primary_email', c.email, 'primary_phone', c.phone, 'sms_phone', c.sms_phone, 'website_url', c.website, 'address', c.address,
    'maps_url', c.maps_url, 'intro_video_url', c.intro_video_url, 'profile_photo_url', c.photo_url, 'logo_url', c.logo_url,
    'background_image_url', c.background_image_url, 'accent_color', c.accent, 'background_color', c.background_color,
    'text_color', c.text_color, 'theme_mode', c.theme, 'links', c.links, 'design', c.design, 'lead_capture', c.lead_capture)
  from public.business_cards c where c.slug = p_slug and c.active;
$$;
revoke execute on function public.card_public(text) from public;
grant execute on function public.card_public(text) to anon, authenticated;

create or replace function public.card_track(p_slug text, p_kind text, p_detail text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_kind not in ('view', 'save', 'click', 'share', 'qr', 'nfc', 'like', 'copy') then return; end if;
  select id into v_id from public.business_cards where slug = p_slug and active;
  if v_id is null then return; end if;
  insert into public.card_events (card_id, kind, detail) values (v_id, p_kind, left(p_detail, 200));
end $$;
