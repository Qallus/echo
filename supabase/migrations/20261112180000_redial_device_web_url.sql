-- The phone's own settings page (its address on the member's network, e.g.
-- https://192.168.4.119), saved by the owner so the Phones page can link to
-- it. Only http(s) links; it opens on the phone's network only.

alter table public.redial_devices
  add column web_url text check (web_url is null or (char_length(web_url) <= 200 and web_url ~ '^https?://[^[:space:]<>"''`]+$'));

grant select (web_url) on public.redial_devices to authenticated;
grant update (web_url) on public.redial_devices to authenticated;
