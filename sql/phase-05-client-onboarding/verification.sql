/*
==============================================================
ELIORA OS — PHASE 05: CLIENT ONBOARDING — VERIFICATION
==============================================================
Run after phase.sql. All queries are read-only.
==============================================================
*/


-- ── Check 1: Enums exist ──────────────────────────────────────────────────────
select typname from pg_type
where typname in ('client_onboarding_status', 'onboarding_question_type')
order by typname;


-- ── Check 2: Tables exist ─────────────────────────────────────────────────────
-- Expected: 7 rows
select tablename from pg_tables
where schemaname = 'public'
  and tablename in (
    'onboarding_templates', 'onboarding_sections', 'onboarding_questions',
    'onboarding_responses', 'onboarding_progress', 'onboarding_required_items', 'onboarding_activity'
  )
order by tablename;


-- ── Check 3: RLS enabled ──────────────────────────────────────────────────────
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in (
    'onboarding_templates', 'onboarding_sections', 'onboarding_questions',
    'onboarding_responses', 'onboarding_progress', 'onboarding_required_items', 'onboarding_activity'
  )
order by tablename;


-- ── Check 4: Functions exist (security definer) ───────────────────────────────
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('seed_onboarding_template', 'ensure_client_onboarding')
order by p.proname;


-- ── Check 5: Policy count per table ───────────────────────────────────────────
-- Expected: 2 each
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'onboarding_templates', 'onboarding_sections', 'onboarding_questions',
    'onboarding_responses', 'onboarding_progress', 'onboarding_required_items', 'onboarding_activity'
  )
group by tablename order by tablename;


-- ── Check 6: Read self-test (no recursion / permission error) ─────────────────
select
  (select count(*) from onboarding_templates) as templates,
  (select count(*) from onboarding_sections)  as sections,
  (select count(*) from onboarding_questions) as questions,
  (select count(*) from onboarding_progress)  as progress;


-- ── Check 7: Template audit (run AFTER opening Operations or the portal once) ─
-- Expected: 1 default template with 8 sections and ~30 questions per agency.
select t.name, t.is_default,
       (select count(*) from onboarding_sections s where s.template_id = t.id)  as sections,
       (select count(*) from onboarding_questions q where q.template_id = t.id) as questions
from onboarding_templates t
order by t.created_at desc;


-- ── Check 8: Client onboarding audit (run AFTER a client opens onboarding) ────
select op.client_id, c.business_name, op.status, op.completion_pct,
       op.completed_sections, op.total_sections,
       jsonb_array_length(op.missing_items) as missing_count,
       (select count(*) from onboarding_responses r where r.client_id = op.client_id) as responses,
       (select count(*) from onboarding_required_items i where i.client_id = op.client_id and i.is_provided) as items_provided
from onboarding_progress op
join clients c on c.id = op.client_id
order by op.updated_at desc;
