-- Redial's default assistant is named DJ. New lines start as DJ; lines still
-- on the old default ('Echo') move to DJ. Names people chose are left alone.
alter table public.redial_lines alter column assistant_name set default 'DJ';
update public.redial_lines set assistant_name = 'DJ' where assistant_name = 'Echo';
