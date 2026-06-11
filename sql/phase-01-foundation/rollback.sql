/*
==============================================================
ELIORA OS — PHASE 01: FOUNDATION — ROLLBACK
==============================================================
DANGER: This undoes Phase 01 entirely.

Only run this if Phase 01 needs to be reversed.
Running this on a live database with data will destroy:
  - All user profiles
  - All agency records
  - All agency settings
  - The signup trigger

Take a manual Supabase snapshot before running this.
==============================================================
*/


-- ── Drop signup trigger first (depends on auth.users) ────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();


-- ── Drop tables (cascade removes triggers, policies, indexes) ─────────────────
-- Order matters: profiles references agencies, agency_settings references agencies
drop table if exists agency_settings cascade;
drop table if exists profiles        cascade;
drop table if exists agencies        cascade;


-- ── Drop shared functions + RLS helpers ──────────────────────────────────────
drop function if exists public.current_agency_id();
drop function if exists public.current_user_role();
drop function if exists set_updated_at();


-- ── Drop enums ────────────────────────────────────────────────────────────────
drop type if exists plan_type  cascade;
drop type if exists user_role  cascade;


-- ── Confirm rollback ─────────────────────────────────────────────────────────
-- Run this after rollback to confirm tables are gone:
-- select tablename from pg_tables where schemaname = 'public';
