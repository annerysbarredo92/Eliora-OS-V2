-- ==============================================================
-- ELIORA OS.M - DIGITAL INTEGRATIONS: GOOGLE PHASE 1 SLICE G1
-- FILE 09: AGENCY-SCOPED CONNECTION MODEL
-- ==============================================================
-- Purpose:      Lets integration_connections.client_id be NULL, meaning
--               "this connection authorizes the AGENCY, not one client."
--               Required so one Google OAuth authorization can later
--               expose resources assignable to multiple different
--               clients (see 10-google-resource-linkage.sql for the
--               assignment mechanism itself -- this file only prepares
--               the connection/credential/sync-run layer underneath it).
--
-- Meaning:      client_id IS NOT NULL -> client-scoped connection
--                 (Meta continues to always create these -- unchanged)
--               client_id IS NULL     -> agency-scoped connection
--                 (Google will create these starting in Slice G2 -- not
--                 built yet; this file only makes the schema capable of
--                 representing it)
--
--               No CHECK constraint ties this to `provider` -- a future
--               provider (LinkedIn, TikTok, etc.) may choose either
--               model without a schema change, per the approved
--               architecture correction. Enforcement of which model a
--               given provider actually uses is an application-layer
--               decision (the Edge Function that creates the
--               connection), not a database-layer one.
--
-- Also widens:  integration_credentials.client_id and
--               integration_sync_runs.client_id to NULL -- both are
--               owned by (and must exactly mirror the tenant scope of)
--               a connection or resource, so both must be able to
--               represent "no client yet" the same way their owner can.
--               See section 3 below for the precise mirroring rule.
--
-- NOT changed:  integration_oauth_states.client_id remains NOT NULL --
--               it records the client workspace that INITIATED the
--               OAuth flow (used only for the post-auth return path), a
--               completely different concept from connection ownership.
--               See section 4's COMMENT ON COLUMN for the explicit
--               written distinction.
--
--               integration_resources.client_id is NOT changed here --
--               its nullability, its new link columns, and the
--               generalized integration_resources tenant-match trigger
--               all belong together in 10-google-resource-linkage.sql,
--               since they are one coherent change (a resource cannot
--               be "linked" without also being "assigned," and both
--               concepts are introduced by that file together).
--
-- Meta impact:  Every existing/future Meta row keeps client_id populated
--               -- this file only widens what the COLUMN allows, it does
--               not change what any Edge Function actually writes. The
--               provider-account uniqueness index Meta relies on is
--               replaced with a byte-identical-for-Meta equivalent (see
--               section 2) -- not weakened, not merged with the new
--               agency-scoped index.
--
-- Depends on:   01-integration-connections.sql, 03-integration-
--               credentials.sql, 05-integration-sync-runs.sql (all
--               already deployed), and 08-google-provider-extensions.sql
--               (NOT yet deployed -- must run before this file; see the
--               Slice G1 report's execution order).
-- Execution:    Run after 08. NOT YET RUN -- prepared for manual review.
--               Idempotent -- safe to re-run once applied (every
--               statement below uses IF EXISTS/IF NOT EXISTS, or is a
--               naturally idempotent ALTER COLUMN ... DROP NOT NULL).
-- ==============================================================

-- -- 1. integration_connections.client_id BECOMES NULLABLE ------------------------
alter table integration_connections alter column client_id drop not null;

comment on column integration_connections.client_id is
  'NULL = agency-scoped connection (the authorization belongs to the agency; Google uses this). NOT NULL = client-scoped connection (Meta always uses this). Never both meanings at once for a given row -- see 09-google-agency-connection-model.sql.';

-- -- 2. PROVIDER-ACCOUNT UNIQUENESS: REPLACE ONE INDEX WITH TWO -------------------
-- The original index (agency_id, client_id, provider, provider_account_id)
-- WHERE provider_account_id IS NOT NULL cannot safely represent both
-- models: Postgres unique indexes treat every NULL as DISTINCT from every
-- other NULL, so reusing it unmodified with client_id = NULL would not
-- actually stop the same Google identity from creating duplicate
-- agency-level connections on reconnect -- it would silently allow
-- unlimited duplicates. Two narrower partial indexes are required
-- instead, one per model.
--
-- Both new indexes are created BEFORE the old one is dropped, so there is
-- no window where provider-account uniqueness is unenforced for existing
-- (Meta) connections.

-- Client-scoped identity (Meta today; any future client-scoped provider).
-- Definition is byte-identical in effect to the index it replaces for
-- every row this predicate matches -- every existing Meta row has
-- client_id IS NOT NULL, so this index enforces exactly what the old one
-- enforced for them, no more and no less.
create unique index if not exists integration_connections_client_scoped_unique_idx
  on integration_connections(agency_id, client_id, provider, provider_account_id)
  where provider_account_id is not null and client_id is not null;

-- Agency-scoped identity (Google, starting in Slice G2). Reconnecting the
-- same Google account for the same agency updates this one row rather
-- than creating a duplicate. A second, different Google identity for the
-- same agency is a second, independent row -- not restricted here.
create unique index if not exists integration_connections_agency_scoped_unique_idx
  on integration_connections(agency_id, provider, provider_account_id)
  where provider_account_id is not null and client_id is null;

-- Now safe to drop -- both replacement indexes above are already in
-- place and already enforcing the client-scoped case identically.
drop index if exists integration_connections_provider_account_unique_idx;

-- integration_connections_client_idx (client_id, provider) and
-- integration_connections_agency_idx (agency_id, updated_at desc) are
-- UNCHANGED and need no action -- plain (non-unique) btree indexes in
-- Postgres index NULL values normally (grouped together), so an
-- agency-scoped connection's NULL client_id is indexed exactly like any
-- other value, no special handling required.

-- -- 3. integration_credentials.client_id BECOMES NULLABLE ------------------------
-- A credential row does not have its own "assignment" -- it is owned by
-- exactly one of connection_id/resource_id (integration_credentials_
-- single_owner, unchanged) and its client_id must always exactly MIRROR
-- that owner's client_id, including when that owner's client_id is NULL.
-- The trigger below enforces this with IS NOT DISTINCT FROM (NULL-safe
-- equality) rather than <> (which would silently skip the comparison
-- whenever either side is NULL -- a real correctness gap, not merely a
-- style choice; see the Slice G1 architecture correction report).
alter table integration_credentials alter column client_id drop not null;

comment on column integration_credentials.client_id is
  'Always mirrors the owning connection''s (or resource''s) client_id exactly, including NULL for a credential owned by an agency-scoped connection. Never set independently -- see check_integration_credential_tenant_match().';

-- SECURITY NOTE (search_path hardening -- see the Slice G1 security
-- review): SET search_path = public (this project's convention for
-- every OTHER trigger function, unchanged elsewhere) relies on the
-- `public` schema itself being non-writable by any untrusted role. That
-- happens to be true under Postgres 15+/Supabase's default (CREATE on
-- `public` is revoked from the PUBLIC pseudo-role at project creation),
-- but a function this security-sensitive should not depend on an
-- ambient environment assumption holding forever, in every environment
-- this project is ever deployed to. Every function REPLACED by this
-- Slice G1 review instead uses the maximally-restricted, officially
-- documented-safe pattern: `SET search_path = ''` (empty -- nothing but
-- the always-implicit pg_catalog/pg_temp is searched) with every single
-- table reference explicitly schema-qualified as public.<table>. This
-- means the function cannot resolve to an attacker-planted object under
-- ANY circumstance, including a future misconfiguration of `public`'s
-- own grants -- there is no schema left in the path for such an object
-- to be found in, qualified or not, other than the one literal `public.`
-- prefix written directly into this function's own source text.
create or replace function public.check_integration_credential_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _conn     public.integration_connections;
  _resource public.integration_resources;
begin
  if new.connection_id is not null then
    select * into _conn from public.integration_connections where id = new.connection_id;
    if not found then
      raise exception 'integration_connection_not_found: Referenced connection does not exist';
    end if;
    if _conn.agency_id <> new.agency_id then
      raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different agency';
    end if;
    -- IS DISTINCT FROM: NULL = NULL counts as a match (an agency-scoped
    -- connection's credential correctly has client_id = NULL too); any
    -- other mismatch, including one side NULL and the other not, is
    -- rejected. A plain <> would incorrectly treat either NULL case as
    -- "not distinct enough to raise" and silently let a mismatch through.
    if _conn.client_id is distinct from new.client_id then
      raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different client';
    end if;
  end if;

  if new.resource_id is not null then
    select * into _resource from public.integration_resources where id = new.resource_id;
    if not found then
      raise exception 'integration_resource_not_found: Referenced resource does not exist';
    end if;
    if _resource.agency_id <> new.agency_id then
      raise exception 'integration_resource_tenant_mismatch: Referenced resource belongs to a different agency';
    end if;
    if _resource.client_id is distinct from new.client_id then
      raise exception 'integration_resource_tenant_mismatch: Referenced resource belongs to a different client';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger-only function -- never meant to be called directly (it reads
-- NEW, which only exists inside an actual trigger invocation; a direct
-- call would error immediately regardless). Revoking PUBLIC's default
-- EXECUTE grant (Postgres grants this automatically on every CREATE
-- FUNCTION unless revoked) does not affect trigger firing at all --
-- Postgres invokes a trigger function internally as part of firing the
-- trigger, governed by the table's own DML privileges, not by the
-- function's EXECUTE grant. This purely closes off direct invocation
-- with no functional effect on the trigger itself.
revoke execute on function public.check_integration_credential_tenant_match() from public;

-- Ownership contract unchanged: this function is owned by 03-integration-
-- credentials.sql's original design; this CREATE OR REPLACE is the
-- documented-safe way to update it (see that file's own trigger-creation
-- comment) -- the existing integration_credentials_check_tenant_match_trg
-- trigger already points at this function by name and needs no change.

-- -- 4. integration_sync_runs.client_id BECOMES NULLABLE ---------------------------
-- Same mirroring principle as credentials, but a sync run has TWO
-- possible owners depending on what kind of run it is:
--   - connection-level run (resource_id IS NULL, e.g. a discovery pass
--     immediately after OAuth) -- must mirror the CONNECTION's client_id,
--     including NULL for an agency-scoped Google connection.
--   - resource-specific run (resource_id IS NOT NULL, e.g. a future
--     per-property GA4/Search Console sync -- not built until Slice G4)
--     -- must mirror the RESOURCE's client_id instead. This matters
--     because an agency-scoped connection's own client_id stays NULL
--     forever, while its individual resources become assigned to real
--     clients over time (see 10-google-resource-linkage.sql) -- a
--     resource-specific run's client_id is the assigned client, not the
--     connection's (always-NULL, for Google) client_id.
alter table integration_sync_runs alter column client_id drop not null;

comment on column integration_sync_runs.client_id is
  'Mirrors the connection''s client_id for a connection-level run (resource_id NULL), or the resource''s client_id for a resource-specific run (resource_id NOT NULL). NULL is valid for an agency-scoped connection''s own discovery/connection-level runs. See check_integration_sync_run_tenant_match().';

create or replace function public.check_integration_sync_run_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _conn     public.integration_connections;
  _resource public.integration_resources;
begin
  select * into _conn from public.integration_connections where id = new.connection_id;
  if not found then
    raise exception 'integration_connection_not_found: Referenced connection does not exist';
  end if;
  if _conn.agency_id <> new.agency_id then
    raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different agency';
  end if;

  if new.resource_id is not null then
    select * into _resource from public.integration_resources where id = new.resource_id;
    if not found then
      raise exception 'integration_resource_not_found: Referenced resource does not exist';
    end if;
    if _resource.agency_id <> new.agency_id then
      raise exception 'integration_resource_tenant_mismatch: Referenced resource belongs to a different agency';
    end if;
    -- Resource-specific run -- mirrors the RESOURCE's assigned client.
    if _resource.client_id is distinct from new.client_id then
      raise exception 'integration_resource_tenant_mismatch: Referenced resource belongs to a different client';
    end if;
  else
    -- Connection-level run -- mirrors the CONNECTION's client_id, NULL
    -- included (agency-scoped connection's own discovery run).
    if _conn.client_id is distinct from new.client_id then
      raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different client';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.check_integration_sync_run_tenant_match() from public;

-- -- 5. OAUTH STATE CLIENT_ID: UNCHANGED, DOCUMENTED FOR CONTRAST ------------------
-- Not altered -- remains NOT NULL, remains the initiating/return client
-- workspace. Written here explicitly so the contrast with section 1
-- above is unambiguous to anyone reading this migration later.
comment on column integration_oauth_states.client_id is
  'The client workspace the user was viewing when they started this OAuth flow (used only to build the post-auth return_path). NOT the same concept as integration_connections.client_id, which records connection OWNERSHIP -- an agency-scoped Google connection created from this state will have client_id = NULL even though this column here is never null. Do not confuse the two.';

-- -- 6. VERIFICATION (informational -- full suite lives in 12-verify-google-g1.sql) --
-- select is_nullable from information_schema.columns where table_name = 'integration_connections' and column_name = 'client_id'; -> expected: YES
-- select is_nullable from information_schema.columns where table_name = 'integration_credentials' and column_name = 'client_id'; -> expected: YES
-- select is_nullable from information_schema.columns where table_name = 'integration_sync_runs' and column_name = 'client_id';   -> expected: YES
-- select is_nullable from information_schema.columns where table_name = 'integration_oauth_states' and column_name = 'client_id'; -> expected: NO (unchanged)
-- select indexname from pg_indexes where indexname in ('integration_connections_client_scoped_unique_idx','integration_connections_agency_scoped_unique_idx'); -> expected: 2 rows
-- select indexname from pg_indexes where indexname = 'integration_connections_provider_account_unique_idx'; -> expected: 0 rows (dropped)
