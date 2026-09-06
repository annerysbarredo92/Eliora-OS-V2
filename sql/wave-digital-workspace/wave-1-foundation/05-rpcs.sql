/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 1: RPCs
==============================================================
Purpose:      set_primary_website — the ONLY supported way to change which
              website is primary for a client. Never do this as a plain
              frontend UPDATE; two concurrent "make primary" clicks must
              not be able to leave two (or zero) primary websites.

Concurrency:  Mirrors the pattern already used for retainer renewal
              (wave-business-workspace/wave-4-account/02-retainer-rpcs.sql):
              lock the client's rows with FOR UPDATE before touching any of
              them, so a second concurrent call blocks until the first
              transaction commits and then sees the already-updated state.
              Backstopped by websites_primary_unique_idx (01-websites-
              domains.sql) in case this RPC is ever bypassed.

Depends on:   01-websites-domains.sql.
Execution:    Paste after 04-digital-assets.sql. Idempotent.
==============================================================
*/

create or replace function set_primary_website(
  p_website_id uuid,
  p_actor_id   uuid
) returns websites
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  _target websites;
begin
  -- Lock the target row first and confirm it belongs to the caller's agency.
  select * into _target
    from websites
   where id = p_website_id
     and agency_id = public.current_agency_id()
  for update;

  if not found then
    raise exception 'website_not_found: Website not found or access denied';
  end if;

  -- Lock every website for this client so a concurrent call for a
  -- different target on the same client serializes behind this one.
  perform 1 from websites where client_id = _target.client_id for update;

  update websites
     set is_primary = false,
         updated_by = p_actor_id,
         updated_at = now()
   where client_id  = _target.client_id
     and id        <> p_website_id
     and is_primary = true;

  update websites
     set is_primary = true,
         updated_by = p_actor_id,
         updated_at = now()
   where id = p_website_id
  returning * into _target;

  return _target;
end;
$$;

grant execute on function set_primary_website(uuid, uuid) to authenticated;

-- ── VERIFICATION (informational) ─────────────────────────────────────────────
-- select proname, pronargs from pg_proc where proname = 'set_primary_website';
--   → expected: 1 row, pronargs = 2
