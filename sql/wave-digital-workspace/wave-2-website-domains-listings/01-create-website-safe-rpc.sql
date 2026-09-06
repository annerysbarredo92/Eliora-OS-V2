/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 2: create_website_safe RPC
==============================================================
Purpose:      The client's FIRST website EVER created (see note 6 below —
              this is a row-count check with no status filter, not "first
              active website") should become Primary automatically; every
              website after that should not, unless the user explicitly
              promotes it via set_primary_website() (already deployed,
              Wave 1). Determining "is this the first one" by counting
              rows on the frontend before an INSERT is race-prone — two
              concurrent "create my first website" calls (two tabs, a
              slow connection retried) could both see zero existing rows
              and both try to insert as primary. The existing
              websites_primary_unique_idx (Wave 1) prevents the corrupted
              end state (two primaries) but the second caller would just
              get an ugly unique-violation error instead of the correct
              "not primary" outcome.

Fix:          Serialize per-client via pg_advisory_xact_lock, keyed by a
              real 64-bit hash (hashtextextended, not the 32-bit
              hashtext()) — a transaction-scoped lock released
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

Hardening     (production-hardening correction pass, not yet deployed):
pass:           - p_actor_id removed from the signature entirely. A
                  SECURITY DEFINER function that trusted a caller-supplied
                  actor id let any authenticated caller stamp
                  created_by/updated_by with an arbitrary UUID. created_by/
                  updated_by are now always auth.uid(), rejecting the call
                  outright if that is null.
                - Lock key upgraded to hashtextextended(..., 0) (64-bit)
                  from hashtext(...) (32-bit) — see note 2.
                - p_status removed from the signature. The only product
                  entry point (WebsiteSection.tsx's create form) never
                  varies it — it always creates as 'active' — so trusting
                  a caller-supplied status was pure unused attack surface.
                  A direct RPC call could otherwise create
                  status='archived' + is_primary=true for a client's first
                  website, which must never be a reachable state. Status
                  is now hardcoded to 'active' inside the function; editing
                  to another lifecycle status afterwards still goes through
                  the normal UPDATE path, unaffected.
                - Explicit REVOKE ALL ... FROM PUBLIC before the GRANT —
                  Postgres functions are PUBLIC-executable by default;
                  is_agency_admin() is necessary but this removes the
                  redundant exposure rather than relying on it alone.

Depends on:   Wave 1 (websites, website_type, digital_ownership_status,
              current_agency_id(), is_agency_admin()).
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
  p_ownership_status  digital_ownership_status,
  p_launch_date       date,
  p_notes             text
) returns websites
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  _agency_id       uuid := public.current_agency_id();
  _actor_id        uuid := auth.uid();
  _client          clients;
  _existing_count  integer;
  _new             websites;
begin
  if _actor_id is null then
    raise exception 'not_authenticated: A signed-in user is required';
  end if;

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
  -- callers. A 64-bit key (hashtextextended) rather than the 32-bit
  -- hashtext() — still per-client, never a global lock across all clients.
  -- Released automatically at the end of this transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));

  -- "First website" = first website ROW EVER CREATED for this client,
  -- regardless of its current status. Deliberately no status filter: a
  -- client whose only prior website is archived is NOT treated as having
  -- zero websites — the new one is created as non-primary, same as if
  -- that archived site were still active. Only a client with zero website
  -- rows of any status gets an automatic primary.
  select count(*) into _existing_count from websites where client_id = p_client_id;

  -- Status is always 'active' here — the only product entry point never
  -- offers a choice at creation time, and a direct RPC call must not be
  -- able to create an archived (or any non-active) website as primary.
  insert into websites (
    agency_id, client_id, name, url, website_type, platform_cms, hosting_provider,
    status, ownership_status, is_primary, launch_date, notes, created_by, updated_by
  ) values (
    _agency_id, p_client_id, btrim(p_name), p_url, p_website_type, p_platform_cms, p_hosting_provider,
    'active', p_ownership_status, (_existing_count = 0), p_launch_date, p_notes, _actor_id, _actor_id
  )
  returning * into _new;

  return _new;
end;
$$;

-- Functions are PUBLIC-executable by default in Postgres. Revoke that
-- explicitly rather than relying on the is_agency_admin() check alone to
-- be the only thing standing between an anonymous/unintended caller and
-- this function.
revoke all on function create_website_safe(
  uuid, text, text, website_type, text, text, digital_ownership_status, date, text
) from public;

grant execute on function create_website_safe(
  uuid, text, text, website_type, text, text, digital_ownership_status, date, text
) to authenticated;

-- ── VERIFICATION (informational) ─────────────────────────────────────────────
-- select proname, pronargs from pg_proc where proname = 'create_website_safe';
--   → expected: 1 row, pronargs = 9
-- select has_function_privilege('anon', 'create_website_safe(uuid, text, text, website_type, text, text, digital_ownership_status, date, text)', 'execute');
--   → expected: false
-- select has_function_privilege('authenticated', 'create_website_safe(uuid, text, text, website_type, text, text, digital_ownership_status, date, text)', 'execute');
--   → expected: true
