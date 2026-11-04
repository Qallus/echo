-- Redial billing: screening minutes as their own meter.
-- * catalog_products.meter: 'transcription' (Echo) or 'redial'. Redial
--   subscriptions are bolt-ons whose minutes are AI screening minutes a month;
--   Redial packs add screening minutes valid for 12 months.
-- * redial_calls.ai_seconds: time the AI assistant spent on the call
--   (reported by the voice gateway). Each call rounds up to whole minutes.
-- * public.redial_usage(user): this month's minutes against the allowance
--   (plan + unused pack minutes, or the free minutes from billing settings).
--   The voice webhook stops AI screening at the limit (voicemail instead);
--   nothing is charged automatically.

alter table public.catalog_products
  add column meter text not null default 'transcription' check (meter in ('transcription', 'redial'));

alter table public.redial_calls add column ai_seconds integer check (ai_seconds between 0 and 3600);

insert into public.catalog_products (id, kind, name, tagline, features, per_seat, minutes, sort, meter) values
  ('redial', 'bolt_on', 'Redial call screening', 'An AI assistant answers your Redial number, screens unknown callers and takes messages. 50 screening minutes a month.', '{}', false, 50, 60, 'redial'),
  ('redial_min100', 'pack', '100 screening minutes', 'Extra Redial screening minutes. Valid for 12 months.', '{}', false, 100, 70, 'redial')
on conflict (id) do nothing;
insert into public.catalog_prices (key, product_id, interval, unit_amount) values
  ('redial_monthly', 'redial', 'month', 2900),
  ('redial_annual', 'redial', 'year', 29000),
  ('pack_redial_100', 'redial_min100', null, 1500)
on conflict (key) do nothing;

update public.platform_settings set value = value || '{"redialFreeMinutes": 10}'
where key = 'billing' and not (value ? 'redialFreeMinutes');

create function public.redial_usage(p_user uuid default auth.uid())
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
  join public.catalog_products p on p.id = cp.product_id and p.meter = 'redial' and p.kind = 'bolt_on'
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
revoke execute on function public.redial_usage(uuid) from public, anon;
grant execute on function public.redial_usage(uuid) to authenticated, service_role;
