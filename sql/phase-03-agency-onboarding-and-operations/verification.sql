/*
==============================================================
ELIORA OS — PHASE 03: AGENCY ONBOARDING & OPERATIONS — VERIFICATION
==============================================================
Run after phase.sql. All queries are read-only.
==============================================================
*/


-- ── Check 1: Enums exist ──────────────────────────────────────────────────────
-- Expected: billing_frequency, billing_type, onboarding_step_status, template_type
select typname as enum_name
from pg_type
where typname in ('onboarding_step_status', 'billing_type', 'billing_frequency', 'template_type')
order by typname;


-- ── Check 2: Tables exist ─────────────────────────────────────────────────────
-- Expected: 7 rows
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'agency_setup_steps', 'agency_onboarding_progress', 'services',
    'packages', 'package_services', 'templates', 'agency_health_scores'
  )
order by tablename;


-- ── Check 3: RLS enabled on all Phase 03 tables ───────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'agency_setup_steps', 'agency_onboarding_progress', 'services',
    'packages', 'package_services', 'templates', 'agency_health_scores'
  )
order by tablename;


-- ── Check 4: Functions exist (security definer) ───────────────────────────────
-- Expected: recompute_agency_onboarding, reconcile_agency_setup, seed_agency_setup
select p.proname as function_name, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('recompute_agency_onboarding', 'seed_agency_setup', 'reconcile_agency_setup', 'on_setup_step_change')
order by p.proname;


-- ── Check 5: Progress recompute trigger exists ────────────────────────────────
-- Expected: agency_setup_steps_progress on agency_setup_steps
select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'agency_setup_steps_progress';


-- ── Check 6: Policy count per table ───────────────────────────────────────────
-- Expected: 2 each (select + write)
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'agency_setup_steps', 'agency_onboarding_progress', 'services',
    'packages', 'package_services', 'templates', 'agency_health_scores'
  )
group by tablename
order by tablename;


-- ── Check 7: Default-package uniqueness index exists ──────────────────────────
-- Expected: packages_one_default_per_agency
select indexname
from pg_indexes
where schemaname = 'public' and indexname = 'packages_one_default_per_agency';


-- ── Check 8: Read self-test (no recursion / permission error) ─────────────────
select
  (select count(*) from agency_setup_steps)         as setup_steps,
  (select count(*) from agency_onboarding_progress) as progress_rows,
  (select count(*) from services)                   as services,
  (select count(*) from packages)                   as packages;


-- ── Check 9: Onboarding audit (run AFTER opening Operations Hub once) ─────────
-- Expected after seeding: 8 step rows + 1 progress row for your agency.
select step_key, title, status, sort_order
from agency_setup_steps
order by sort_order;

select agency_id, total_steps, completed_steps, completion_pct, readiness_score, skipped
from agency_onboarding_progress;
