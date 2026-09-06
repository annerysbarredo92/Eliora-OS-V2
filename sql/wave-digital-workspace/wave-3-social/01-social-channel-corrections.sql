/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 3: SOCIAL CHANNEL CORRECTIONS
==============================================================
Purpose: Two narrowly-scoped, additive corrections to the deployed Wave 1
         social_channels schema, discovered while implementing Wave 3's
         hard requirement that a client can have multiple accounts on the
         same platform (e.g. Main Brand / Miami / Founder Instagram).

Correction 1 — handle uniqueness incorrectly blocks multiple no-handle
accounts on the SAME platform:
  The deployed index social_channels_client_handle_idx keys on
  lower(coalesce(handle, '')). Postgres unique indexes treat NULL as
  distinct across rows, but coalescing NULL to '' turns every "no handle"
  row into the SAME indexed value (''), so a client's SECOND channel on a
  platform that legitimately has no handle — a LinkedIn company page, a
  Facebook Page, a YouTube channel entered by name only (handle is not
  universal — see the Wave 3 spec's handle/profile-URL note) — would be
  rejected as a duplicate of the first, even though they are two entirely
  different accounts. This directly breaks the Wave 3 hard requirement.

  Fixed with a partial index that only applies when a handle actually
  exists: any number of no-handle channels can now coexist per
  client+platform, while two channels with the exact same handle on the
  same platform are still caught as a likely duplicate entry.

Correction 2 — no idempotency for a known external account:
  Nothing currently prevents the SAME external_account_id (once a real
  integration exists and starts populating it) from being represented
  twice for the same client+platform. A partial unique index closes this
  without requiring external_account_id on manual records, which must
  stay optional — the index only ever applies once a real ID is present.

Neither correction touches RLS, the tenant-match trigger
(check_social_channel_tenant_match), or any other Wave 1/2 object. Does
NOT rewrite the historical 02-social.sql file — applied as new, additive
SQL, per the "do not rewrite Wave 1 SQL" rule.

Depends on:   Wave 1 (social_channels).
Execution:    Run once, after Wave 1 and Wave 2. Idempotent — DROP INDEX
              IF EXISTS / CREATE INDEX IF NOT EXISTS throughout, safe to
              re-run.
==============================================================
*/

-- ── 1. FIX: allow multiple no-handle channels per client+platform ───────────
drop index if exists social_channels_client_handle_idx;

create unique index if not exists social_channels_client_handle_idx
  on social_channels(client_id, platform, lower(handle))
  where handle is not null;

-- ── 2. ADD: idempotency for a known external account ────────────────────────
-- Manual records (external_account_id IS NULL) are completely unaffected —
-- this only ever fires once a real external_account_id is populated by a
-- future integration.
create unique index if not exists social_channels_external_id_unique_idx
  on social_channels(client_id, platform, external_account_id)
  where external_account_id is not null;

-- ── 3. VERIFICATION (informational) ──────────────────────────────────────────
-- select indexname, indexdef from pg_indexes where tablename = 'social_channels'
--   and indexname in ('social_channels_client_handle_idx','social_channels_external_id_unique_idx')
--  order by indexname;
--   → expected: 2 rows;
--     social_channels_client_handle_idx's indexdef contains "WHERE (handle IS NOT NULL)"
--     social_channels_external_id_unique_idx's indexdef contains "WHERE (external_account_id IS NOT NULL)"
