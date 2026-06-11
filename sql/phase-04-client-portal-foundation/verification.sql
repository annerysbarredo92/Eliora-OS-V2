/*
==============================================================
ELIORA OS — PHASE 04: CLIENT PORTAL FOUNDATION — VERIFICATION
==============================================================
Run after phase.sql. All queries are read-only.
==============================================================
*/


-- ── Check 1: Tables exist ─────────────────────────────────────────────────────
-- Expected: 5 rows
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'client_users', 'client_profiles', 'client_portal_settings',
    'client_portal_access', 'client_onboarding_progress'
  )
order by tablename;


-- ── Check 2: RLS enabled ──────────────────────────────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'client_users', 'client_profiles', 'client_portal_settings',
    'client_portal_access', 'client_onboarding_progress'
  )
order by tablename;


-- ── Check 3: Helper functions exist (security definer) ────────────────────────
-- Expected: caller_agency_id, current_agency_id, current_client_id, ensure_client_portal
select p.proname as function_name, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_agency_id', 'current_client_id', 'caller_agency_id', 'ensure_client_portal')
order by p.proname;


-- ── Check 4: current_agency_id now excludes client_user (CRITICAL) ────────────
-- Expected: excludes_client_user = true
select pg_get_functiondef(p.oid) ilike '%role <> ''client_user''%' as excludes_client_user
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'current_agency_id';


-- ── Check 5: Policy count per table ───────────────────────────────────────────
-- Expected: client_profiles 2, client_portal_settings 2, client_portal_access 2,
--           client_onboarding_progress 2, client_users >= 3
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'client_users', 'client_profiles', 'client_portal_settings',
    'client_portal_access', 'client_onboarding_progress'
  )
group by tablename
order by tablename;


-- ── Check 6: Cross-phase policies updated ─────────────────────────────────────
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and (
    (tablename = 'activity_logs' and policyname in ('activity_logs_select', 'activity_logs_insert'))
    or (tablename = 'agencies' and policyname = 'Caller can read own agency')
  )
order by tablename, policyname;


-- ── Check 7: Read self-test (no recursion / permission error) ─────────────────
select
  (select count(*) from client_profiles)            as profiles,
  (select count(*) from client_portal_settings)     as settings,
  (select count(*) from client_onboarding_progress) as onboarding;


-- ── Check 8: Client portal audit (run AFTER a client opens the portal) ────────
select cp.client_id, c.business_name, op.completion_pct, op.skipped,
       (select count(*) from client_portal_access a where a.client_id = cp.client_id) as access_rows
from client_profiles cp
join clients c on c.id = cp.client_id
left join client_onboarding_progress op on op.client_id = cp.client_id
order by cp.created_at desc;
