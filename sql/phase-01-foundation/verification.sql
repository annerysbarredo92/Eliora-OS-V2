/*
--------------------------------------------------
FILE:    verification.sql
PHASE:   phase-01-foundation
PURPOSE: Confirm phase-01 ran correctly
STATUS:  Read-only — safe to run anytime
--------------------------------------------------
*/

-- Check enums exist
select typname from pg_type where typname in ('user_role', 'plan_type');

-- Check tables exist
select tablename from pg_tables
where schemaname = 'public'
and tablename in ('agencies', 'profiles');

-- Check RLS is enabled
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in ('agencies', 'profiles');

-- Check trigger exists
select trigger_name from information_schema.triggers
where trigger_name in ('on_auth_user_created', 'agencies_updated_at', 'profiles_updated_at');

-- Check policies exist
select policyname, tablename from pg_policies
where schemaname = 'public';
