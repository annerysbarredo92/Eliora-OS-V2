/*
==============================================================
ELIORA OS.M — DIGITAL INTEGRATIONS WAVE 5: INTEGRATION CREDENTIALS
==============================================================
Purpose:      References to Supabase-Vault-stored OAuth credentials.
              THIS TABLE NEVER STORES RAW TOKEN MATERIAL — only a
              pointer (vault_secret_id) to a secret created via
              vault.create_secret(), plus safe, non-secret metadata
              (token type, expiry). The actual secret bytes live in
              Vault's own encrypted storage and are only ever readable
              through vault.decrypted_secrets, which — per the confirmed
              production configuration — grants SELECT to service_role
              only. This table is a mapping layer over that, scoped to
              Eliora's own tenant/connection/resource model.

LOCKED        Supabase Vault (supabase_vault 0.3.1) is confirmed enabled
DECISION:     in production, with service_role SELECT access to
              vault.decrypted_secrets. This is the production credential
              store. No AES-GCM application-level fallback is built.

Vault FK:     vault_secret_id is a plain uuid with NO foreign key to
              vault.secrets. This is deliberate: Supabase's own guidance
              treats vault.secrets as an internal extension table not
              meant to be referenced by a formal FK from application
              schema — doing so would couple this migration to the
              extension's internal structure (which Supabase can evolve
              independently of this project) and would require this
              migrating role to hold REFERENCES privilege on the vault
              schema, which is not part of the standard Vault access
              contract. The relationship is enforced at the application
              layer (the Edge Function that creates the Vault secret is
              the same call that writes this row, inside one request) —
              exactly the "UUID reference without a direct FK" pattern
              the approved architecture explicitly allows when a formal
              FK is the less-safe Supabase pattern.

Owner shape:  Mirrors digital_assets_single_relation — exactly ONE of
              connection_id / resource_id is set per row (a connection
              needs its long-lived user token; each linked resource
              needs its own page token). Never both, never neither.

Depends on:   01-integration-connections.sql, 02-integration-resources.sql.
Execution:    Paste after 02-integration-resources.sql. Idempotent.
==============================================================
*/

-- ── 1. ENUM ───────────────────────────────────────────────────────────────────
-- Phase 1 needs exactly the two token shapes the approved Meta flow
-- produces: the long-lived user token (used to re-derive/refresh page
-- tokens and to run discovery) and the page access token (used for
-- per-resource metric reads). No refresh_token type — Facebook Login for
-- Business's long-lived user token is not refreshed via a refresh_token
-- grant; it is periodically re-derived via the same OAuth flow. Adding a
-- type Phase 1 does not use would be speculative schema, against the
-- audit's own "do not invent columns/values until proven necessary" rule.
do $$ begin
  create type integration_token_type as enum ('user_long_lived','page');
exception when duplicate_object then null; end $$;

-- ── 2. TABLE ──────────────────────────────────────────────────────────────────
create table if not exists integration_credentials (
  id             uuid                     primary key default uuid_generate_v4(),
  agency_id      uuid                     not null references agencies(id) on delete cascade,
  client_id      uuid                     not null references clients(id)  on delete cascade,

  connection_id  uuid                     references integration_connections(id) on delete cascade,
  resource_id    uuid                     references integration_resources(id)   on delete cascade,

  -- Points at a vault.secrets row — see the header comment for why this
  -- is intentionally not a formal foreign key.
  vault_secret_id uuid                    not null,
  token_type      integration_token_type  not null,
  -- NULL = does not expire (a page token derived from a long-lived user
  -- token, per the confirmed current Meta behavior — see the approved
  -- architecture report). Set only for token shapes that genuinely carry
  -- a known expiry (the 60-day long-lived user token).
  expires_at      timestamptz,

  created_at      timestamptz             not null default now(),
  updated_at      timestamptz             not null default now(),

  -- Exactly one owner — never both, never neither. Same pattern as
  -- digital_assets_single_relation (04-digital-assets.sql, Wave 1).
  constraint integration_credentials_single_owner check (
    (connection_id is not null and resource_id is null) or
    (connection_id is null and resource_id is not null)
  )
);

-- Reconnect/re-derive must UPDATE the existing credential row for a given
-- owner + token_type, never insert a second one — same idempotency
-- posture as every external-id partial unique index elsewhere in Digital.
create unique index if not exists integration_credentials_connection_token_unique_idx
  on integration_credentials(connection_id, token_type)
  where connection_id is not null;

create unique index if not exists integration_credentials_resource_token_unique_idx
  on integration_credentials(resource_id, token_type)
  where resource_id is not null;

drop trigger if exists integration_credentials_set_updated_at on integration_credentials;
create trigger integration_credentials_set_updated_at
  before update on integration_credentials
  for each row execute function set_updated_at();

-- ── 3. TENANT-MATCH TRIGGER ────────────────────────────────────────────────────
-- Same gap every website_id/connection_id reference closes elsewhere: a
-- plain FK only proves the owning connection/resource exists, not that it
-- belongs to the same tenant this row claims.
create or replace function public.check_integration_credential_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _conn     integration_connections;
  _resource integration_resources;
begin
  if new.connection_id is not null then
    select * into _conn from integration_connections where id = new.connection_id;
    if not found then
      raise exception 'integration_connection_not_found: Referenced connection does not exist';
    end if;
    if _conn.agency_id <> new.agency_id or _conn.client_id <> new.client_id then
      raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different agency/client';
    end if;
  end if;

  if new.resource_id is not null then
    select * into _resource from integration_resources where id = new.resource_id;
    if not found then
      raise exception 'integration_resource_not_found: Referenced resource does not exist';
    end if;
    if _resource.agency_id <> new.agency_id or _resource.client_id <> new.client_id then
      raise exception 'integration_resource_tenant_mismatch: Referenced resource belongs to a different agency/client';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists integration_credentials_check_tenant_match_trg on integration_credentials;
create trigger integration_credentials_check_tenant_match_trg
  before insert or update on integration_credentials
  for each row execute function check_integration_credential_tenant_match();

-- ── 4. RLS — DEFAULT DENY FOR THE BROWSER, NO EXCEPTIONS ──────────────────────
-- This is the most sensitive table in the integration layer. RLS is
-- enabled with ZERO policies for `authenticated`/`anon` — not a
-- restrictive-looking policy, no policy at all, which is default-deny in
-- Postgres. No `grant` statement is issued to `authenticated` or `anon`
-- either, so even a future accidental policy addition would still need an
-- explicit grant to matter. service_role is not granted here for the same
-- reason none of Eliora's other tables grant it explicitly: Supabase
-- configures service_role with RLS bypass and full schema privileges at
-- the platform level, not per-migration — the existing ai-project/
-- send-email Edge Functions already rely on exactly this.
--
-- No SECURITY DEFINER RPC is created against this table in this slice —
-- one is not needed yet (schema only), and none should ever be created
-- that returns vault_secret_id or any decrypted value to an authenticated
-- browser session.
alter table integration_credentials enable row level security;

-- ── 5. VERIFICATION (informational) ──────────────────────────────────────────
-- select count(*) from integration_credentials;
-- select conname from pg_constraint where conname = 'integration_credentials_single_owner';
-- select policyname from pg_policies where tablename = 'integration_credentials'; -- expected: 0 rows
-- select has_table_privilege('authenticated', 'integration_credentials', 'SELECT'); -- expected: false
