-- Client logos (Admin -> Clients), like contact photos: a small image made in
-- the browser from an upload (data:image/..., a few KB) or an https link.
alter table public.crm_companies
  add column logo text check (logo is null or (
    (logo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and char_length(logo) <= 40000)
    or (logo ~ '^https://[^[:space:]<>"''`]+$' and char_length(logo) <= 500)));

grant insert (logo), update (logo) on public.crm_companies to authenticated;
