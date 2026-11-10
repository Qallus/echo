-- AI agents (docs/REDIAL_GROWTH_AND_AUTOMATION_PLAN.md, C1b) get their own
-- staff role. Added on its own: a new enum value can't be used in the same
-- transaction that adds it.
alter type public.staff_role add value if not exists 'agent';
