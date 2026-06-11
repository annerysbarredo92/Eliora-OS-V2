/*
==============================================================
ELIORA OS — PHASE 03: AGENCY ONBOARDING & OPERATIONS — ROLLBACK
==============================================================
DANGER: Undoes Phase 03 entirely. Destroys onboarding steps,
progress, services, packages, package links, templates, and
health scores. Phases 01–02 are untouched.

Take a Supabase snapshot before running.
==============================================================
*/

-- ── Drop tables (cascade removes triggers, policies, indexes, FKs) ────────────
drop table if exists package_services           cascade;
drop table if exists packages                   cascade;
drop table if exists services                   cascade;
drop table if exists templates                  cascade;
drop table if exists agency_health_scores       cascade;
drop table if exists agency_setup_steps         cascade;
drop table if exists agency_onboarding_progress cascade;

-- ── Drop Phase 03 functions ───────────────────────────────────────────────────
drop function if exists public.on_setup_step_change();
drop function if exists public.recompute_agency_onboarding(uuid);
drop function if exists public.seed_agency_setup(uuid);
drop function if exists public.reconcile_agency_setup(uuid);

-- ── Drop Phase 03 enums ───────────────────────────────────────────────────────
drop type if exists template_type           cascade;
drop type if exists billing_frequency       cascade;
drop type if exists billing_type            cascade;
drop type if exists onboarding_step_status  cascade;

-- ── Confirm ───────────────────────────────────────────────────────────────────
-- select tablename from pg_tables where schemaname = 'public' order by tablename;
