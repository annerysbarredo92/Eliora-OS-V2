/*
==============================================================
ELIORA OS — PHASE 02: AGENCY CORE — VERIFICATION
==============================================================
Run after phase.sql to confirm correct installation.
All queries are read-only. Safe to run at any time.
==============================================================
*/


-- ── Check 1: Enums exist ──────────────────────────────────────────────────────
-- Expected: client_health, client_status, invitation_status
select typname as enum_name
from pg_type
where typname in ('client_status', 'client_health', 'invitation_status')
order by typname;


-- ── Check 2: Tables exist ─────────────────────────────────────────────────────
-- Expected: 6 rows
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'clients', 'client_contacts', 'client_users',
    'client_invitations', 'activity_logs', 'team_assignments'
  )
order by tablename;


-- ── Check 3: RLS enabled on all Phase 02 tables ───────────────────────────────
-- Expected: all rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'clients', 'client_contacts', 'client_users',
    'client_invitations', 'activity_logs', 'team_assignments'
  )
order by tablename;


-- ── Check 4: Access helper functions exist (security definer) ─────────────────
-- Expected: is_agency_admin, is_assigned_to_client — both secdef = true
select p.proname as function_name, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_agency_admin', 'is_assigned_to_client')
order by p.proname;


-- ── Check 5: Triggers exist ───────────────────────────────────────────────────
-- Expected: 5 updated_at triggers + activity_logs_bump_client
select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in (
    'clients', 'client_contacts', 'client_users',
    'client_invitations', 'team_assignments', 'activity_logs'
  )
order by event_object_table, trigger_name;


-- ── Check 6: Policy count per table ───────────────────────────────────────────
-- Expected: clients 3, client_contacts 2, client_users 2,
--           client_invitations 2, activity_logs 2, team_assignments 2
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'clients', 'client_contacts', 'client_users',
    'client_invitations', 'activity_logs', 'team_assignments'
  )
group by tablename
order by tablename;


-- ── Check 7: clients columns match expected shape ─────────────────────────────
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'clients'
order by ordinal_position;


-- ── Check 8: Indexes exist ────────────────────────────────────────────────────
-- Expected: 12 rows
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'clients', 'client_contacts', 'client_users',
    'client_invitations', 'activity_logs', 'team_assignments'
  )
order by indexname;


-- ── Check 9: Read self-test (no recursion / no permission error) ──────────────
-- Should return counts with NO error. Empty agency simply returns 0s.
select
  (select count(*) from clients)          as clients,
  (select count(*) from client_contacts)  as contacts,
  (select count(*) from activity_logs)    as activity;


-- ── Check 10: Data audit (run AFTER creating a client in the app) ─────────────
-- Confirms client + primary contact + activity rows line up per agency.
select
  c.business_name,
  c.status,
  c.last_activity_at,
  pc.first_name || ' ' || pc.last_name as primary_contact,
  pc.email                              as contact_email,
  (select count(*) from activity_logs a where a.client_id = c.id) as activity_count
from clients c
left join client_contacts pc on pc.client_id = c.id and pc.is_primary
order by c.created_at desc;
