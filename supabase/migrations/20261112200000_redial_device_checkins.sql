-- Phone check-ins: each time a phone downloads its settings (at start-up and
-- then every hour), Redial records when, and the firmware version the phone
-- reports. The Phones page shows Online / Offline and the firmware from these.
-- Written only by the provisioning route (service role); owners can read.

alter table public.redial_devices
  add column last_seen_at timestamptz,
  add column firmware text check (firmware is null or char_length(firmware) <= 60);

grant select (last_seen_at, firmware) on public.redial_devices to authenticated;
