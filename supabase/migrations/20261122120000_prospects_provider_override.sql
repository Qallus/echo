-- What you know beats what the lookup can see. Twilio reports the carrier
-- that holds a number (often a wholesale carrier like Level 3, Bandwidth or
-- Inteliquent), not who the business pays or which phone system it uses.
-- provider_override: the provider you confirmed (e.g. ringcentral), which
--   then drives the Provider column and the score.
-- provider_note: the detail, e.g. "RingCentral through Cox/Spectrum, bill paid to Cox".
alter table public.prospects
  add column provider_override text check (provider_override in ('ringcentral', 'cox', 'spectrum', 'lumen', 'mobile', 'other_voip', 'landline')),
  add column provider_note text check (char_length(provider_note) <= 300);

grant insert (provider_override, provider_note), update (provider_override, provider_note) on public.prospects to authenticated;

notify pgrst, 'reload schema';
