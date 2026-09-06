/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 2: create_website_safe RPC
==============================================================
Purpose:      The client's FIRST website should become Primary
              automatically; every website after that should not, unless
              the user explicitly promotes it via set_primary_website()
              (already deployed, Wave 1). Determining "is this the first
              one" by counting rows on the frontend before an INSERT is
              race-prone — two concurrent "create my first website" calls
              (two tabs, a slow connection retried) could both see zero
              existing rows and both try to insert as primary. The
              existing websites_primary_unique_idx (Wave 1) prevents the
              corrupted end state (two primaries) but the second caller
              would just get an ugly unique-violation error instead of the
              correct "not primary" outcome.

Fix:          Serialize per-client via pg_advisory_xact_lock — a
              transaction-scoped lock keyed by the client's UUID, released
              automatically at commit/rollback. A second concurrent call
              for the SAME client blocks until the first transaction
              finishes, then correctly sees "a website already exists" and
              inserts as non-primary. Concurrent calls for DIFFERENT
              clients never block each other (different lock keys).

              This does not replace or duplicate the RPC/index already
              guaranteeing primary-website integrity — the partial unique
              index (websites_primary_unique_idx) and set_primary_website()
              stay exactly as deployed in Wave 1. This RPC only handles the
              "what should the FIRST insert be" decision safely.

Depends on:   Wave 1 (websites, website_type, website_lifecycle_status,
              digital_ownership_status, current_agency_id(),
              is_agency_admin()).
Execution:    Approve and run this file only — it does not touch any
              existing Wave 1 object. Idempotent (CREATE OR REPLACE).
==============================================================
*/

create or replace function create_website_safe(
  p_client_id         uuid,
  p_name              text,
  p_url               text,
  p_website_type      website_type,
  p_platform_cms      text,
  p_hosting_provider  text,
  p_status            website_lifecycle_status,
  p_ownership_status  digital_ownership_status,
  p_launch_date       date,
  p_notes             text,
  p_actor_id          uuid
) returns websites
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  _agency_id       uuid := public.current_agency_id();
  _client          clients;
  _existing_count  integer;
  _new             websites;
begin
  if not public.is_agency_admin() then
    raise exception 'not_authorized: Only agency admins can create websites';
  end if;

  select * into _client from clients where id = p_client_id and agency_id = _agency_id;
  if not found then
    raise exception 'client_not_found: Client not found or access denied';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'name_required: Website name is required';
  end if;

  -- Serialize "create the first website for this client" across concurrent
  -- callers. Released automatically at the end of this transaction.
  perform pg_advisory_xact_lock(hashtext(p_client_id::text));

  select count(*) into _existing_count from websites where client_id = p_client_id;

  insert into websites (
    agency_id, client_id, name, url, website_type, platform_cms, hosting_provider,
    status, ownership_status, is_primary, launch_date, notes, created_by, updated_by
  ) values (
    _agency_id, p_client_id, btrim(p_name), p_url, p_website_type, p_platform_cms, p_hosting_provider,
    p_status, p_ownership_status, (_existing_count = 0), p_launch_date, p_notes, p_actor_id, p_actor_id
  )
  returning * into _new;

  return _new;
end;
$$;

grant execute on function create_website_safe(
  uuid, text, text, website_type, text, text, website_lifecycle_status,
  digital_ownership_status, date, text, uuid
) to authenticated;

-- ── VERIFICATION (informational) ─────────────────────────────────────────────
-- select proname, pronargs from pg_proc where proname = 'create_website_safe';
--   → expected: 1 row, pronargs = 11
