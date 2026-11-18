-- Publish "Redial main Greeting" on (480) 999-9906 (the same as pressing
-- Publish in Call Tree). From the next call on, (480) 999-9906 is answered by
-- the menu. To undo: Call Tree → Redial main Greeting → Versions, or detach it
-- from the line.
do $$
declare
  v_flow uuid;
  v_owner uuid;
  v_version integer;
  v_id uuid;
begin
  select f.id, f.owner_id into v_flow, v_owner
  from public.call_flows f
  join public.call_flow_lines l on l.flow_id = f.id
  join public.redial_lines r on r.id = l.line_id
  where r.number = '+14809999906' and f.name = 'Redial main Greeting';
  if v_flow is null then raise exception 'Run redial-main-greeting.sql first: the call tree isn''t on +14809999906.'; end if;

  select coalesce(max(version), 0) + 1 into v_version from public.call_flow_versions where flow_id = v_flow;
  insert into public.call_flow_versions (flow_id, version, definition, note, published_by)
  select id, v_version, draft, 'First version: main greeting and menu', v_owner from public.call_flows where id = v_flow
  returning id into v_id;
  update public.call_flows set published_version_id = v_id where id = v_flow;
end $$;

-- Check: the call tree is live, the cell it rings, and any VIP numbers
-- (VIPs skip the menu and ring straight through, so test from a number
-- that isn't on this list).
select r.number as line, r.forward_to as rings_cell, f.name as call_tree, v.version as published_version,
       (select string_agg(e.number, ', ') from public.redial_list_entries e where e.line_id = r.id and e.kind = 'vip') as vip_numbers
from public.redial_lines r
join public.call_flow_lines l on l.line_id = r.id
join public.call_flows f on f.id = l.flow_id
left join public.call_flow_versions v on v.id = f.published_version_id
where r.number = '+14809999906';
