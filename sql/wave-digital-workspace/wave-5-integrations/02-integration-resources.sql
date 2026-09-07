-- ==============================================================
-- ELIORA OS.M - DIGITAL INTEGRATIONS WAVE 5: INTEGRATION RESOURCES
-- ==============================================================
-- Purpose:      Maps the external provider resources discovered under one
--               integration_connections authorization (a Meta connection
--               discovers Facebook Pages and linked Instagram Business
--               accounts) to Eliora's canonical social_channels record.
--               This is a discovery/mapping layer ONLY - it is never a
--               second social-account source of truth. Safe metadata only
--               (name, handle, provider-side id, profile URL); no tokens.
--
-- Linking:      linked_channel_id is nullable - a discovered resource
--               starts unlinked. The Wave 5 Slice 2 link RPC (not part of
--               this slice) is what a user explicitly calls to map a
--               resource into social_channels, per the approved
--               architecture report's "no silent auto-linking" rule.
--
-- LOCKED        For the same provider resource identity - (agency_id,
-- INVARIANT:    client_id, provider, resource_type, external_resource_id)
--               - every linked integration_resources row MUST resolve to
--               the SAME social_channels.id, even when that identity is
--               legitimately rediscovered through a second OAuth
--               connection (Connection A and Connection B both finding
--               Instagram account 17841... is expected and fine; both
--               pointing it at DIFFERENT channels is not). Enforced
--               bidirectionally by check_integration_resource_tenant_match
--               below - see that function's own comment for the exact
--               two directions and why neither is expressible as a plain
--               UNIQUE constraint.
--
-- Depends on:   01-integration-connections.sql, and the existing
--               social_channels table (Wave 1-3).
-- Execution:    Paste after 01-integration-connections.sql. Idempotent.
--
-- NOTE ON COMMENT STYLE: every comment line in this file uses plain
-- ASCII double-hyphen line comments only. There is no multi-line comment
-- delimiter anywhere in this file, and no em dashes, arrows, or other
-- non-ASCII typography, to eliminate any risk of a copy/paste or
-- encoding mismatch corrupting a comment terminator partway through the
-- file. Copy this file's raw bytes directly from the repository (not
-- from a rendered chat message) into the Supabase SQL Editor.
-- ==============================================================

-- -- 1. ENUMS ------------------------------------------------------------------
-- Phase 1 resource types are exactly what Facebook Login for Business
-- discovery can return today (GET /me/accounts -> Pages, and each Page's
-- instagram_business_account field). Instagram "Creator" accounts surface
-- through the SAME instagram_business_account resource on the current
-- Meta API - there is no separate Creator resource type to model, so
-- none is added (confirmed against current Meta docs in the approved
-- architecture report; do not add one speculatively).
do $$ begin
  create type integration_resource_type as enum (
    'facebook_page','instagram_business_account'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type integration_link_status as enum ('unlinked','linked','conflict');
exception when duplicate_object then null; end $$;

-- -- 2. TABLE -------------------------------------------------------------------
create table if not exists integration_resources (
  id                    uuid                          primary key default uuid_generate_v4(),
  agency_id             uuid                          not null references agencies(id)              on delete cascade,
  client_id             uuid                          not null references clients(id)               on delete cascade,
  connection_id         uuid                          not null references integration_connections(id) on delete cascade,

  provider              integration_provider          not null,
  resource_type         integration_resource_type     not null,
  -- Provider-side id - not secret. NEVER assumed unique on its own across
  -- resource types (a Facebook Page id and an Instagram Business Account
  -- id are drawn from Meta's general graph-object id space; nothing in
  -- current Meta documentation guarantees they cannot collide across
  -- object types) - every uniqueness/identity rule in this file always
  -- pairs external_resource_id with resource_type. See section 3 below.
  external_resource_id  text                          not null,

  name                  text,
  handle                text,
  profile_url           text,
  -- e.g. an Instagram Business Account's linked Facebook Page id - safe,
  -- descriptive only, never used for tenant/security decisions.
  parent_external_id    text,
  -- Small safe discovery snapshot (category, picture URL, etc.) - NEVER
  -- tokens or credentials. Same "no secret storage" contract as
  -- tracking_configurations.configuration.
  raw_metadata          jsonb                         not null default '{}',

  linked_channel_id     uuid                          references social_channels(id) on delete set null,
  -- 'conflict' behaves identically to 'unlinked' for linked_channel_id
  -- purposes (see the CHECK constraint below) - it exists purely as a
  -- future application-layer signal ("discovered, but could not be
  -- safely auto/user-linked - e.g. an ambiguous match the user must
  -- resolve manually") and is never set by this migration's trigger,
  -- which only validates/rejects, never assigns a status itself.
  link_status           integration_link_status       not null default 'unlinked',

  discovered_at         timestamptz                   not null default now(),
  last_seen_at          timestamptz                   not null default now(),

  -- Discovery is fully automated (an Edge Function re-running discovery
  -- on connect/reconnect) - there is no meaningful "which human created
  -- this row" the way there is for integration_connections above.
  -- Omitting created_by/updated_by here mirrors the existing precedent
  -- of social_channel_snapshots and digital_assets, which are likewise
  -- system/automation-populated and do not carry both audit columns.
  created_at            timestamptz                   not null default now(),
  updated_at            timestamptz                   not null default now(),

  -- Rules out every logically-impossible combination up front, before the
  -- trigger below even runs: 'linked' always carries a channel, 'unlinked'
  -- and 'conflict' never do.
  constraint integration_resources_link_status_consistency check (
    (link_status = 'linked'   and linked_channel_id is not null) or
    (link_status in ('unlinked','conflict') and linked_channel_id is null)
  )
);

-- Defensive reconciliation: if integration_resources was already created by
-- an earlier draft of this file (one predating the CHECK constraint
-- above), CREATE TABLE IF NOT EXISTS above silently no-ops and that
-- constraint would otherwise never get added. Postgres has no native
-- "ADD CONSTRAINT IF NOT EXISTS" for CHECK constraints, so this reuses the
-- same DO-block/duplicate_object idiom already used for every enum in
-- this wave. A true no-op on a database where the table was just created
-- fresh above (constraint already present from that same statement).
do $$ begin
  alter table integration_resources
    add constraint integration_resources_link_status_consistency check (
      (link_status = 'linked'   and linked_channel_id is not null) or
      (link_status in ('unlinked','conflict') and linked_channel_id is null)
    );
exception when duplicate_object then null; end $$;

-- -- 3. UNIQUENESS ---------------------------------------------------------------
-- Defensive cleanup: an earlier draft of this file (before the resource_
-- type widening below) used this narrower index name/column set. Dropping
-- it by name if present makes this file safely re-runnable even against a
-- database where that earlier shape was ever partially applied - a no-op
-- on a clean database, since a never-created index cannot exist to drop.
drop index if exists integration_resources_connection_external_unique_idx;

-- Per-connection idempotent re-discovery, keyed by resource_type +
-- external_resource_id together - NOT external_resource_id alone. A
-- Facebook Page id and an Instagram Business Account id are different
-- provider resource types; nothing guarantees their id spaces never
-- collide, so resource_type must always participate in this key.
-- Re-running discovery for the same connection UPDATEs the matching row
-- (last_seen_at, name, etc.), never duplicates it.
create unique index if not exists integration_resources_connection_resource_unique_idx
  on integration_resources(connection_id, resource_type, external_resource_id);

-- Supports the trigger's "direction B" lookup below (same resource
-- identity, is it already linked to a different channel?) without a
-- sequential scan.
create index if not exists integration_resources_identity_idx
  on integration_resources(client_id, provider, resource_type, external_resource_id);

create index if not exists integration_resources_client_idx        on integration_resources(client_id, provider);
create index if not exists integration_resources_connection_idx    on integration_resources(connection_id);
create index if not exists integration_resources_linked_channel_idx on integration_resources(linked_channel_id) where linked_channel_id is not null;

drop trigger if exists integration_resources_set_updated_at on integration_resources;
create trigger integration_resources_set_updated_at
  before update on integration_resources
  for each row execute function set_updated_at();

-- -- 4. TENANT + BIDIRECTIONAL LINK-CONSISTENCY TRIGGER --------------------------
-- Three distinct guarantees in one trigger, all required before this row
-- can be trusted:
--
--   1. TENANT MATCH - connection_id (and linked_channel_id, when set) must
--      belong to the SAME agency_id/client_id this row claims. Same gap
--      check_website_tenant_match() closes for website_id elsewhere.
--
--   2. LINK CONSISTENCY, DIRECTION A (one channel -> one resource identity)
--      - a canonical channel cannot represent two different provider
--      resource identities. The same external resource CAN legitimately
--      be rediscovered through a second authorization (two
--      integration_resources rows, one per connection) and both may
--      correctly point at the SAME linked_channel_id - a plain
--      unique(linked_channel_id) would wrongly block that. What must be
--      rejected is a DIFFERENT resource identity claiming a channel
--      another resource identity already claims.
--
--   3. LINK CONSISTENCY, DIRECTION B (one resource identity -> one channel)
--      - the reverse of direction A, and the gap an earlier version of
--      this trigger left open: the SAME provider resource identity
--      (agency_id, client_id, provider, resource_type,
--      external_resource_id) discovered through two different
--      connections must resolve to the SAME channel. Connection A linking
--      Instagram account 17841... to Channel X, then Connection B
--      rediscovering the identical account and linking it to Channel Y,
--      must be rejected.
--
-- Neither direction is expressible as a single plain UNIQUE constraint -
-- each is a conditional, multi-row invariant ("all peer rows sharing
-- value V must also agree on value W") - so both are enforced here as
-- read-only peer-row lookups within this BEFORE ROW trigger. This is NOT
-- recursive: a plain SELECT against this same table does not fire this or
-- any other row's trigger (only INSERT/UPDATE/DELETE statements do), and
-- this trigger never writes to a peer row - it only validates the
-- incoming NEW row and rejects (RAISE EXCEPTION) or passes it through
-- unchanged. Every peer-row query explicitly excludes id <> new.id so a
-- row is never compared against itself, including on UPDATE.
--
-- OWNERSHIP CONTRACT: owned by this file. Later files may only CREATE
-- TRIGGERs against it, never DROP or CREATE OR REPLACE it - same
-- "create or replace" re-run safety as check_website_tenant_match().
create or replace function public.check_integration_resource_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _conn     integration_connections;
  _channel  social_channels;
  _conflict integration_resources;
begin
  select * into _conn from integration_connections where id = new.connection_id;
  if not found then
    raise exception 'integration_connection_not_found: Referenced connection does not exist';
  end if;
  if _conn.agency_id <> new.agency_id or _conn.client_id <> new.client_id then
    raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different agency/client';
  end if;

  if new.linked_channel_id is not null then
    select * into _channel from social_channels where id = new.linked_channel_id;
    if not found then
      raise exception 'social_channel_not_found: Referenced social channel does not exist';
    end if;
    if _channel.agency_id <> new.agency_id or _channel.client_id <> new.client_id then
      raise exception 'social_channel_tenant_mismatch: Referenced social channel belongs to a different agency/client';
    end if;

    -- Direction A: no OTHER row already claims this same channel under a
    -- different provider resource identity.
    select * into _conflict
      from integration_resources
      where linked_channel_id = new.linked_channel_id
        and id <> new.id
        and (provider, resource_type, external_resource_id)
              is distinct from (new.provider, new.resource_type, new.external_resource_id)
      limit 1;
    if found then
      raise exception 'integration_resource_link_conflict: This channel is already linked to a different external resource identity';
    end if;

    -- Direction B: no OTHER row with this same resource identity (found
    -- via a different connection, or a stray duplicate) already points at
    -- a DIFFERENT channel. Rows sharing this identity and already pointing
    -- at the SAME channel are fine and expected (multi-connection
    -- rediscovery) - only a genuine disagreement is rejected.
    select * into _conflict
      from integration_resources
      where agency_id = new.agency_id
        and client_id = new.client_id
        and provider = new.provider
        and resource_type = new.resource_type
        and external_resource_id = new.external_resource_id
        and id <> new.id
        and linked_channel_id is not null
        and linked_channel_id <> new.linked_channel_id
      limit 1;
    if found then
      raise exception 'integration_resource_link_conflict: This external resource is already linked to a different social channel';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists integration_resources_check_tenant_match_trg on integration_resources;
create trigger integration_resources_check_tenant_match_trg
  before insert or update on integration_resources
  for each row execute function check_integration_resource_tenant_match();

-- -- 5. RLS -----------------------------------------------------------------------
alter table integration_resources enable row level security;

drop policy if exists "integration_resources_select" on integration_resources;
create policy "integration_resources_select" on integration_resources
  for select using (agency_id = public.current_agency_id());

drop policy if exists "integration_resources_insert" on integration_resources;
create policy "integration_resources_insert" on integration_resources
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "integration_resources_update" on integration_resources;
create policy "integration_resources_update" on integration_resources
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "integration_resources_delete" on integration_resources;
create policy "integration_resources_delete" on integration_resources
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on integration_resources to authenticated;

-- -- 6. VERIFICATION (informational) ----------------------------------------------
-- select count(*) from integration_resources;
-- select tgname from pg_trigger where tgname = 'integration_resources_check_tenant_match_trg';
-- select indexname from pg_indexes where tablename = 'integration_resources' and indexname = 'integration_resources_connection_resource_unique_idx';
-- select conname from pg_constraint where conname = 'integration_resources_link_status_consistency';
