/*
==============================================================
ELIORA OS.M — DIGITAL INTEGRATIONS WAVE 5: VERIFICATION
==============================================================
READ-ONLY. No inserts, updates, deletes, or DDL. Every statement below
is a plain SELECT you can run in the Supabase SQL Editor after applying
01-05, in order, to confirm the migration landed exactly as designed.
No secret values are read or displayed anywhere in this file — Vault
secret contents are never queried here.
==============================================================
*/

-- ── 1. TABLES EXIST ────────────────────────────────────────────────────────────
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in (
     'integration_connections','integration_resources',
     'integration_credentials','integration_oauth_states','integration_sync_runs'
   )
 order by table_name;
-- expected: exactly 5 rows

-- ── 2. ENUMS/TYPES EXIST ──────────────────────────────────────────────────────
select typname
  from pg_type
 where typname in (
     'integration_provider','integration_connection_status',
     'integration_resource_type','integration_link_status',
     'integration_token_type','integration_run_type','integration_run_status'
   )
 order by typname;
-- expected: exactly 7 rows

select unnest(enum_range(null::integration_provider))::text as provider;
-- expected: meta, google, linkedin, tiktok, pinterest, x (6 rows)

-- ── 3. EXPECTED COLUMNS (spot check the load-bearing ones) ────────────────────
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and (
     (table_name = 'integration_connections' and column_name in ('agency_id','client_id','provider','provider_account_id','status'))
     or (table_name = 'integration_resources' and column_name in ('connection_id','external_resource_id','linked_channel_id','link_status'))
     or (table_name = 'integration_credentials' and column_name in ('connection_id','resource_id','vault_secret_id','token_type','expires_at'))
     or (table_name = 'integration_oauth_states' and column_name in ('actor_id','provider','expires_at','consumed_at'))
     or (table_name = 'integration_sync_runs' and column_name in ('connection_id','resource_id','run_type','status'))
   )
 order by table_name, column_name;

-- ── 4. CONSTRAINTS ────────────────────────────────────────────────────────────
select conname, conrelid::regclass::text as table_name
  from pg_constraint
 where conname in (
     'integration_credentials_single_owner',
     'integration_resources_link_status_consistency'
   )
 order by conname;
-- expected: 2 rows (integration_credentials, integration_resources)

select indexname, tablename
  from pg_indexes
 where indexname in (
     'integration_connections_provider_account_unique_idx',
     'integration_resources_connection_resource_unique_idx',
     'integration_credentials_connection_token_unique_idx',
     'integration_credentials_resource_token_unique_idx'
   )
 order by indexname;
-- expected: exactly 4 rows

-- ── 5. INDEXES (non-unique, supporting reads) ──────────────────────────────────
select indexname, tablename
  from pg_indexes
 where tablename in (
     'integration_connections','integration_resources','integration_credentials',
     'integration_oauth_states','integration_sync_runs'
   )
 order by tablename, indexname;

-- ── 6. RLS ENABLED ON ALL 5 ────────────────────────────────────────────────────
select relname, relrowsecurity, relforcerowsecurity
  from pg_class
 where relname in (
     'integration_connections','integration_resources','integration_credentials',
     'integration_oauth_states','integration_sync_runs'
   )
 order by relname;
-- expected: relrowsecurity = true for all 5 rows

-- ── 7. BROWSER-FACING POLICIES — PRESENT on the 3 safe tables, ABSENT on the 2 sensitive ──
select tablename, policyname, cmd
  from pg_policies
 where tablename in (
     'integration_connections','integration_resources','integration_credentials',
     'integration_oauth_states','integration_sync_runs'
   )
 order by tablename, cmd;
-- expected: 4 rows each for integration_connections / integration_resources /
--           integration_sync_runs (select/insert/update/delete); ZERO rows
--           for integration_credentials and integration_oauth_states

-- ── 8. NO GRANTS TO authenticated/anon ON THE 2 SENSITIVE TABLES ─────────────────
select table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('integration_credentials','integration_oauth_states')
   and grantee in ('authenticated','anon');
-- expected: 0 rows

select has_table_privilege('authenticated', 'public.integration_credentials', 'SELECT') as can_select_credentials,
       has_table_privilege('authenticated', 'public.integration_oauth_states', 'SELECT') as can_select_oauth_states;
-- expected: both false

-- ── 9. TENANT-MATCH TRIGGERS ───────────────────────────────────────────────────
select tgname, tgrelid::regclass::text as table_name
  from pg_trigger
 where tgname in (
     'integration_resources_check_tenant_match_trg',
     'integration_credentials_check_tenant_match_trg',
     'integration_sync_runs_check_tenant_match_trg'
   )
 order by tgname;
-- expected: exactly 3 rows

-- updated_at triggers
select tgname, tgrelid::regclass::text as table_name
  from pg_trigger
 where tgname in (
     'integration_connections_set_updated_at',
     'integration_resources_set_updated_at',
     'integration_credentials_set_updated_at'
   )
 order by tgname;
-- expected: exactly 3 rows (integration_oauth_states and integration_sync_runs
--           intentionally have no updated_at column/trigger — see their files)

-- ── 10. VAULT EXTENSION STILL PRESENT (existence only — no secret values) ─────
select extname, extversion
  from pg_extension
 where extname = 'supabase_vault';
-- expected: 1 row, confirms this migration did not touch/require re-enabling it

-- ── 11. NO PLAINTEXT CREDENTIAL COLUMNS ANYWHERE IN THIS WAVE ─────────────────
-- vault_secret_id is deliberately NOT in this forbidden list — it is an
-- opaque uuid pointer into Supabase Vault, never the credential itself,
-- and its presence on integration_credentials is expected/required (see
-- that file's own header comment on why it carries no FK to vault.secrets).
-- This check looks for plaintext token/secret material that should never
-- exist anywhere in this wave, not for the safe reference column.
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name in (
     'integration_connections','integration_resources',
     'integration_credentials','integration_oauth_states','integration_sync_runs'
   )
   and column_name in (
     'access_token','refresh_token','client_secret','api_key','token','secret',
     'secret_value','plaintext_credential','credential_payload','password'
   );
-- expected: 0 rows

-- Positive check — confirms the intended safe Vault reference is actually
-- present (i.e. the check above isn't vacuously passing because the
-- credentials table itself is missing) and is the expected opaque type.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'integration_credentials'
   and column_name = 'vault_secret_id';
-- expected: 1 row — vault_secret_id, uuid, not nullable

/*
==============================================================
ROLLBACK (commented — DO NOT RUN unless deliberately reverting Wave 5)
==============================================================
No standalone rollback.sql file for this wave — the smaller, single-
purpose Digital additions (wave-2-website-domains-listings,
wave-3-social, and Business Workspace's wave-4-account) follow the same
convention of keeping rollback guidance as comments alongside the
migration rather than a dedicated file; a standalone rollback.sql in this
repo is reserved for the larger, multi-file foundational waves (Wave 1,
Business wave-1/2/3, email-messaging). This slice's 5 tables are exactly
that kind of small, additive, single-purpose unit.

Drops in REVERSE dependency order (05 → 01), then the trigger functions
this wave owns, then the enums this wave owns — same ordering discipline
as wave-1-foundation/rollback.sql (tables before the functions their
triggers depend on, or Postgres raises error 2BP01).

Reversible with zero impact on canonical product data: nothing in this
wave ever alters social_channels or social_channel_snapshots — the only
FK from this wave INTO those tables (integration_resources.
linked_channel_id) uses ON DELETE SET NULL, so this rollback cannot
delete or corrupt a single canonical channel or historical snapshot.

-- 1. Tables (reverse creation order)
-- drop table if exists integration_sync_runs;
-- drop table if exists integration_oauth_states;
-- drop table if exists integration_credentials;
-- drop table if exists integration_resources;
-- drop table if exists integration_connections;

-- 2. Trigger functions (only after every dependent table above is gone)
-- drop function if exists check_integration_sync_run_tenant_match();
-- drop function if exists check_integration_credential_tenant_match();
-- drop function if exists check_integration_resource_tenant_match();

-- 3. Enums (only after every column using them is gone)
-- drop type if exists integration_run_status;
-- drop type if exists integration_run_type;
-- drop type if exists integration_token_type;
-- drop type if exists integration_link_status;
-- drop type if exists integration_resource_type;
-- drop type if exists integration_connection_status;
-- drop type if exists integration_provider;

-- Verification after a rollback:
-- select table_name from information_schema.tables where table_name like 'integration_%'; → expected 0 rows
-- select typname from pg_type where typname like 'integration_%';                          → expected 0 rows
-- select count(*) from social_channels;            → expected unchanged from pre-rollback count
-- select count(*) from social_channel_snapshots;   → expected unchanged from pre-rollback count
*/
