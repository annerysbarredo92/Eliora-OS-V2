/*
==============================================================
ELIORA OS — PHASE 01: FOUNDATION — VERIFICATION
==============================================================
Run this after phase.sql to confirm everything installed correctly.
All queries are read-only. Safe to run at any time.
==============================================================
*/


-- ── Check 1: Enums exist ──────────────────────────────────────────────────────
-- Expected: 2 rows — user_role, plan_type
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
-- Expected: 6+ rows
select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ── Check 8: set_updated_at function exists ───────────────────────────────────
-- Expected: 1 row
select proname as function_name
from pg_proc
where proname = 'set_updated_at';


-- ── Check 9: handle_new_user function exists ─────────────────────────────────
-- Expected: 1 row
select proname as function_name
from pg_proc
where proname = 'handle_new_user';


-- ── Check 10: Quick signup simulation (read-only inspection) ─────────────────
-- Confirm profiles table columns match expected shape.
-- Expected: shows id, email, role, agency_id, display_name columns
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;
