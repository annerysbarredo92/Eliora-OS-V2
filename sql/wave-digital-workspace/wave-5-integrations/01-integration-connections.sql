/*
==============================================================
ELIORA OS.M — DIGITAL INTEGRATIONS WAVE 5: INTEGRATION CONNECTIONS
==============================================================
Purpose:      One authorized provider connection (Meta first; Google,
              LinkedIn, TikTok, Pinterest, X later). This table is NOT a
              social account — social_channels remains the canonical
              product-level account record, and social_channel_snapshots
              remains the canonical historical metrics store. This table
              exists only to track the OAuth authorization itself: who
              authorized it, what provider identity granted it, what
              scopes were granted, and its connection-level health.

Multi-record: A client may have multiple connections for the same
              provider (multiple authorizing Meta identities/Business
              Manager accounts) — there is deliberately no
              one-client-one-provider constraint, matching the same
              multi-account philosophy already established for
              social_channels in Wave 3.

Connection    Connection-level auth state (this table's `status`) and
vs channel    channel-level sync state (social_channels.integration_status,
status:       unchanged) are two different concepts and must not share
              one enum: a single connection can back several channels,
              and a connection can go bad while a channel's last-known
              data is still validly 'live'. See 02-integration-
              resources.sql and the approved architecture report.

Depends on:   Phase 01-02 (agencies, clients, profiles, current_agency_id(),
              is_agency_admin(), set_updated_at()) and phase-04's client-
              excluding current_agency_id() override.
Execution:    01 → 02 → 03 → 04 → 05 → 06. Idempotent — safe to re-run.
==============================================================
*/

-- ── 1. SHARED ENUMS (used across the integration tables) ─────────────────────
-- Deliberately additive — new providers are added later with
-- `alter type integration_provider add value` (safe, non-breaking), never
-- by redefining this type. Only 'meta' is used starting Wave 5; the rest
-- exist so future providers need no schema migration to be recognized,
-- only application code (mirrors the website_type / social_platform
-- 'other' + free-text-label precedent, but here the enum itself is the
-- extension point since providers are a much smaller, controlled set).
do $$ begin
  create type integration_provider as enum (
    'meta','google','linkedin','tiktok','pinterest','x'
  );
exception when duplicate_object then null; end $$;

-- Connection-level authorization health — distinct from
-- digital_integration_status (channel-level sync state, unchanged).
do $$ begin
  create type integration_connection_status as enum (
    'connected','needs_reconnect','error','disconnected'
  );
exception when duplicate_object then null; end $$;

-- ── 2. INTEGRATION CONNECTIONS TABLE ──────────────────────────────────────────
create table if not exists integration_connections (
  id                     uuid                           primary key default uuid_generate_v4(),
  agency_id              uuid                           not null references agencies(id) on delete cascade,
  client_id              uuid                           not null references clients(id)  on delete cascade,

  provider               integration_provider           not null,
  -- Provider-side identity that authorized this connection (a Meta user
  -- or Business Manager id) — an opaque identifier, never a credential.
  provider_account_id    text,
  provider_account_name  text,

  status                 integration_connection_status  not null default 'connected',
  -- Granted OAuth scopes — safe to store; never a secret.
  scopes                 text[]                         not null default '{}',

  connected_at           timestamptz                    not null default now(),
  last_synced_at         timestamptz,
  last_sync_attempt_at   timestamptz,
  -- Safe, normalized codes only (see the approved error-model: e.g.
  -- 'token_expired', 'permission_revoked') — never a raw provider
  -- error body, and never token/secret material. Enforced by convention
  -- + code review at the Edge Function layer, same as tracking_
  -- configurations.configuration's "no secret storage" contract — Postgres
  -- cannot itself verify a text column's contents are secret-free.
  last_error_code        text,
  last_error_message     text,
  disconnected_at        timestamptz,

  -- A human genuinely initiates a connection (clicks "Connect Meta") even
  -- though an Edge Function performs the write — created_by/updated_by
  -- are meaningful here, unlike the fully-automated tables later in this
  -- wave (see 02/03/05's header comments for why those omit them).
  created_by             uuid                           references profiles(id) on delete set null,
  updated_by             uuid                           references profiles(id) on delete set null,
  created_at             timestamptz                    not null default now(),
  updated_at             timestamptz                    not null default now()
);

-- Idempotent reconnect: once provider_account_id is known (it always is by
-- the time a row is inserted — see the callback design in the approved
-- architecture report), a second authorization by the same provider
-- identity for the same client must UPDATE this row, never duplicate it.
-- A manually-entered or not-yet-resolved connection (provider_account_id
-- still null) is never deduplicated by the database, same convention as
-- every other Wave 1-4 external-id partial unique index.
create unique index if not exists integration_connections_provider_account_unique_idx
  on integration_connections(agency_id, client_id, provider, provider_account_id)
  where provider_account_id is not null;

create index if not exists integration_connections_client_idx   on integration_connections(client_id, provider);
create index if not exists integration_connections_agency_idx   on integration_connections(agency_id, updated_at desc);

drop trigger if exists integration_connections_set_updated_at on integration_connections;
create trigger integration_connections_set_updated_at
  before update on integration_connections
  for each row execute function set_updated_at();

alter table integration_connections enable row level security;

-- Safe connection metadata only (no token material lives on this table —
-- see 03-integration-credentials.sql) — same posture as every other
-- Digital table: agency-scoped read, admin-gated write. Edge Functions
-- perform the real mutations via the service role, which bypasses RLS;
-- these policies exist for consistency and for any future direct-RPC path.
drop policy if exists "integration_connections_select" on integration_connections;
create policy "integration_connections_select" on integration_connections
  for select using (agency_id = public.current_agency_id());

drop policy if exists "integration_connections_insert" on integration_connections;
create policy "integration_connections_insert" on integration_connections
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "integration_connections_update" on integration_connections;
create policy "integration_connections_update" on integration_connections
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "integration_connections_delete" on integration_connections;
create policy "integration_connections_delete" on integration_connections
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on integration_connections to authenticated;

-- ── 3. VERIFICATION (informational — see 06-verify-wave-5.sql for the full set) ──
-- select count(*) from integration_connections;
-- select indexname from pg_indexes where tablename = 'integration_connections' and indexname = 'integration_connections_provider_account_unique_idx';
