/*
==============================================================
ELIORA OS.M -- DIGITAL INTEGRATIONS: GOOGLE PROVIDER EXTENSIONS (SLICE A)
==============================================================
Purpose:      Additive enum values only, required to let Google's OAuth
              credential model plug into the existing, unchanged
              integration_credentials table. Nothing here is a new
              table, a new RLS policy, or a Google-specific schema fork
              -- see the Google Phase 1 Slice A report for why this is
              sufficient.

Scope:        integration_token_type gains exactly two values:
              'google_access' and 'google_refresh'. This is the ONLY
              schema change Slice A needs -- integration_connections,
              integration_resources, integration_oauth_states,
              integration_sync_runs, and integration_credentials' own
              columns/constraints/RLS all already support Google
              unchanged (google is already a value of integration_
              provider, set in 01-integration-connections.sql).

Deliberately  ga4_property / search_console_site (integration_resource_
NOT included: type) belong to Slice B, when resource discovery is
              actually implemented. Adding them now would be pre-built,
              unused schema -- against this project's own "do not
              invent values until proven necessary" convention, already
              applied twice earlier in this same wave (see 01 and 02's
              own header comments).

Meta safety:  Purely additive to an existing enum -- every existing
              'user_long_lived'/'page' row, every existing constraint
              (integration_credentials_single_owner, the connection/
              resource-token partial unique indexes), and every existing
              RLS policy on integration_credentials (there are none --
              it is default-deny, unaffected either way) is completely
              unchanged. No existing row's token_type value changes
              meaning or shape.

Postgres      ALTER TYPE ... ADD VALUE cannot be used in the same
note:         transaction block as a statement that references the new
              value (Postgres restriction on enum value visibility
              within one transaction). This file only adds the two
              values and does not reference them in any executed
              statement (the verification queries at the bottom are
              comments, not live statements) -- safe to paste and run
              as one script, in one sitting, exactly as the other enum
              additions in this wave already do.

Depends on:   03-integration-credentials.sql (integration_token_type
              must already exist and be deployed -- confirmed deployed
              per the Wave 5 Slice 1 production report).
Execution:    NOT YET RUN. Prepared for manual review per this slice's
              explicit "do not execute SQL" instruction -- the user
              deploys this after review. Idempotent -- safe to re-run
              once applied (IF NOT EXISTS makes every statement below a
              no-op on a database where it already succeeded).
==============================================================
*/

-- -- 1. GOOGLE ACCESS TOKEN ------------------------------------------------------
-- Mirrors Meta's 'user_long_lived' role: the one credential every Google
-- connection always has, owned at the connection_id level (never
-- resource_id -- see the existing integration_credentials_single_owner
-- constraint, unchanged, and the Google Slice A report section 9/L for
-- why token ownership stays at connection level, matching Meta's
-- existing posture, not per-resource).
alter type integration_token_type add value if not exists 'google_access';

-- -- 2. GOOGLE REFRESH TOKEN ------------------------------------------------------
-- Present only when Google actually returns one on a given authorization
-- -- not guaranteed every time (see supabase/functions/_shared/
-- integrations/google.ts's header comment and the Slice A report section
-- I/11). A connection may legitimately have a 'google_access' row with
-- no corresponding 'google_refresh' row yet, or keep an existing
-- 'google_refresh' row unchanged across a reconnect that didn't return a
-- fresh one -- integration_credentials has no NOT NULL/1:1 requirement
-- forcing both token types to coexist for a given connection_id.
alter type integration_token_type add value if not exists 'google_refresh';

-- -- 3. VERIFICATION (informational -- not executed by this file) ----------------
-- select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
--   where t.typname = 'integration_token_type' order by e.enumsortorder;
--   -> expected: user_long_lived, page, google_access, google_refresh
-- select count(*) from integration_credentials where token_type in ('user_long_lived', 'page');
--   -> expected: unchanged from immediately before this file was applied
--   (this file inserts/updates zero rows -- it only widens the enum)
-- select has_table_privilege('authenticated', 'integration_credentials', 'SELECT');
--   -> expected: false (unchanged -- this file does not touch RLS/grants)
