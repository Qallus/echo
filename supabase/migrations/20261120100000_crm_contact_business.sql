-- Contacts can be a person, a business, or both (a person and the business
-- they run), with a business name and logo, a phone extension, a full
-- address with suite, how many locations the business has, and who referred
-- them.
--
-- The first block repeats 20261114090000_crm_contact_details.sql with
-- "if not exists", so this one file works whether or not that update ran.
--
-- kind: person | business | both. A business with no person's name keeps
--   its business name in first_name, so every list still shows a name.
-- logo: like photo, a small image made in the browser or an https link.
-- referral: {"first_name": "", "last_name": "", "phone": "", "email": ""},
--   filled when source is "Referral".

alter table public.crm_contacts
  add column if not exists photo text check (photo is null or (
    (photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and char_length(photo) <= 40000)
    or (photo ~ '^https://[^[:space:]<>"''`]+$' and char_length(photo) <= 500))),
  add column if not exists phones jsonb not null default '[]'::jsonb check (jsonb_typeof(phones) = 'array' and jsonb_array_length(phones) <= 20 and pg_column_size(phones) <= 4096),
  add column if not exists emails jsonb not null default '[]'::jsonb check (jsonb_typeof(emails) = 'array' and jsonb_array_length(emails) <= 20 and pg_column_size(emails) <= 4096),
  add column if not exists addresses jsonb not null default '[]'::jsonb check (jsonb_typeof(addresses) = 'array' and jsonb_array_length(addresses) <= 10 and pg_column_size(addresses) <= 8192),
  add column if not exists birthday date check (birthday is null or birthday between date '1900-01-01' and date '2100-12-31');

alter table public.crm_contacts
  add column kind text not null default 'person' check (kind in ('person', 'business', 'both')),
  add column company_name text check (char_length(company_name) <= 200),
  add column logo text check (logo is null or (
    (logo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and char_length(logo) <= 40000)
    or (logo ~ '^https://[^[:space:]<>"''`]+$' and char_length(logo) <= 500))),
  add column phone_ext text check (phone_ext ~ '^[0-9]{1,8}$'),
  add column address2 text check (char_length(address2) <= 100),
  add column country text check (char_length(country) <= 60),
  add column locations integer check (locations between 1 and 100000),
  add column referral jsonb not null default '{}'::jsonb check (jsonb_typeof(referral) = 'object' and pg_column_size(referral) <= 2048);

grant insert (photo, phones, emails, addresses, birthday, kind, company_name, logo, phone_ext, address2, country, locations, referral),
      update (photo, phones, emails, addresses, birthday, kind, company_name, logo, phone_ext, address2, country, locations, referral)
  on public.crm_contacts to authenticated;

-- Let the API see the new columns right away.
notify pgrst, 'reload schema';
