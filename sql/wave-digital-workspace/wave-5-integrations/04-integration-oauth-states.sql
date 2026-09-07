/*
==============================================================
ELIORA OS.M — DIGITAL INTEGRATIONS WAVE 5: OAUTH STATE
==============================================================
Purpose:      Short-lived, one-time-use OAuth CSRF state. The Edge
              Function that starts a provider OAuth flow (not part of
              this slice) creates one row here BEFORE redirecting the
              browser to the provider, and passes this row's id as the
              `state` query parameter. The callback Edge Function must
              consume it atomically — see the consumption pattern below
              — before it exchanges any authorization code.

Opaque/       The row's own `id` (a cryptographically random uuid_
high-entropy: generate_v4(), same generator used by every PK in this
              schema) IS the state value passed to the provider — no
              separate token column. A uuid v4 is unguessable and needs
              no additional signing to serve as a CSRF token.

One-time use: Enforced by the callback consuming this row with an atomic
              `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now()
              RETURNING *` (see the comment in section 3) — not by an
              authenticated-browser RPC. No RPC is created in this slice;
              whether the callback Edge Function performs this UPDATE
              directly via its service-role connection, or via a narrowly
              -scoped SECURITY DEFINER function, is an Edge Function
              -layer decision for the next slice, not a schema decision —
              either is equally safe given the RLS posture below, and
              inventing an RPC now, before the Edge Function that would
              call it exists, is exactly the unnecessary-surface-area the
              audit warned against.

Depends on:   Phase 01-02 (agencies, clients, profiles).
Execution:    Paste after 03-integration-credentials.sql. Idempotent.
==============================================================
*/

-- ── 1. TABLE ──────────────────────────────────────────────────────────────────
create table if not exists integration_oauth_states (
  id                uuid                 primary key default uuid_generate_v4(),
  agency_id         uuid                 not null references agencies(id) on delete cascade,
  client_id         uuid                 not null references clients(id)  on delete cascade,
  -- The authenticated Eliora user who initiated this connection — set
  -- directly from the verified caller's session by the starting Edge
  -- Function, never trusted from client input at consume time.
  actor_id          uuid                 not null references profiles(id) on delete cascade,

  provider          integration_provider not null,
  -- Safe UI-routing hints only (e.g. which Digital section/client to
  -- return the browser to). NEVER an authorization code, token, or any
  -- provider secret — enforced by convention, same as every other
  -- "no secret storage" jsonb column in Digital.
  redirect_context  jsonb                not null default '{}',

  created_at        timestamptz          not null default now(),
  -- 10-minute TTL, per the approved architecture — long enough for a
  -- real human to complete the provider's consent screen, short enough
  -- to keep a leaked/logged state value worthless almost immediately.
  expires_at        timestamptz          not null default (now() + interval '10 minutes'),
  consumed_at       timestamptz
);

-- Supports the callback's cleanup/lookup path and keeps this small,
-- naturally self-pruning table cheap to query even before any scheduled
-- cleanup job exists (deferred — see the scheduled-sync slice).
create index if not exists integration_oauth_states_expiry_idx
  on integration_oauth_states(expires_at)
  where consumed_at is null;

-- ── 2. RLS — DEFAULT DENY FOR THE BROWSER, NO EXCEPTIONS ──────────────────────
-- Same posture as integration_credentials: RLS enabled, zero policies,
-- zero grants to authenticated/anon. The browser never reads or writes
-- this table directly — it only ever receives the opaque `state` value
-- embedded in the authorization URL the starting Edge Function returns.
alter table integration_oauth_states enable row level security;

-- ── 3. ATOMIC ONE-TIME CONSUMPTION (reference pattern — not yet called) ───────
-- The callback Edge Function (next slice) performs, via its service-role
-- connection, the equivalent of:
--
--   update integration_oauth_states
--      set consumed_at = now()
--    where id = $1
--      and consumed_at is null
--      and expires_at > now()
--    returning agency_id, client_id, actor_id, provider, redirect_context;
--
-- A second use of the same state (consumed_at already set) or an expired
-- state (expires_at already passed) returns zero rows — the callback
-- treats that as `invalid_state` (see the approved error model) and
-- refuses to proceed. This UPDATE...RETURNING is atomic under Postgres's
-- MVCC row locking: two concurrent attempts to consume the same state
-- cannot both succeed.

-- ── 4. VERIFICATION (informational) ──────────────────────────────────────────
-- select count(*) from integration_oauth_states;
-- select policyname from pg_policies where tablename = 'integration_oauth_states'; -- expected: 0 rows
-- select has_table_privilege('authenticated', 'integration_oauth_states', 'SELECT'); -- expected: false
