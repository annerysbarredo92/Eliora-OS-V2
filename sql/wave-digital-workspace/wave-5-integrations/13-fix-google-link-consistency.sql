-- ==============================================================
-- ELIORA OS.M -- GOOGLE PHASE 1 SLICE G1: CORRECTIVE FIX
-- FILE 13: DEFERRED LINK-CONSISTENCY TRIGGERS -- STALE NEW BUG
-- ==============================================================
-- Context:      08-11 are ALREADY DEPLOYED. This file does NOT recreate
--               them and does NOT assume they were never deployed -- it
--               narrowly CREATE OR REPLACEs the 3 deferred constraint
--               trigger FUNCTIONS from 10-google-resource-linkage.sql
--               that have a real, now-confirmed-by-production-error bug.
--               No table, column, index, or the immediate (non-deferred)
--               triggers are touched.
--
-- ROOT CAUSE (confirmed by tracing actual PostgreSQL AFTER-trigger
-- semantics against the exact failing fixture, not assumed):
--
--   PostgreSQL queues a SEPARATE AFTER-trigger event for EVERY DML
--   statement that touches a row, each carrying its OWN frozen copy of
--   NEW as that statement produced it -- NOT a single event reflecting
--   the row's eventual, final state. The verification fixture (12,
--   section 3) does, for a freshly-discovered resource:
--
--     INSERT into integration_resources (unassigned, linked_* all NULL)
--     UPDATE that same row (sets linked_tracking_configuration_id)
--     UPDATE tracking_configurations (sets integration_resource_id back)
--     SET CONSTRAINTS ALL IMMEDIATE
--
--   This queues TWO separate deferred events for the integration_
--   resources row: one from the INSERT (NEW.linked_tracking_
--   configuration_id = NULL, correct at that instant) and one from the
--   UPDATE (NEW.linked_tracking_configuration_id = the real target).
--   SET CONSTRAINTS ALL IMMEDIATE fires BOTH, in queued (chronological)
--   order. The FIRST one to fire -- the INSERT's event -- still carries
--   NEW.linked_tracking_configuration_id = NULL, even though the row's
--   ACTUAL, current data (and every other row's data) is by then fully
--   consistent. The original check_integration_resource_canonical_link_
--   consistency() (and its two siblings) trusted that frozen NEW value
--   directly, so this stale, superseded event raised a false-positive
--   "linkage is not mutually consistent" error and aborted the whole
--   transaction -- exactly the production error observed.
--
--   The trigger's own internal lookups (querying the OTHER table) were
--   never stale -- those are fresh, ordinary queries and correctly saw
--   the fully-written final state. The bug was trusting the PASSED-IN
--   NEW record for THIS row's own link columns, when a later statement
--   in the same transaction had already superseded it.
--
-- Verdict (B -- the deployed function is wrong, not the fixture):
--   The fixture's pattern (insert an unassigned resource, then link it,
--   in one transaction) is a legitimate, reasonable thing to do and to
--   test -- Slice G3's future assignment flow could plausibly do exactly
--   this (discover-and-link in one atomic step) even though the
--   currently-anticipated flow keeps discovery and assignment in
--   separate transactions. Relying on an unstated "never insert and
--   update the same row in one transaction" invariant would be fragile
--   and undocumented. The fix belongs in the trigger, not the test.
--
-- FIX: each function now uses NEW.id ONLY as the identity of the row to
--      check -- never NEW's other columns -- and re-reads that row's
--      CURRENT state fresh via a plain SELECT before validating
--      reciprocal consistency. A fresh SELECT, executed at the moment
--      the trigger actually fires, always sees the transaction's own
--      latest writes (ordinary read-your-own-writes visibility) --
--      immune to how many prior statements, or which one first, touched
--      this row earlier in the same transaction. This also correctly
--      handles a row deleted later in the same transaction (the fresh
--      SELECT finds nothing -- NOT FOUND -- and the check is skipped
--      for that now-gone row, which is safe: a deleted row has nothing
--      left to be inconsistent about).
--
-- Regression check against every previously-approved case (traced
-- explicitly, not asserted -- see the Slice G1 corrective report):
--   A/B (two-sided link, GA4/Search Console) -- still succeeds, and now
--       ALSO succeeds for the insert+link-in-one-transaction pattern
--       that previously failed.
--   C   (one-sided link) -- still correctly rejected: the fresh read of
--       BOTH sides still finds a genuine, real mismatch.
--   D   (mismatched two-sided link) -- still correctly rejected, same
--       reasoning.
--   E   (two-sided unlink) -- still correctly succeeds.
--   F   (one-sided unlink) -- still correctly rejected.
--   G   (canonical record deleted while linked) -- untouched by this
--       fix; enforced by integration_resources_link_status_consistency
--       (a CHECK constraint, not this trigger) -- still blocks the
--       delete outright, as before.
--   H   (integration_resource deleted) -- untouched; plain FK ON DELETE
--       SET NULL behavior, not this trigger's concern.
--   I/J (same-agency cross-client rejected / cross-agency allowed) --
--       untouched; enforced by check_integration_resource_tenant_match's
--       Direction B, an IMMEDIATE (non-deferred) trigger, which was
--       never affected by this bug class in the first place.
--
-- Depends on:   08-11 already deployed (confirmed by the user: all
--               returned "Success. No rows returned.").
-- Execution:    NOT YET RUN -- prepared for manual review. Idempotent --
--               CREATE OR REPLACE only; safe to re-run.
-- ==============================================================

create or replace function public.check_integration_resource_canonical_link_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _self               public.integration_resources;
  _claiming_tracking  public.tracking_configurations;
  _claiming_seo       public.seo_profiles;
begin
  -- NEW.id is a stable primary key, never reassigned -- safe to trust as
  -- identity. Everything else is re-read fresh, deliberately never
  -- trusting NEW's other columns (see file header).
  select * into _self from public.integration_resources where id = new.id;
  if not found then
    -- Deleted by a later statement in the same transaction -- nothing
    -- left to validate for this row.
    return new;
  end if;

  select * into _claiming_tracking from public.tracking_configurations where integration_resource_id = _self.id;
  if _claiming_tracking.id is distinct from _self.linked_tracking_configuration_id then
    raise exception 'integration_resource_link_inconsistent: Tracking configuration linkage is not mutually consistent for this resource';
  end if;

  select * into _claiming_seo from public.seo_profiles where integration_resource_id = _self.id;
  if _claiming_seo.id is distinct from _self.linked_seo_profile_id then
    raise exception 'integration_resource_link_inconsistent: SEO profile linkage is not mutually consistent for this resource';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_integration_resource_canonical_link_consistency() from public;

create or replace function public.check_tracking_configuration_resource_link_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _self               public.tracking_configurations;
  _claiming_resource  public.integration_resources;
begin
  select * into _self from public.tracking_configurations where id = new.id;
  if not found then
    return new;
  end if;

  select * into _claiming_resource from public.integration_resources where linked_tracking_configuration_id = _self.id;
  if _claiming_resource.id is distinct from _self.integration_resource_id then
    raise exception 'integration_resource_link_inconsistent: Integration resource linkage is not mutually consistent for this tracking configuration';
  end if;
  if _self.integration_resource_id is not null and (_claiming_resource.agency_id <> _self.agency_id or _claiming_resource.client_id <> _self.client_id) then
    raise exception 'integration_resource_tenant_mismatch: Referenced integration resource belongs to a different agency/client';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_tracking_configuration_resource_link_consistency() from public;

create or replace function public.check_seo_profile_resource_link_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _self               public.seo_profiles;
  _claiming_resource  public.integration_resources;
begin
  select * into _self from public.seo_profiles where id = new.id;
  if not found then
    return new;
  end if;

  select * into _claiming_resource from public.integration_resources where linked_seo_profile_id = _self.id;
  if _claiming_resource.id is distinct from _self.integration_resource_id then
    raise exception 'integration_resource_link_inconsistent: Integration resource linkage is not mutually consistent for this SEO profile';
  end if;
  if _self.integration_resource_id is not null and (_claiming_resource.agency_id <> _self.agency_id or _claiming_resource.client_id <> _self.client_id) then
    raise exception 'integration_resource_tenant_mismatch: Referenced integration resource belongs to a different agency/client';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_seo_profile_resource_link_consistency() from public;

-- No trigger DDL needed -- the 3 CONSTRAINT TRIGGERs created by 10 already
-- point at these function names; CREATE OR REPLACE FUNCTION updates their
-- behavior in place without touching the trigger definitions themselves.

-- -- VERIFICATION (informational -- not executed by this file) --------------------
-- select proname, prosrc ilike '%select * into _self%' as uses_fresh_self_read
--   from pg_proc where proname in (
--     'check_integration_resource_canonical_link_consistency',
--     'check_tracking_configuration_resource_link_consistency',
--     'check_seo_profile_resource_link_consistency'
--   );
-- -> expected: 3 rows, uses_fresh_self_read = true for all
