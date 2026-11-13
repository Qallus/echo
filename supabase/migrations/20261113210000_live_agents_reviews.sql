-- Live Agents step 8: two-way reviews and the ranking signals Redial
-- computes (rating, completed engagements, reply time, badges).
--
-- After completed work each side reviews the other. Reviews stay hidden
-- until both have reviewed, or 14 days pass, so neither can retaliate.
-- An agent's public rating comes only from businesses' revealed reviews.

create table public.live_agent_reviews (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.live_agent_engagements on delete cascade,
  thread_id uuid not null references public.live_agent_threads on delete cascade,
  agent_id uuid not null references public.live_agents on delete cascade,
  author_side text not null check (author_side in ('business', 'agent')),
  author_id uuid references auth.users on delete set null,
  rating int not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  unique (engagement_id, author_side)
);
create index live_agent_reviews_agent_idx on public.live_agent_reviews (agent_id, revealed_at desc);
create index live_agent_reviews_thread_idx on public.live_agent_reviews (thread_id);
create index live_agent_reviews_author_idx on public.live_agent_reviews (author_id);

revoke all on public.live_agent_reviews from anon, authenticated;
grant select on public.live_agent_reviews to authenticated;
alter table public.live_agent_reviews enable row level security;
-- Participants see their engagement's reviews: their own always, the other
-- side's once revealed.
create policy "live_agent_reviews_select" on public.live_agent_reviews for select to authenticated
  using ((select private.live_agent_side(thread_id)) is not null
         and (revealed_at is not null or author_id = (select auth.uid())));

-- Recompute an agent's public numbers.
create or replace function private.live_agent_refresh_stats(a uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rating numeric;
  v_count int;
  v_done int;
begin
  select round(avg(rating)::numeric, 2), count(*) into v_rating, v_count
  from public.live_agent_reviews where agent_id = a and author_side = 'business' and revealed_at is not null;
  select count(*) into v_done from public.live_agent_engagements where agent_id = a and status = 'completed';
  update public.live_agents set rating = case when v_count > 0 then v_rating end, review_count = v_count, engagement_count = v_done,
    badges = array(select b from unnest(badges) b where b <> 'top-rated')
             || case when v_count >= 10 and v_rating >= 4.8 then array['top-rated'] else array[]::text[] end
  where id = a and not is_demo;
end $$;
revoke execute on function private.live_agent_refresh_stats(uuid) from public, anon, authenticated;

-- Leave a review of completed work (once per side).
create or replace function public.live_agent_review(engagement uuid, stars int, body text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.live_agent_engagements;
  side text;
  other uuid;
begin
  select * into e from public.live_agent_engagements where id = engagement;
  if e.id is null then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  side := private.live_agent_side(e.thread_id);
  if side is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if e.status <> 'completed' then raise exception 'You can review once the work is complete.' using errcode = '22023'; end if;
  if stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars.' using errcode = '22023'; end if;
  insert into public.live_agent_reviews (engagement_id, thread_id, agent_id, author_side, author_id, rating, body)
  values (engagement, e.thread_id, e.agent_id, side, auth.uid(), stars, nullif(left(trim(coalesce(body, '')), 1000), ''))
  on conflict (engagement_id, author_side) do nothing;
  if not found then raise exception 'You''ve already reviewed this booking.' using errcode = '22023'; end if;

  -- Both sides in: reveal both.
  select id into other from public.live_agent_reviews where engagement_id = engagement and author_side <> side;
  if other is not null then
    update public.live_agent_reviews set revealed_at = now() where engagement_id = engagement and revealed_at is null;
    perform private.live_agent_refresh_stats(e.agent_id);
    perform private.live_agent_post(e.thread_id, 'system', 'system', 'You''ve both left reviews. They''re now visible.', engagement);
  else
    perform private.live_agent_post(e.thread_id, 'system', 'system',
      case side when 'business' then 'The business left a review. Leave yours to see it (reviews show after both, or in 14 days).'
                else 'The Live Agent left a review. Leave yours to see it (reviews show after both, or in 14 days).' end, engagement);
  end if;
end $$;
revoke execute on function public.live_agent_review(uuid, int, text) from public, anon;
grant execute on function public.live_agent_review(uuid, int, text) to authenticated;

-- Public: an agent's revealed reviews from businesses.
create or replace function public.live_agent_public_reviews(agent uuid)
returns table (rating int, body text, business_name text, type text, revealed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.rating, r.body, t.business_name, e.type, r.revealed_at
  from public.live_agent_reviews r
  join public.live_agent_threads t on t.id = r.thread_id
  join public.live_agent_engagements e on e.id = r.engagement_id
  join public.live_agents a on a.id = r.agent_id
  where r.agent_id = agent and r.author_side = 'business' and r.revealed_at is not null and a.status = 'live'
  order by r.revealed_at desc
  limit 50;
$$;
revoke execute on function public.live_agent_public_reviews(uuid) from public;
grant execute on function public.live_agent_public_reviews(uuid) to anon, authenticated;

-- The scheduled job (service role): reveal reviews older than 14 days,
-- recompute reply times and stats, and set "ID verified" from Stripe.
create or replace function public.live_agent_refresh_all()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  n int := 0;
begin
  update public.live_agent_reviews set revealed_at = now() where revealed_at is null and created_at < now() - interval '14 days';
  for a in select id from public.live_agents where status in ('live', 'paused') and not is_demo loop
    -- Typical reply time: the median minutes from a business's first message
    -- in a thread to the agent's first reply (threads with a reply).
    update public.live_agents set reply_minutes = (
      select percentile_cont(0.5) within group (order by extract(epoch from (r.first_reply - b.first_msg)) / 60)::int
      from public.live_agent_threads t
      cross join lateral (select min(created_at) first_msg from public.live_agent_messages m where m.thread_id = t.id and m.sender_side = 'business') b
      cross join lateral (select min(created_at) first_reply from public.live_agent_messages m where m.thread_id = t.id and m.sender_side = 'agent' and m.created_at > b.first_msg) r
      where t.agent_id = a.id and r.first_reply is not null)
    where id = a.id;
    update public.live_agents set badges = array(select b from unnest(badges) b where b <> 'fast-responder')
      || case when reply_minutes is not null and reply_minutes <= 60
               and (select count(*) from public.live_agent_threads where agent_id = a.id) >= 3 then array['fast-responder'] else array[]::text[] end
    where id = a.id;
    perform private.live_agent_refresh_stats(a.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.live_agent_refresh_all() from public, anon, authenticated;
grant execute on function public.live_agent_refresh_all() to service_role;

create or replace function public.live_agent_set_verified(agent uuid, verified boolean)
returns void
language sql security definer set search_path = '' as $$
  update public.live_agents set badges = array(select b from unnest(badges) b where b <> 'id-verified')
    || case when verified then array['id-verified'] else array[]::text[] end
  where id = agent and not is_demo;
$$;
revoke execute on function public.live_agent_set_verified(uuid, boolean) from public, anon, authenticated;
grant execute on function public.live_agent_set_verified(uuid, boolean) to service_role;
