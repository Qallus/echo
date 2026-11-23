-- Contacts and Leads on the map: coordinates from the contact's address
-- (OpenStreetMap, set by the "Place on map" action and on save).
alter table public.crm_contacts
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_address text;

grant update (latitude, longitude, geocoded_address) on public.crm_contacts to authenticated;

notify pgrst, 'reload schema';
