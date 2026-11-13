-- Contacts keep everything a phone knows about a person: a profile photo,
-- every phone number, email and address (each with its label), and a
-- birthday. The single phone, email and address columns stay the primary
-- ones, so search, texting, email and duplicate checks work as before.
--
-- photo: a small thumbnail made in the browser (data:image/... about 3 KB),
--   or an https link. Staff-only like the rest of the CRM, so no storage
--   bucket is needed.
-- phones / emails: [{"label": "mobile", "value": "+14805551234"}, ...]
-- addresses: [{"label": "home", "street": "", "city": "", "state": "", "zip": "", "country": ""}, ...]

alter table public.crm_contacts
  add column photo text check (photo is null or (
    (photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and char_length(photo) <= 40000)
    or (photo ~ '^https://[^[:space:]<>"''`]+$' and char_length(photo) <= 500))),
  add column phones jsonb not null default '[]'::jsonb check (jsonb_typeof(phones) = 'array' and jsonb_array_length(phones) <= 20 and pg_column_size(phones) <= 4096),
  add column emails jsonb not null default '[]'::jsonb check (jsonb_typeof(emails) = 'array' and jsonb_array_length(emails) <= 20 and pg_column_size(emails) <= 4096),
  add column addresses jsonb not null default '[]'::jsonb check (jsonb_typeof(addresses) = 'array' and jsonb_array_length(addresses) <= 10 and pg_column_size(addresses) <= 8192),
  add column birthday date check (birthday is null or birthday between date '1900-01-01' and date '2100-12-31');

grant insert (photo, phones, emails, addresses, birthday),
      update (photo, phones, emails, addresses, birthday)
  on public.crm_contacts to authenticated;
