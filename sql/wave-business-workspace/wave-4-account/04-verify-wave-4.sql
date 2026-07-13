/*
==============================================================
ELIORA OS — WAVE 4 VERIFICATION
==============================================================
Run after applying ALL Wave 4 SQL files in order:
  01-retainers.sql
  02-retainer-rpcs.sql
  03-safe-record-payment.sql
All queries should return the expected results.
==============================================================
*/

-- ── Table exists ──────────────────────────────────────────────────────────────
select count(*) as retainer_count from retainers;
-- expected: 0 (or however many you've created)

-- ── Enum values: retainer_status ──────────────────────────────────────────────
select enumlabel
  from pg_enum
 where enumtypid = 'retainer_status'::regtype
 order by enumsortorder;
-- expected (in order): draft, active, paused, ending, ended

-- ── Enum values: retainer_frequency ──────────────────────────────────────────
select enumlabel
  from pg_enum
 where enumtypid = 'retainer_frequency'::regtype
 order by enumsortorder;
-- expected: weekly, biweekly, monthly, quarterly, annually, custom

-- ── RLS enabled ───────────────────────────────────────────────────────────────
select relrowsecurity
  from pg_class
 where relname = 'retainers';
-- expected: true

-- ── RLS policies ─────────────────────────────────────────────────────────────
select policyname, cmd, qual, with_check
  from pg_policies
 where tablename = 'retainers'
 order by cmd, policyname;
-- expected 4 rows:
--   retainers_delete  | DELETE  | (agency_id = current_agency_id() and is_agency_admin() and status = 'draft')
--   retainers_insert  | INSERT  | (agency_id = current_agency_id() and is_agency_admin())
--   retainers_select  | SELECT  | (agency_id = current_agency_id())
--   retainers_update  | UPDATE  | (agency_id = current_agency_id() and is_agency_admin())

-- ── Columns ───────────────────────────────────────────────────────────────────
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_name = 'retainers'
   and table_schema = 'public'
 order by ordinal_position;
-- expected columns include: id, agency_id, client_id, title, description, status,
--   frequency, amount_cents, start_date, end_date, next_billing_date, is_auto_renew,
--   paused_at, ended_at, included_services, invoice_config,
--   linked_proposal_id, linked_contract_id, previous_retainer_id,
--   notes, created_by, updated_by, created_at, updated_at

-- ── Indexes ───────────────────────────────────────────────────────────────────
select indexname
  from pg_indexes
 where tablename = 'retainers';
-- expected: retainers_pkey, retainers_client_idx, retainers_agency_idx,
--           retainers_renewal_idx, retainers_renewal_unique_idx

-- ── RPC exists ────────────────────────────────────────────────────────────────
select proname, pronargs
  from pg_proc
 where proname = 'renew_retainer';
-- expected: 1 row, pronargs = 8

-- ── Updated_at trigger ────────────────────────────────────────────────────────
select tgname
  from pg_trigger
 where tgrelid = 'retainers'::regclass;
-- expected: retainers_set_updated_at

-- ── Safe payment RPC ─────────────────────────────────────────────────────────
select routine_name
  from information_schema.routines
 where routine_name = 'record_invoice_payment_safe'
   and routine_type = 'FUNCTION';
-- expected: 1 row

-- ── idempotency_key column on payments ────────────────────────────────────────
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_name = 'payments'
   and column_name = 'idempotency_key'
   and table_schema = 'public';
-- expected: 1 row, data_type = 'text', is_nullable = 'YES'

-- ── idempotency index ─────────────────────────────────────────────────────────
select indexname, indexdef
  from pg_indexes
 where tablename = 'payments'
   and indexname = 'payments_idempotency_idx';
-- expected: 1 row with UNIQUE partial index WHERE idempotency_key IS NOT NULL

-- ── Smoke test: insert and delete a draft ────────────────────────────────────
-- (Only run in a test/dev environment with an authenticated admin session)
-- INSERT INTO retainers (agency_id, client_id, title, status)
--   VALUES ('<your_agency_id>', '<your_client_id>', 'Test Retainer', 'draft');
-- DELETE FROM retainers WHERE title = 'Test Retainer' AND status = 'draft';
-- Expected: both succeed.
--
-- INSERT INTO retainers (agency_id, client_id, title, status)
--   VALUES ('<your_agency_id>', '<your_client_id>', 'Active Test', 'active');
-- DELETE FROM retainers WHERE title = 'Active Test';
-- Expected: DELETE returns 0 rows (blocked by RLS delete policy requiring status = 'draft').
