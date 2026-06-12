/*
==============================================================
ELIORA OS — PHASE 05: CLIENT ONBOARDING — ROLLBACK
==============================================================
DANGER: Undoes Phase 05. Destroys onboarding templates,
sections, questions, responses, progress, required items, and
onboarding activity. Phases 01–04 are untouched.

Take a Supabase snapshot before running.
==============================================================
*/

-- ── Drop tables (children first) ──────────────────────────────────────────────
drop table if exists onboarding_activity       cascade;
drop table if exists onboarding_required_items cascade;
drop table if exists onboarding_progress       cascade;
drop table if exists onboarding_responses      cascade;
drop table if exists onboarding_questions      cascade;
drop table if exists onboarding_sections       cascade;
drop table if exists onboarding_templates      cascade;

-- ── Drop functions ────────────────────────────────────────────────────────────
drop function if exists public.seed_onboarding_template(uuid);
drop function if exists public.ensure_client_onboarding(uuid);

-- ── Drop enums ────────────────────────────────────────────────────────────────
drop type if exists onboarding_question_type cascade;
drop type if exists client_onboarding_status cascade;

-- ── Confirm ───────────────────────────────────────────────────────────────────
-- select tablename from pg_tables where schemaname = 'public' order by tablename;
