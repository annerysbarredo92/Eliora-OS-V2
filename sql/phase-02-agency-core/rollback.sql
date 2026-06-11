/*
==============================================================
ELIORA OS — PHASE 02: AGENCY CORE — ROLLBACK
==============================================================
DANGER: Undoes Phase 02 entirely. Destroys all clients,
contacts, client users, invitations, activity logs, and
team assignments. Phase 01 (agencies, profiles) is untouched.

Take a Supabase snapshot before running.
==============================================================
*/

-- ── Drop tables (cascade removes their triggers, policies, indexes, FKs) ──────
-- Order: children first, then clients last.
drop table if exists team_assignments   cascade;
drop table if exists activity_logs       cascade;
drop table if exists client_invitations  cascade;
drop table if exists client_users        cascade;
drop table if exists client_contacts     cascade;
drop table if exists clients             cascade;

-- ── Drop Phase 02 functions ───────────────────────────────────────────────────
drop function if exists public.is_agency_admin();
drop function if exists public.is_assigned_to_client(uuid);
drop function if exists bump_client_last_activity();

-- ── Drop Phase 02 enums ───────────────────────────────────────────────────────
drop type if exists invitation_status cascade;
drop type if exists client_health     cascade;
drop type if exists client_status     cascade;

-- ── Confirm rollback ──────────────────────────────────────────────────────────
-- select tablename from pg_tables where schemaname = 'public' order by tablename;
