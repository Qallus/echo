-- Prospects on a map: latitude/longitude from the address (or the city when
-- there's no street address), filled in after import via OpenStreetMap.
-- geocoded_at marks rows already tried, found or not, so they aren't retried
-- on every import.
alter table public.prospects
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column geocoded_at timestamptz;

grant update (latitude, longitude, geocoded_at) on public.prospects to authenticated;

notify pgrst, 'reload schema';
