-- Fraud protection steps 4 and 5: inviting trusted contacts, the weekly
-- summary guard, and the setup wizard's "Protect a parent" answers.

-- When each trusted contact last got the weekly summary (server only).
alter table public.redial_trusted_contacts add column last_summary_at timestamptz;

-- The owner invites a trusted contact by text. Checks ownership, that the
-- number can be texted (not opted out, here or by replying STOP to Echo's
-- number) and that they weren't invited in the last day, then records the
-- invite. Returns ok, no_phone, opted_out, consented, too_soon or not_found.
-- The app sends the text after "ok".
create function public.redial_trusted_invite(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t public.redial_trusted_contacts;
begin
  select * into t from public.redial_trusted_contacts where id = p_id;
  if not found or not private.owns_redial_line(t.line_id) then return 'not_found'; end if;
  if t.phone is null then return 'no_phone'; end if;
  if t.sms_consent_at is not null then return 'consented'; end if;
  if t.opted_out_at is not null or exists (select 1 from public.phone_opt_outs where number = t.phone) then return 'opted_out'; end if;
  if t.invited_at is not null and t.invited_at > now() - interval '1 day' then return 'too_soon'; end if;
  update public.redial_trusted_contacts set invited_at = now() where id = p_id;
  return 'ok';
end $$;
revoke execute on function public.redial_trusted_invite(uuid) from public, anon;
grant execute on function public.redial_trusted_invite(uuid) to authenticated;

-- Setup answers -> the line, now including screening.protect: the family
-- code word (already encrypted by the app) and one trusted contact.
create or replace function private.redial_setup_apply(p_user uuid, p_line uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a jsonb;
  line public.redial_lines;
  hours text;
  n text;
  e jsonb;
  cipher text;
begin
  select answers into a from public.redial_setups where user_id = p_user;
  if a is null then return; end if;
  select * into line from public.redial_lines where id = p_line and owner_id = p_user;
  if not found then return; end if;

  if a -> 'screening' ->> 'mode' in ('unknown', 'all', 'off') then
    update public.redial_lines set mode = a -> 'screening' ->> 'mode' where id = p_line;
  end if;
  if a -> 'screening' -> 'hours' ->> 'start' is not null then
    hours := 'Business hours: ' || (a -> 'screening' -> 'hours' ->> 'start') || ' to ' || (a -> 'screening' -> 'hours' ->> 'end')
      || case when (a -> 'screening' -> 'hours' ->> 'weekdays')::boolean then ', Monday to Friday.' else ', every day.' end;
  end if;
  update public.redial_lines set
    assistant_name = coalesce(nullif(left(trim(a -> 'assistant' ->> 'name'), 40), ''), assistant_name),
    voice = case when a -> 'assistant' ->> 'voice' in ('ara', 'eve', 'rex', 'sal', 'leo') then a -> 'assistant' ->> 'voice' else voice end,
    greeting = coalesce(nullif(left(trim(a -> 'assistant' ->> 'greeting'), 500), ''), greeting),
    about = left(nullif(concat_ws(E'\n', nullif(trim(a -> 'assistant' ->> 'about'), ''), hours), ''), 4000),
    allow_connect = coalesce((a -> 'after' ->> 'putThrough')::boolean, allow_connect),
    forward_to = case when (a -> 'after' ->> 'forwardTo') ~ '^\+[1-9][0-9]{7,14}$' and a -> 'after' ->> 'forwardTo' <> line.number
                      then a -> 'after' ->> 'forwardTo' else forward_to end
  where id = p_line;

  for n in select jsonb_array_elements_text(coalesce(a -> 'screening' -> 'vip', '[]')) loop
    if n ~ '^\+[1-9][0-9]{7,14}$' then
      insert into public.redial_list_entries (line_id, number, kind, label) values (p_line, n, 'vip', 'From setup') on conflict (line_id, number) do nothing;
    end if;
  end loop;
  for n in select jsonb_array_elements_text(coalesce(a -> 'screening' -> 'block', '[]')) loop
    if n ~ '^\+[1-9][0-9]{7,14}$' then
      insert into public.redial_list_entries (line_id, number, kind, label) values (p_line, n, 'block', 'From setup') on conflict (line_id, number) do nothing;
    end if;
  end loop;
  for e in select jsonb_array_elements(coalesce(a -> 'after' -> 'directory', '[]')) loop
    if e ->> 'number' ~ '^\+[1-9][0-9]{7,14}$' and length(trim(coalesce(e ->> 'label', ''))) between 1 and 80 then
      insert into public.redial_directory (line_id, label, number, created_by) values (p_line, trim(e ->> 'label'), e ->> 'number', p_user)
      on conflict (line_id, number) do nothing;
    end if;
  end loop;

  -- Protect a parent: the code word and a trusted contact.
  cipher := a -> 'screening' -> 'protect' ->> 'codeWordCipher';
  if cipher like 'v1:%' and length(cipher) <= 500 then
    insert into public.redial_protection (line_id, code_word_cipher) values (p_line, cipher)
    on conflict (line_id) do update set code_word_cipher = excluded.code_word_cipher;
  end if;
  e := a -> 'screening' -> 'protect' -> 'trusted';
  if e is not null and length(trim(coalesce(e ->> 'name', ''))) between 1 and 80
     and ((e ->> 'phone') ~ '^\+[1-9][0-9]{7,14}$' or (e ->> 'email') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
     and not exists (select 1 from public.redial_trusted_contacts where line_id = p_line and (phone = e ->> 'phone' or email = e ->> 'email')) then
    insert into public.redial_trusted_contacts (line_id, name, phone, email)
    values (p_line, trim(e ->> 'name'),
      case when (e ->> 'phone') ~ '^\+[1-9][0-9]{7,14}$' then e ->> 'phone' end,
      case when (e ->> 'email') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(e ->> 'email') <= 200 then lower(e ->> 'email') end);
  end if;

  update public.redial_setups set line_id = p_line, status = 'active' where user_id = p_user;
end $$;
revoke execute on function private.redial_setup_apply(uuid, uuid) from public, anon, authenticated;
