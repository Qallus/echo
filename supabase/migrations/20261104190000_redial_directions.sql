-- Redial step 5 (Audible): private typed directions to the AI during a call.
-- The caller never sees or hears them. redial_direct() checks direct_agent,
-- that the AI is still handling the call (not taken over), and a per-call
-- limit, then records it as "sending". Only the voice gateway (through the
-- signed result webhook) marks one "delivered", when it has actually given
-- it to the AI; the sender can only mark their own as "failed". Delivered
-- means the AI received it, not that it followed it.

create table public.redial_live_directions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.redial_calls (id) on delete cascade,
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  text text not null check (char_length(text) between 1 and 500),
  status text not null default 'sending' check (status in ('sending', 'delivered', 'failed')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index redial_live_directions_call_idx on public.redial_live_directions (call_id, created_at);
create index redial_live_directions_line_idx on public.redial_live_directions (line_id);
create index redial_live_directions_author_idx on public.redial_live_directions (author_id);

revoke all on public.redial_live_directions from anon, authenticated;
grant select on public.redial_live_directions to authenticated;
alter table public.redial_live_directions enable row level security;
create policy "redial_live_directions_select" on public.redial_live_directions for select to authenticated
  using ((select private.redial_can(line_id, 'direct_agent')));

create function public.redial_direct(p_call uuid, p_text text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.redial_calls;
  v_id uuid;
  v_text text := left(trim(coalesce(p_text, '')), 500);
begin
  select * into c from public.redial_calls where id = p_call;
  if c.id is null or not private.redial_can(c.line_id, 'direct_agent') then
    raise exception 'You can''t guide the assistant on this call.' using errcode = '42501';
  end if;
  if v_text = '' then raise exception 'Type a direction first.' using errcode = '22023'; end if;
  if c.status <> 'screening' or exists (select 1 from public.redial_live_sessions s where s.call_id = p_call and (s.taken_over_by is not null or s.ai_state in ('left', 'failed', 'removed'))) then
    raise exception 'The assistant isn''t on this call any more.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.redial_live_directions d where d.call_id = p_call) >= 20 then
    raise exception 'That''s the limit of 20 directions for one call.' using errcode = 'P0001';
  end if;
  insert into public.redial_live_directions (call_id, line_id, author_id, text) values (p_call, c.line_id, (select auth.uid()), v_text)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.redial_direct(uuid, text) from public, anon;
grant execute on function public.redial_direct(uuid, text) to authenticated;

create function public.redial_direction_failed(p_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.redial_live_directions set status = 'failed'
  where id = p_id and author_id = (select auth.uid()) and status = 'sending';
$$;
revoke execute on function public.redial_direction_failed(uuid) from public, anon;
grant execute on function public.redial_direction_failed(uuid) to authenticated;
