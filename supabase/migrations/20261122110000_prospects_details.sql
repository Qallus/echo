-- Prospects carry the same business and contact details as CRM contacts, so
-- Send to Leads moves everything over: a contact person (name, title, email),
-- phone extension, full address with suite, ZIP and country, how many
-- locations, and tags.
alter table public.prospects
  add column contact_first_name text check (char_length(contact_first_name) <= 100),
  add column contact_last_name text check (char_length(contact_last_name) <= 100),
  add column contact_title text check (char_length(contact_title) <= 120),
  add column email text check (char_length(email) <= 200),
  add column phone_ext text check (phone_ext ~ '^[0-9]{1,8}$'),
  add column address2 text check (char_length(address2) <= 100),
  add column zip text check (char_length(zip) <= 20),
  add column country text check (char_length(country) <= 60),
  add column locations integer check (locations between 1 and 100000),
  add column tags text[] not null default '{}' check (cardinality(tags) <= 20);

grant insert (contact_first_name, contact_last_name, contact_title, email, phone_ext, address2, zip, country, locations, tags),
      update (contact_first_name, contact_last_name, contact_title, email, phone_ext, address2, zip, country, locations, tags)
  on public.prospects to authenticated;

notify pgrst, 'reload schema';
