-- ==============================================================
-- ELIORA OS.M - DIGITAL INTEGRATIONS: GOOGLE PHASE 1 SLICE G1
-- FILE 10: RESOURCE LINKAGE (assignment + canonical destinations)
-- ==============================================================
-- Purpose:      Lets a discovered integration_resources row exist
--               UNASSIGNED (client_id NULL) after agency-scoped
--               discovery, be explicitly ASSIGNED to one Eliora client
--               later (Slice G3 -- not built in this file), and be
--               LINKED to the correct canonical Digital record for that
--               resource type: social_channels (Meta, existing,
--               unchanged), tracking_configurations (GA4, new), or
--               seo_profiles (Search Console, new).
--
-- Resource      Adds exactly ga4_property and search_console_site to
-- types:        integration_resource_type. No GBP/YouTube/Ads placeholder
--               values -- not needed until those slices exist.
--
-- Assignment    client_id represents ASSIGNMENT, not discovery ownership
-- vs discovery: -- discovery ownership was always really agency_id (every
--               row has always had a non-null agency_id from the moment
--               it's discovered, Meta included). Before this file,
--               client_id happened to mean both things at once only
--               because every connection was client-scoped, so they were
--               always identical. This file makes that conflation
--               unnecessary rather than adding a second column with
--               overlapping meaning: client_id now unambiguously means
--               "assigned to this client" (NULL = not yet assigned).
--
-- Link model:   integration_resources_link_status_consistency is
--               rewritten (not just extended) to cover 3 mutually
--               exclusive canonical destinations instead of 1:
--                 linked_channel_id                  (Meta, existing)
--                 linked_tracking_configuration_id    (GA4, new)
--                 linked_seo_profile_id               (Search Console, new)
--               LINKED requires exactly one of the three AND client_id
--               NOT NULL (a resource cannot be linked while unassigned).
--               UNLINKED and CONFLICT both require all three NULL --
--               'conflict' is preserved as behaving identically to
--               'unlinked' for link-target purposes, exactly as the
--               original constraint's own comment specified; this file
--               does not change what sets link_status to 'conflict' (no
--               trigger here ever assigns that value itself, same as
--               before).
--
-- Bidirectional Both directions are written (integration_resources ->
-- consistency:  canonical record, AND canonical record -> integration_
--               resources), per the approved correction. Two independent
--               FK columns representing the same fact can drift apart if
--               only one side is ever updated -- enforced here with a
--               pair of DEFERRABLE, INITIALLY DEFERRED constraint
--               triggers (not immediate BEFORE triggers), specifically
--               so a future assignment transaction (Slice G3) can write
--               both sides in either order and only has the invariant
--               checked once, at commit, when both writes are visible.
--               A transaction that only updates one side fails at
--               commit with a clear error instead of leaving silently
--               mismatched state.
--
-- Direction B   The deployed Meta trigger's peer-conflict lookup filters
-- fix (Meta     by `agency_id = new.agency_id AND client_id = new.
-- gap):         client_id` -- meaning it only ever compares a resource
--               against peers within the SAME client, and can never
--               catch "Client 1 and Client 2 in the same agency both
--               link the same external Facebook Page to different
--               channels." This file corrects that: the peer lookup is
--               now scoped by agency_id ONLY (dropping the client_id
--               equality filter, replacing it with "assigned+linked to
--               some OTHER client_id"), which is strictly a WIDER check
--               than before -- it can only newly reject a state that was
--               always meant to be invalid, never accept something that
--               used to be rejected. See the preflight guard immediately
--               below, which stops this file cold if any such
--               pre-existing state is found in current data.
--
-- Meta impact:  Every column this file adds is new and starts NULL for
--               every existing Meta row (no backfill, no reinterpretation
--               of existing linked_channel_id data). The link_status
--               CHECK's client-scoped branch (linked_channel_id) is
--               logically unchanged for Meta's existing rows -- they
--               already satisfy client_id IS NOT NULL (client-scoped
--               connections always populate it) and already have exactly
--               one link target (linked_channel_id) when linked. See
--               the Slice G1 report's Meta Regression Check section for
--               the full, precise account of what changes vs what does not.
--
-- Depends on:   09-google-agency-connection-model.sql (client_id
--               nullability on integration_connections), 01-05
--               (deployed), tracking_configurations/seo_profiles
--               (wave-1-foundation, deployed).
-- Execution:    Run after 09. NOT YET RUN -- prepared for manual review.
--               The preflight guard below runs first and ABORTS the
--               entire script (raises an exception, no schema change
--               applied) if any pre-existing same-agency cross-client
--               linked conflict is found in current data -- see section
--               0. Idempotent otherwise -- safe to re-run once applied.
-- ==============================================================

-- -- 0. PREFLIGHT GUARD (read-only check, runs BEFORE any schema change) ----------
-- Detects whether the Direction B fix below would find any ALREADY-
-- EXISTING same-agency, cross-client, same-external-identity LINKED
-- conflict in current data (today this can only involve Meta's
-- linked_channel_id, since it is the only link column that exists before
-- this file adds the other two). If any are found, this aborts the
-- entire script immediately -- no table is altered, no constraint is
-- added, no trigger is replaced. Resolve the conflict(s) manually (see
-- 12-verify-google-g1.sql for the detailed identification query showing
-- which rows), then re-run this file.
do $$
declare
  _conflict_count integer;
begin
  select count(*) into _conflict_count
  from (
    select agency_id, provider, resource_type, external_resource_id
      from public.integration_resources
     where client_id is not null
       and linked_channel_id is not null
     group by agency_id, provider, resource_type, external_resource_id
    having count(distinct client_id) > 1
  ) as conflicts;

  if _conflict_count > 0 then
    raise exception 'integration_g1_preflight_failed: Found % pre-existing same-agency, cross-client, same-external-resource-identity linked conflict(s) in current data. This migration has made NO changes. Resolve manually -- see 12-verify-google-g1.sql section 0 for the detailed identification query -- then re-run this file.', _conflict_count;
  end if;
end $$;

-- -- 1. GOOGLE RESOURCE TYPES -------------------------------------------------------
alter type integration_resource_type add value if not exists 'ga4_property';
alter type integration_resource_type add value if not exists 'search_console_site';

-- -- 2. integration_resources.client_id BECOMES NULLABLE ---------------------------
alter table integration_resources alter column client_id drop not null;

comment on column integration_resources.client_id is
  'The Eliora client this discovered resource has been explicitly ASSIGNED to. NULL = discovered but not yet assigned (only possible for a resource discovered under an agency-scoped connection -- see 09-google-agency-connection-model.sql). Assignment and linking happen together -- see integration_resources_link_status_consistency, which requires client_id NOT NULL whenever link_status = linked.';

-- Supports the corrected, agency-scoped Direction B conflict lookup
-- (section 6) without a sequential scan. The existing client_id-leading
-- integration_resources_identity_idx is UNCHANGED and still useful for
-- "what is assigned to this client" queries -- this is an addition, not
-- a replacement.
create index if not exists integration_resources_agency_identity_idx
  on integration_resources(agency_id, provider, resource_type, external_resource_id);

-- -- 3. NEW CANONICAL LINK COLUMNS --------------------------------------------------
alter table integration_resources add column if not exists linked_tracking_configuration_id uuid references tracking_configurations(id) on delete set null;
alter table integration_resources add column if not exists linked_seo_profile_id            uuid references seo_profiles(id)            on delete set null;

comment on column integration_resources.linked_tracking_configuration_id is
  'Set only for resource_type = ga4_property. Mutually exclusive with linked_channel_id and linked_seo_profile_id -- see integration_resources_link_status_consistency.';
comment on column integration_resources.linked_seo_profile_id is
  'Set only for resource_type = search_console_site. Mutually exclusive with linked_channel_id and linked_tracking_configuration_id -- see integration_resources_link_status_consistency.';

-- -- 4. LINK_STATUS CONSTRAINT: REWRITTEN FOR 3 DESTINATIONS ------------------------
-- Reviewed the original constraint carefully before replacing it (per
-- the correction instructions): the original allowed exactly ONE shape
-- for 'linked' (linked_channel_id set) and required NO link target for
-- both 'unlinked' AND 'conflict' alike -- 'conflict' was deliberately
-- never given its own distinct shape, only ever behaving like
-- 'unlinked' for link-target purposes. That exact behavior is preserved
-- below, generalized only to recognize 3 possible link targets instead
-- of 1, and now additionally requiring client_id NOT NULL whenever
-- link_status = 'linked' (a resource cannot be linked while unassigned).
alter table integration_resources drop constraint if exists integration_resources_link_status_consistency;

alter table integration_resources add constraint integration_resources_link_status_consistency check (
  (
    link_status = 'linked'
    and client_id is not null
    and (
      (case when linked_channel_id is not null then 1 else 0 end) +
      (case when linked_tracking_configuration_id is not null then 1 else 0 end) +
      (case when linked_seo_profile_id is not null then 1 else 0 end)
    ) = 1
  )
  or (
    link_status in ('unlinked', 'conflict')
    and linked_channel_id is null
    and linked_tracking_configuration_id is null
    and linked_seo_profile_id is null
  )
);

-- -- 5. CANONICAL DIGITAL BACK-REFERENCES --------------------------------------------
-- Reuses tracking_configurations/seo_profiles exactly as they are -- no
-- second GA4 configuration system, no second SEO profile system. Both
-- columns are nullable and ON DELETE SET NULL: deleting a discovered
-- resource (should that ever happen) never deletes the canonical record
-- that was linked to it, only clears the back-reference.
alter table tracking_configurations add column if not exists integration_resource_id uuid references integration_resources(id) on delete set null;
alter table seo_profiles            add column if not exists integration_resource_id uuid references integration_resources(id) on delete set null;

comment on column tracking_configurations.integration_resource_id is
  'The discovered Google resource (resource_type = ga4_property) backing this configuration, if any. Manual/non-Google tracking configurations leave this NULL -- manual entry remains a fully supported fallback, unaffected.';
comment on column seo_profiles.integration_resource_id is
  'The discovered Google resource (resource_type = search_console_site) backing this profile, if any. Manual/non-Google SEO profiles leave this NULL -- manual entry remains a fully supported fallback, unaffected.';

-- A given discovered resource backs at most one canonical record of each
-- type -- prevents two different tracking_configurations rows both
-- claiming the same integration_resources row.
create unique index if not exists tracking_configurations_integration_resource_unique_idx
  on tracking_configurations(integration_resource_id) where integration_resource_id is not null;
create unique index if not exists seo_profiles_integration_resource_unique_idx
  on seo_profiles(integration_resource_id) where integration_resource_id is not null;

-- -- 6. GENERALIZED TENANT-MATCH TRIGGER (Direction A x3 + corrected Direction B) ---
-- Six distinct guarantees now, all required before an integration_
-- resources row can be trusted (was three, all Meta/social_channels-only):
--
--   1. CONNECTION TENANT MATCH -- connection_id must belong to the SAME
--      agency_id this row claims. If the connection is client-scoped
--      (client_id NOT NULL -- Meta, always), this row's client_id must
--      also match it exactly. If the connection is agency-scoped
--      (client_id NULL -- Google), no such requirement is imposed here;
--      this row's own client_id represents assignment, validated
--      independently below.
--
--   2/3/4. DIRECTION A, per destination type (social_channels /
--      tracking_configurations / seo_profiles) -- whichever ONE
--      destination this row claims (link_status = linked, enforced by
--      the CHECK constraint above), that destination's own agency_id/
--      client_id must match this row's exactly. And no OTHER resource
--      row already claims that SAME destination under a DIFFERENT
--      external identity.
--
--   5. DIRECTION B (corrected) -- the SAME external provider resource
--      identity (agency_id, provider, resource_type, external_
--      resource_id), once actually LINKED, must never be linked to a
--      DIFFERENT client's canonical record within the SAME agency. Two
--      rows sharing this identity and already pointing at destinations
--      belonging to the SAME client are fine and expected (multi-
--      connection rediscovery, or -- for Google -- the same resource
--      simply being visible through one agency-scoped connection and
--      referenced by one assigned row). Scoped by agency_id ONLY --
--      never compares across agencies, never leaks another agency's
--      data (see the file header's "Direction B fix" note).
--
-- Neither Direction A's cross-destination check nor Direction B is
-- expressible as a single plain UNIQUE constraint -- both are
-- conditional, multi-row invariants, enforced here as read-only peer-row
-- lookups within this BEFORE ROW trigger, same as the original. Every
-- peer-row query excludes id <> new.id.
--
-- OWNERSHIP CONTRACT: owned by 02-integration-resources.sql originally;
-- this CREATE OR REPLACE is the documented-safe way to update it -- the
-- existing integration_resources_check_tenant_match_trg trigger already
-- points at this function by name and needs no change.
-- SECURITY NOTE (search_path hardening): see 09-google-agency-connection-
-- model.sql's note on the same topic. This function in particular is the
-- most reference-heavy of the whole slice (5 tables) -- exactly the kind
-- of function where an unqualified reference is easiest to miss, which
-- is itself part of the argument for the maximally restrictive `SET
-- search_path = ''` pattern over a hand-audited `public`-only one.
create or replace function public.check_integration_resource_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _conn      public.integration_connections;
  _channel   public.social_channels;
  _tracking  public.tracking_configurations;
  _seo       public.seo_profiles;
  _conflict  public.integration_resources;
begin
  select * into _conn from public.integration_connections where id = new.connection_id;
  if not found then
    raise exception 'integration_connection_not_found: Referenced connection does not exist';
  end if;
  if _conn.agency_id <> new.agency_id then
    raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different agency';
  end if;
  if _conn.client_id is not null and _conn.client_id <> new.client_id then
    raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different client';
  end if;

  -- Direction A -- social_channels (Meta, unchanged in effect).
  if new.linked_channel_id is not null then
    select * into _channel from public.social_channels where id = new.linked_channel_id;
    if not found then
      raise exception 'social_channel_not_found: Referenced social channel does not exist';
    end if;
    if _channel.agency_id <> new.agency_id or _channel.client_id <> new.client_id then
      raise exception 'social_channel_tenant_mismatch: Referenced social channel belongs to a different agency/client';
    end if;

    select * into _conflict from public.integration_resources
      where linked_channel_id = new.linked_channel_id
        and id <> new.id
        and (provider, resource_type, external_resource_id) is distinct from (new.provider, new.resource_type, new.external_resource_id)
      limit 1;
    if found then
      raise exception 'integration_resource_link_conflict: This channel is already linked to a different external resource identity';
    end if;
  end if;

  -- Direction A -- tracking_configurations (GA4, new).
  if new.linked_tracking_configuration_id is not null then
    select * into _tracking from public.tracking_configurations where id = new.linked_tracking_configuration_id;
    if not found then
      raise exception 'tracking_configuration_not_found: Referenced tracking configuration does not exist';
    end if;
    if _tracking.agency_id <> new.agency_id or _tracking.client_id <> new.client_id then
      raise exception 'tracking_configuration_tenant_mismatch: Referenced tracking configuration belongs to a different agency/client';
    end if;

    select * into _conflict from public.integration_resources
      where linked_tracking_configuration_id = new.linked_tracking_configuration_id
        and id <> new.id
        and (provider, resource_type, external_resource_id) is distinct from (new.provider, new.resource_type, new.external_resource_id)
      limit 1;
    if found then
      raise exception 'integration_resource_link_conflict: This tracking configuration is already linked to a different external resource identity';
    end if;
  end if;

  -- Direction A -- seo_profiles (Search Console, new).
  if new.linked_seo_profile_id is not null then
    select * into _seo from public.seo_profiles where id = new.linked_seo_profile_id;
    if not found then
      raise exception 'seo_profile_not_found: Referenced SEO profile does not exist';
    end if;
    if _seo.agency_id <> new.agency_id or _seo.client_id <> new.client_id then
      raise exception 'seo_profile_tenant_mismatch: Referenced SEO profile belongs to a different agency/client';
    end if;

    select * into _conflict from public.integration_resources
      where linked_seo_profile_id = new.linked_seo_profile_id
        and id <> new.id
        and (provider, resource_type, external_resource_id) is distinct from (new.provider, new.resource_type, new.external_resource_id)
      limit 1;
    if found then
      raise exception 'integration_resource_link_conflict: This SEO profile is already linked to a different external resource identity';
    end if;
  end if;

  -- Direction B (corrected) -- same external identity, actually linked,
  -- must not resolve to two different clients within the same agency.
  -- Only runs when THIS row is itself being linked (any of the 3
  -- targets set) and only matches peers that are ALSO actually linked --
  -- an unlinked/merely-discovered duplicate is not a conflict.
  if new.client_id is not null
     and (new.linked_channel_id is not null or new.linked_tracking_configuration_id is not null or new.linked_seo_profile_id is not null)
  then
    select * into _conflict from public.integration_resources
      where agency_id = new.agency_id
        and provider = new.provider
        and resource_type = new.resource_type
        and external_resource_id = new.external_resource_id
        and id <> new.id
        and client_id is not null
        and client_id <> new.client_id
        and (linked_channel_id is not null or linked_tracking_configuration_id is not null or linked_seo_profile_id is not null)
      limit 1;
    if found then
      raise exception 'integration_resource_link_conflict: This external resource is already linked to a different client in this agency';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.check_integration_resource_tenant_match() from public;

-- -- 7. BIDIRECTIONAL CANONICAL-LINK CONSISTENCY (deferred constraint triggers) -----
-- Both FK directions (integration_resources -> canonical record, and
-- canonical record -> integration_resources) exist per the approved
-- correction (section 6/7). These three constraint triggers verify they
-- never drift apart. DEFERRABLE INITIALLY DEFERRED so a future
-- assignment transaction (Slice G3, not built here) can write both
-- sides in either order within one transaction -- the check only
-- actually runs once, at COMMIT (or an explicit SET CONSTRAINTS ALL
-- IMMEDIATE), by which point both writes are visible to each other
-- (ordinary same-transaction MVCC visibility -- a deferred trigger reads
-- the CURRENT row state when it actually fires, not a snapshot frozen
-- at the moment the triggering statement ran). A transaction that
-- updates only one side fails when the check runs, with a clear,
-- generic error, rather than leaving mismatched state.
--
-- CORRECTNESS NOTE (Slice G1 review, corrected from an earlier draft):
-- each function below performs an UNCONDITIONAL reverse lookup ("does
-- ANY canonical record currently claim this resource via its own back-
-- reference, and does that match what this resource itself declares")
-- rather than only checking "if my own link column happens to be set."
-- The earlier, narrower form only fired when the checked row's own link
-- column was non-null, which correctly caught a MISMATCHED link but
-- completely missed a ONE-SIDED UNLINK -- e.g. clearing integration_
-- resources.linked_tracking_configuration_id back to NULL without also
-- clearing the corresponding tracking_configurations.integration_
-- resource_id in the same transaction would have gone undetected, since
-- the check simply never ran when the column was NULL. The unconditional
-- reverse-lookup form catches every combination: both sides agree
-- (linked or not), or a mismatch in EITHER direction, including a
-- one-sided unlink -- traced through explicitly below for the exact
-- cases this review required proof for.
--
-- CASE A/B (unassigned resource -> create/update canonical record ->
-- link both sides -> COMMIT): each side's UPDATE queues its own deferred
-- check. At commit, both re-run their reverse lookup against the
-- now-fully-written state and find agreement -- succeeds. Traced and
-- confirmed correct for both GA4 (tracking_configurations) and Search
-- Console (seo_profiles).
--
-- CASE C (only one side written -> COMMIT): the side that WAS written
-- points at a target; that target's own reverse lookup finds nothing (or
-- something else) claiming it back -- mismatch -- commit fails. Traced
-- and confirmed for both directions (resource-side-only and canonical-
-- record-side-only).
--
-- CASE D (both sides point to different records): at least one direction's
-- reverse lookup necessarily disagrees with what that row declares --
-- commit fails.
--
-- CASE E (a valid linked pair is unlinked together, both sides set back
-- to NULL/none, in one transaction): the reverse lookup on each side
-- finds nothing claiming it, matching the now-NULL declared value on
-- both sides -- agreement -- commit succeeds. This is also exactly the
-- case the unconditional redesign had to keep working correctly while
-- fixing the one-sided-unlink gap above -- confirmed it does.
--
-- CASE F (the canonical record itself is DELETED while still linked --
-- ON DELETE SET NULL on integration_resources.linked_tracking_
-- configuration_id/linked_seo_profile_id): Postgres implements an FK's
-- SET NULL action as a real UPDATE on the referencing row, which is
-- re-validated against ALL of that row's own constraints, including
-- integration_resources_link_status_consistency (section 4) -- which
-- requires client_id NOT NULL and exactly one link target whenever
-- link_status = 'linked'. Nulling the link target while link_status is
-- still 'linked' violates that CHECK immediately, so the DELETE on the
-- canonical record is REJECTED outright (a constraint-violation error)
-- rather than ever landing a resource row in the impossible
-- "linked, but no target" shape this review asked to rule out. This is
-- intentional, existing, zero-additional-code behavior -- confirmed by
-- tracing it, not assumed. The practical effect: a still-linked
-- tracking_configurations/seo_profiles row cannot be hard-deleted via
-- the existing plain-DELETE application path (features/digital/api.ts's
-- deleteTrackingConfiguration) without first explicitly unlinking it --
-- a future unlink-first UX is a Slice G3+ concern, not a G1 schema gap.
--
-- CASE G (an integration_resources row itself is deleted -- rare, no
-- current designed flow does this): tracking_configurations.
-- integration_resource_id / seo_profiles.integration_resource_id are set
-- NULL by their own ON DELETE SET NULL action. Unlike Case F, there is
-- NO constraint tying tracking_configurations.status/seo_profiles.
-- search_console_status to integration_resource_id's nullness (nothing
-- in this schema, before or after this slice, database-enforces that
-- correlation -- status has always been an independently-settable
-- field). The row is left in a referentially VALID state (NULL is a
-- fully legal value, equivalent to "never linked" / manual) but its
-- status field is NOT automatically reset by this migration -- flagged
-- explicitly as a known, deliberate G1 boundary: deciding what a
-- canonical record's status should become when its backing resource
-- disappears is an application-layer policy decision for whichever
-- future slice actually builds a resource-removal flow, not a database
-- trigger's job to decide silently. Confirmed there is no constraint
-- violation risk either way.

-- REVISED (Slice G1 security/semantics review) -- the original version of
-- this function only checked "if my link column is set, does the target
-- point back," which misses the SYMMETRIC case: this resource's link
-- column was just CLEARED (unlinked) but the canonical record's back-
-- reference was NOT also cleared in the same transaction -- that stale
-- forward reference would have gone completely undetected, since the
-- old check never ran at all when new.linked_X_id was NULL. Rewritten
-- to look up, UNCONDITIONALLY, whichever canonical record (if any)
-- currently claims THIS resource via its own back-reference, and
-- compare that against what this resource itself declares -- this
-- single symmetric comparison catches every combination: both agree on
-- "linked," both agree on "not linked," or a mismatch in either
-- direction (including a one-sided unlink). Uses the unique index on
-- integration_resource_id (section 5) so the reverse lookup is a single
-- indexed row fetch, not a scan.
create or replace function public.check_integration_resource_canonical_link_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _claiming_tracking public.tracking_configurations;
  _claiming_seo      public.seo_profiles;
begin
  select * into _claiming_tracking from public.tracking_configurations where integration_resource_id = new.id;
  if _claiming_tracking.id is distinct from new.linked_tracking_configuration_id then
    raise exception 'integration_resource_link_inconsistent: Tracking configuration linkage is not mutually consistent for this resource';
  end if;

  select * into _claiming_seo from public.seo_profiles where integration_resource_id = new.id;
  if _claiming_seo.id is distinct from new.linked_seo_profile_id then
    raise exception 'integration_resource_link_inconsistent: SEO profile linkage is not mutually consistent for this resource';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_integration_resource_canonical_link_consistency() from public;

drop trigger if exists integration_resources_check_canonical_link_trg on integration_resources;
create constraint trigger integration_resources_check_canonical_link_trg
  after insert or update on integration_resources
  deferrable initially deferred
  for each row execute function check_integration_resource_canonical_link_consistency();

-- REVISED (same reasoning as check_integration_resource_canonical_link_
-- consistency above) -- looks up whichever resource (if any) currently
-- claims THIS tracking configuration via linked_tracking_configuration_id,
-- unconditionally, rather than only validating when new.integration_
-- resource_id happens to be set. Existence of new.integration_resource_id
-- itself is already guaranteed by its own FK constraint (added in section
-- 5) -- this function's job is the bidirectional agreement and tenant
-- match, not existence.
create or replace function public.check_tracking_configuration_resource_link_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _claiming_resource public.integration_resources;
begin
  select * into _claiming_resource from public.integration_resources where linked_tracking_configuration_id = new.id;
  if _claiming_resource.id is distinct from new.integration_resource_id then
    raise exception 'integration_resource_link_inconsistent: Integration resource linkage is not mutually consistent for this tracking configuration';
  end if;
  if new.integration_resource_id is not null and (_claiming_resource.agency_id <> new.agency_id or _claiming_resource.client_id <> new.client_id) then
    raise exception 'integration_resource_tenant_mismatch: Referenced integration resource belongs to a different agency/client';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_tracking_configuration_resource_link_consistency() from public;

drop trigger if exists tracking_configurations_check_resource_link_trg on tracking_configurations;
create constraint trigger tracking_configurations_check_resource_link_trg
  after insert or update on tracking_configurations
  deferrable initially deferred
  for each row execute function check_tracking_configuration_resource_link_consistency();

-- REVISED -- same reasoning as the tracking_configurations version above.
create or replace function public.check_seo_profile_resource_link_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _claiming_resource public.integration_resources;
begin
  select * into _claiming_resource from public.integration_resources where linked_seo_profile_id = new.id;
  if _claiming_resource.id is distinct from new.integration_resource_id then
    raise exception 'integration_resource_link_inconsistent: Integration resource linkage is not mutually consistent for this SEO profile';
  end if;
  if new.integration_resource_id is not null and (_claiming_resource.agency_id <> new.agency_id or _claiming_resource.client_id <> new.client_id) then
    raise exception 'integration_resource_tenant_mismatch: Referenced integration resource belongs to a different agency/client';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_seo_profile_resource_link_consistency() from public;

drop trigger if exists seo_profiles_check_resource_link_trg on seo_profiles;
create constraint trigger seo_profiles_check_resource_link_trg
  after insert or update on seo_profiles
  deferrable initially deferred
  for each row execute function check_seo_profile_resource_link_consistency();

-- -- 8. VERIFICATION (informational -- full suite lives in 12-verify-google-g1.sql) --
-- select unnest(enum_range(null::integration_resource_type))::text; -> expected: facebook_page, instagram_business_account, ga4_property, search_console_site
-- select is_nullable from information_schema.columns where table_name = 'integration_resources' and column_name = 'client_id'; -> expected: YES
-- select column_name from information_schema.columns where table_name = 'integration_resources' and column_name in ('linked_tracking_configuration_id','linked_seo_profile_id'); -> expected: 2 rows
-- select column_name from information_schema.columns where table_name in ('tracking_configurations','seo_profiles') and column_name = 'integration_resource_id'; -> expected: 2 rows
-- select conname from pg_constraint where conname = 'integration_resources_link_status_consistency'; -> expected: 1 row
-- select tgname, tgdeferrable, tginitdeferred from pg_trigger where tgname in ('integration_resources_check_canonical_link_trg','tracking_configurations_check_resource_link_trg','seo_profiles_check_resource_link_trg'); -> expected: 3 rows, tgdeferrable = true, tginitdeferred = true for all
