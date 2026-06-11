/*
==============================================================
ELIORA OS — PHASE 01: FOUNDATION — VERIFICATION
==============================================================
Run this after phase.sql to confirm everything installed correctly.
All queries are read-only. Safe to run at any time.
==============================================================
*/


-- ── Check 1: Enums exist ──────────────────────────────────────────────────────
-- Expected: 2 rows — plan_type, user_role
select typname as enum_name
from pg_type
where typname in ('user_role', 'plan_type')
order by typname;


-- ── Check 2: Tables exist ─────────────────────────────────────────────────────
-- Expected: 3 rows — agencies, agency_settings, profiles
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('agencies', 'profiles', 'agency_settings')
order by tablename;


-- ── Check 3: RLS is enabled ───────────────────────────────────────────────────
-- Expected: all 3 rows show rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('agencies', 'profiles', 'agency_settings')
order by tablename;


-- ── Check 4: Indexes exist ────────────────────────────────────────────────────
-- Expected: 4 rows
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'profiles_agency_id_idx',
    'profiles_role_idx',
    'profiles_email_idx',
    'agency_settings_agency_idx'
  )
order by indexname;


-- ── Check 5: Signup trigger exists ───────────────────────────────────────────
-- Expected: 1 row — on_auth_user_created
select trigger_name, event_object_schema, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';


-- ── Check 6: Updated_at triggers exist ───────────────────────────────────────
-- Expected: 3 rows
select trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'agencies_set_updated_at',
    'profiles_set_updated_at',
    'agency_settings_set_updated_at'
  )
order by trigger_name;


-- ── Check 7: RLS policies exist ───────────────────────────────────────────────
-- Expected: 6 rows
--   agencies        : 2  (read own, owner update)
--   agency_settings : 2  (member read, admin write)
--   profiles        : 3  (read own, update own, read team)  ← but listed below
-- Total: 7 policies
select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ── Check 8: SECURITY DEFINER helper functions exist ─────────────────────────
-- Expected: 2 rows — current_agency_id, current_user_role, both security_definer = true
select p.proname as function_name, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_agency_id', 'current_user_role')
order by p.proname;


-- ── Check 9: Core functions exist ────────────────────────────────────────────
-- Expected: 2 rows — handle_new_user, set_updated_at
select proname as function_name
from pg_proc
where proname in ('set_updated_at', 'handle_new_user')
order by proname;


-- ── Check 10: profiles columns match expected shape ──────────────────────────
-- Expected: id, email, role, agency_id, display_name, avatar_initials, etc.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;


-- ── Check 11: RLS RECURSION SELF-TEST (most important) ───────────────────────
-- Reads the profiles table the same way the app does. If the old recursive
-- policy were still in place this query would FAIL with:
--     "infinite recursion detected in policy for relation profiles"
-- A clean run (0 rows or a count) means the recursion bug is fixed.
-- Expected: returns a number with NO error.
select count(*) as profiles_readable_without_recursion from profiles;


-- ── Check 12: Provisioning audit (run AFTER creating a test account) ─────────
-- Confirms the trigger created agency + profile + agency_settings together.
-- Expected after one agency_owner signup: 1 / 1 / 1
select
  (select count(*) from agencies)        as agencies_count,
  (select count(*) from profiles)        as profiles_count,
  (select count(*) from agency_settings) as settings_count;

-- Per-user join: every agency_owner profile should have a non-null agency_id
-- and a matching agency_settings row.
select
  pr.email,
  pr.role,
  pr.agency_id,
  ag.name            as agency_name,
  ag.slug            as agency_slug,
  s.key              as settings_key
from profiles pr
left join agencies ag        on ag.id = pr.agency_id
left join agency_settings s  on s.agency_id = pr.agency_id
order by pr.created_at;
