-- The Redial assistant no longer has one house name. People name their own
-- (suggested: Ara, Rex, Eve, Leo, each matching a voice). New lines start as
-- Ara, which matches the default 'ara' voice. Plan copy in the catalog stops
-- naming the assistant.
alter table public.redial_lines alter column assistant_name set default 'Ara';

update public.catalog_products set features = array[
  '100 AI screening minutes a month', 'Your assistant answers unknown callers for you', 'Listen in, guide your assistant, take over or transfer',
  'Callbacks and a summary of every call', 'VIP and block lists', 'Echo recordings and transcripts included'
] where id = 'redial_personal' and features::text like '%DJ%';

update public.catalog_products set features = array[
  '300 AI screening minutes a month per line', 'Your assistant knows your services, hours and FAQs', 'Transfer calls to your team',
  'Share a line with teammates', 'Summaries ready for your CRM', 'Everything in Personal'
] where id = 'redial_business' and features::text like '%DJ%';

update public.catalog_products set tagline = 'A business phone system with an AI receptionist.', features = array[
  'A business number per line, or bring yours', 'Unlimited calling in the US and Canada', 'Up to 3 desk or Wi-Fi phones per line',
  '300 AI screening minutes a month per line', 'Extensions and transfers through Directory', 'Listen in, guide your assistant, take over',
  'Summaries ready for your CRM'
] where id = 'redial_business_phone' and (tagline like '%DJ%' or features::text like '%DJ%');
