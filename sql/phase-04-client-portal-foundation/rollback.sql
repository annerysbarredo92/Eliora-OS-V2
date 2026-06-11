/*
==============================================================
ELIORA OS — PHASE 04: CLIENT PORTAL FOUNDATION — ROLLBACK
==============================================================
DANGER: Undoes Phase 04. Destroys client portal profiles,
settings, access records, and client onboarding progress.

NOTE: this also RESTORES current_agency_id() to its Phase 02
definition (without the client_user exclusion) and removes the
client-facing activity_logs / agencies policies. Run only if
reverting the whole phase.

Take a Supabase snapshot before running.
==============================================================
*/

-- ── Drop Phase 04 tables ──────────────────────────────────────────────────────
drop table if exists client_onboarding_progress cascade;
drop table if exists client_portal_access        cascade;
drop table if exists client_portal_settings      cascade;
drop table if exists client_profiles             cascade;
-- client_users is shared with Phase 02; leave it in place.

-- ── Drop Phase 04 functions ───────────────────────────────────────────────────
drop function if exists public.ensure_client_portal(uuid);
drop function if exists public.current_client_id();
drop function if exists public.caller_agency_id();

-- ── Restore current_agency_id() to the Phase 02 definition ────────────────────
create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.profiles where id = auth.uid();
$$;

-- ── Restore activity_logs policies (Phase 02 form) ────────────────────────────
drop policy if exists "activity_logs_select" on activity_logs;
create policy "activity_logs_select" on activity_logs for select
  using (
    agency_id = public.current_agency_id()
    and (public.is_agency_admin() or client_id is null or public.is_assigned_to_client(client_id))
  );

drop policy if exists "activity_logs_insert" on activity_logs;
create policy "activity_logs_insert" on activity_logs for insert
  with check (agency_id = public.current_agency_id() and actor_profile_id = auth.uid());

-- ── Remove the client agency-read policy ──────────────────────────────────────
drop policy if exists "Caller can read own agency" on agencies;

-- ── Confirm ───────────────────────────────────────────────────────────────────
-- select tablename from pg_tables where schemaname = 'public' order by tablename;
