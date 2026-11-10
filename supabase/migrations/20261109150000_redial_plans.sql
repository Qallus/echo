-- Separate Redial plans (docs/REDIAL_GROWTH_AND_AUTOMATION_PLAN.md, A2).
-- * catalog_products.product_line: 'echo' or 'redial'. Someone can hold one
--   plan in each line.
-- * catalog_products.echo_minutes: Echo transcription minutes a Redial plan
--   includes (the Redial Business + Echo Pro bundle), per line when per-seat.
-- * Redial Personal, Business (per line), Team, and the bundle. Prices are
--   starting points; change them in Admin > Billing, then sync to Stripe.
-- * The old Redial bolt-on stops being sold; anyone who has it keeps its
--   minutes (redial_usage counts Redial bolt-ons and plans).

alter table public.catalog_products
  add column product_line text not null default 'echo' check (product_line in ('echo', 'redial')),
  add column echo_minutes integer check (echo_minutes between 0 and 1000000);

update public.catalog_products set product_line = 'redial' where meter = 'redial';

grant select (product_line, echo_minutes) on public.catalog_products to anon, authenticated;
grant insert (product_line, echo_minutes), update (product_line, echo_minutes) on public.catalog_products to authenticated;

insert into public.catalog_products (id, kind, name, tagline, features, per_seat, minutes, sort, meter, product_line, echo_minutes) values
  ('redial_personal', 'plan', 'Redial Personal', 'Your own cell, without the interruptions.',
    array['100 AI screening minutes a month', 'DJ answers unknown callers for you', 'Listen in, guide DJ, take over or transfer', 'Callbacks and a summary of every call', 'VIP and block lists', 'Echo recordings and transcripts included'],
    false, 100, -40, 'redial', 'redial', null),
  ('redial_business', 'plan', 'Redial Business', 'An assistant on the line for every customer.',
    array['300 AI screening minutes a month per line', 'DJ knows your services, hours and FAQs', 'Transfer calls to your team', 'Share a line with teammates', 'Summaries ready for your CRM', 'Everything in Personal'],
    true, 300, -30, 'redial', 'redial', null),
  ('redial_team', 'plan', 'Redial Team', 'Five lines for a growing team.',
    array['5 lines sharing 1,000 AI minutes a month', 'Everything in Business', 'Priority support'],
    false, 1000, -20, 'redial', 'redial', null),
  ('redial_business_pro', 'plan', 'Redial Business + Echo Pro', 'Every call screened, every meeting recorded.',
    array['Everything in Redial Business, per line', 'Echo Pro: 2,000 transcription minutes a month per line', 'Branded PDF reports, Ask Echo with Claude, ChatGPT and Grok', 'Save $5 a month per line'],
    true, 300, -10, 'redial', 'redial', 2000)
on conflict (id) do nothing;

insert into public.catalog_prices (key, product_id, interval, unit_amount) values
  ('redial_personal_monthly', 'redial_personal', 'month', 1200),
  ('redial_personal_annual', 'redial_personal', 'year', 12000),
  ('redial_business_monthly', 'redial_business', 'month', 2900),
  ('redial_business_annual', 'redial_business', 'year', 29000),
  ('redial_team_monthly', 'redial_team', 'month', 6900),
  ('redial_team_annual', 'redial_team', 'year', 69000),
  ('redial_bundle_monthly', 'redial_business_pro', 'month', 3900),
  ('redial_bundle_annual', 'redial_business_pro', 'year', 39000)
on conflict (key) do nothing;

update public.catalog_products set active = false where id = 'redial';

-- Redial minutes now come from Redial plans as well as the old bolt-on.
create or replace function public.redial_usage(p_user uuid default auth.uid())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text := private.org_timezone();
  month_start timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
  plan_min int;
  free_min int;
  packs int;
  pack_used int;
  used_sec bigint;
  used_min int;
begin
  if p_user is null or not (p_user = (select auth.uid()) or private.staff_can('users.view') or (select auth.role()) = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(sum(p.minutes * greatest(coalesce((i ->> 'quantity')::int, 1), 1)), 0) into plan_min
  from public.subscriptions s
  cross join lateral jsonb_array_elements(s.items) i
  join public.catalog_prices cp on cp.key = i ->> 'price_key'
  join public.catalog_products p on p.id = cp.product_id and p.meter = 'redial' and p.kind in ('bolt_on', 'plan')
  where s.user_id = p_user and s.status in ('active', 'trialing', 'past_due');

  select coalesce((value ->> 'redialFreeMinutes')::int, 10) into free_min from public.platform_settings where key = 'billing';
  free_min := coalesce(free_min, 10);
  if plan_min = 0 then plan_min := free_min; end if;

  select coalesce(sum(p.minutes * oi.quantity), 0) into packs
  from public.order_items oi
  join public.orders o on o.id = oi.order_id and o.user_id = p_user and o.status = 'paid' and o.created_at > now() - interval '365 days'
  join public.catalog_prices cp on cp.key = oi.price_key
  join public.catalog_products p on p.id = cp.product_id and p.meter = 'redial' and p.kind = 'pack';

  -- Pack minutes already spent: minutes over the monthly allowance in earlier
  -- months of the last year (approximated with today's allowance).
  select coalesce(sum(greatest(m.minutes - plan_min, 0)), 0) into pack_used from (
    select date_trunc('month', c.started_at at time zone tz) as mon, sum(ceil(c.ai_seconds / 60.0))::int as minutes
    from public.redial_calls c
    where c.owner_id = p_user and c.ai_seconds > 0 and c.started_at > now() - interval '365 days' and c.started_at < month_start
    group by 1) m;

  select coalesce(sum(c.ai_seconds), 0), coalesce(sum(ceil(c.ai_seconds / 60.0)), 0)::int into used_sec, used_min
  from public.redial_calls c where c.owner_id = p_user and c.ai_seconds > 0 and c.started_at >= month_start;

  return jsonb_build_object(
    'used_minutes', used_min, 'used_seconds', used_sec, 'plan_minutes', plan_min, 'free', plan_min = free_min and not exists (
      select 1 from public.subscriptions s cross join lateral jsonb_array_elements(s.items) i
      join public.catalog_prices cp on cp.key = i ->> 'price_key'
      join public.catalog_products p on p.id = cp.product_id and p.meter = 'redial'
      where s.user_id = p_user and s.status in ('active', 'trialing', 'past_due')),
    'pack_minutes', greatest(packs - pack_used, 0),
    'allowance', plan_min + greatest(packs - pack_used, 0),
    'remaining_seconds', greatest((plan_min + greatest(packs - pack_used, 0)) * 60 - used_min * 60, 0),
    'period_start', month_start);
end $$;
