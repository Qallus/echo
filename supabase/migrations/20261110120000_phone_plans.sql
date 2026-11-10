-- Redial phone service: Home Phone and Business Phone plans.
-- * catalog_products.phones: how many desk, cordless or Wi-Fi (SIP) phones a
--   plan includes, per line when per-seat. Null means the plan isn't phone
--   service. Desk phones themselves arrive in a later step.
-- * Prices are starting points; change them in Admin > Billing, then sync to
--   Stripe.

alter table public.catalog_products
  add column phones integer check (phones between 1 and 100);

grant select (phones) on public.catalog_products to anon, authenticated;
grant insert (phones), update (phones) on public.catalog_products to authenticated;

insert into public.catalog_products (id, kind, name, tagline, features, per_seat, minutes, sort, meter, product_line, phones) values
  ('redial_home_phone', 'plan', 'Redial Home Phone', 'A home phone that screens its own calls.',
    array['A local number, or bring your own', 'Unlimited calling in the US and Canada', 'Up to 4 cordless or desk phones, plus the Redial app', '100 AI screening minutes a month', 'Spam never rings, family always gets through', 'Voicemail and a summary of every call', '911 with your registered address'],
    false, 100, -8, 'redial', 'redial', 4),
  ('redial_business_phone', 'plan', 'Redial Business Phone', 'A business phone system with DJ at the front desk.',
    array['A business number per line, or bring yours', 'Unlimited calling in the US and Canada', 'Up to 3 desk or Wi-Fi phones per line', '300 AI screening minutes a month per line', 'Extensions and transfers through Directory', 'Listen in, guide DJ, take over', 'Summaries ready for your CRM'],
    true, 300, -6, 'redial', 'redial', 3)
on conflict (id) do nothing;

insert into public.catalog_prices (key, product_id, interval, unit_amount) values
  ('redial_home_phone_monthly', 'redial_home_phone', 'month', 1500),
  ('redial_home_phone_annual', 'redial_home_phone', 'year', 15000),
  ('redial_business_phone_monthly', 'redial_business_phone', 'month', 2500),
  ('redial_business_phone_annual', 'redial_business_phone', 'year', 25000)
on conflict (key) do nothing;
