/*
==============================================================
ELIORA OS — WAVE 4: SAFE RECORD PAYMENT
==============================================================
Purpose:  Database-safe payment recording RPC.

Why:      Direct browser INSERT into payments is unsafe:
          - agency_id / client_id trusted from browser
          - no row lock → concurrent payments can exceed balance
          - no idempotency → network retry creates duplicate payment

This file:
  1. Adds idempotency_key column to payments (nullable for history)
  2. Unique index: one idempotency_key per agency
  3. record_invoice_payment_safe RPC — all validation server-side

Concurrency proof:
  Invoice: total=10000, amount_paid=8000, outstanding=2000
  Attempt A (1500 cents) and Attempt B (1500 cents) arrive simultaneously.
  Both pass idempotency check (different keys).
  Both reach SELECT FOR UPDATE on the same invoice row.
  PostgreSQL serializes: A acquires lock, B waits.
  A: outstanding = 10000 - 8000 = 2000 → 1500 ≤ 2000 ✓ → inserts, trigger recomputes
  A releases lock. Invoice now: amount_paid=9500.
  B: acquires lock, re-reads invoice → outstanding = 10000 - 9500 = 500.
  B: 1500 > 500 → raises overpayment. Transaction rolled back.
  Result: only A committed. Invoice at $95/$100. ✓

Depends:  wave-03/phase.sql (invoices, payments, payment_method enum,
          payments_recompute trigger).
Idempotent: yes — uses ADD COLUMN IF NOT EXISTS and CREATE OR REPLACE.
==============================================================
*/

-- ── 1. ADD IDEMPOTENCY KEY TO PAYMENTS ───────────────────────────────────────
-- Nullable so historical payments remain valid without a key.
-- Frontend generates crypto.randomUUID() per submit attempt;
-- retries use the same key (idempotent), new payments use a new key.
alter table payments
  add column if not exists idempotency_key text;

-- Unique per agency: one payment per idempotency_key within an agency's scope.
-- Partial index (WHERE NOT NULL) preserves null for historical payments.
create unique index if not exists payments_idempotency_idx
  on payments(agency_id, idempotency_key)
  where idempotency_key is not null;

-- ── 2. SAFE PAYMENT RPC ───────────────────────────────────────────────────────
create or replace function record_invoice_payment_safe(
  p_invoice_id      uuid,
  p_amount_cents    integer,
  p_method          payment_method,
  p_note            text,
  p_idempotency_key text,
  p_actor_id        uuid
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  _inv         invoices;
  _outstanding integer;
  _existing    payments;
  _new_pay     payments;
begin
  -- 1. Idempotency check BEFORE acquiring a lock.
  --    If a payment with this key was already recorded for this agency, return it.
  if p_idempotency_key is not null then
    select * into _existing
      from payments
     where idempotency_key = p_idempotency_key
       and agency_id       = public.current_agency_id();
    if found then
      select * into _inv from invoices where id = _existing.invoice_id;
      return jsonb_build_object(
        'payment',    row_to_json(_existing),
        'invoice',    row_to_json(_inv),
        'idempotent', true
      );
    end if;
  end if;

  -- 2. Lock the invoice row for the duration of this transaction.
  --    Any concurrent payment attempt on the same invoice blocks here
  --    and will re-read the updated outstanding balance after we commit.
  select * into _inv
    from invoices
   where id        = p_invoice_id
     and agency_id = public.current_agency_id()
  for update;

  if not found then
    raise exception 'invoice_not_found: Invoice not found or access denied';
  end if;

  -- 3. Invoice status guards.
  if _inv.status = 'void' or _inv.status = 'archived' then
    raise exception 'invoice_void_or_archived: Cannot record payment against a % invoice', _inv.status;
  end if;
  if _inv.status = 'draft' then
    raise exception 'invoice_draft: Invoice must be sent before recording a payment';
  end if;
  if _inv.status = 'paid' then
    raise exception 'invoice_already_paid: This invoice is already fully paid';
  end if;

  -- 4. Amount guard.
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount_invalid: Amount must be greater than zero';
  end if;

  -- 5. Overpayment guard — using DB-current values, never browser-provided.
  _outstanding := _inv.total_cents - _inv.amount_paid_cents;
  if p_amount_cents > _outstanding then
    raise exception 'overpayment: % cents requested, % cents outstanding',
      p_amount_cents, _outstanding;
  end if;

  -- 6. Insert payment.
  --    agency_id and client_id are derived from the locked invoice row —
  --    the browser cannot misattribute a payment to another client.
  insert into payments (
    agency_id,
    client_id,
    invoice_id,
    amount_cents,
    method,
    note,
    recorded_by,
    recorded_at,
    idempotency_key
  ) values (
    _inv.agency_id,
    _inv.client_id,
    _inv.id,
    p_amount_cents,
    p_method,
    p_note,
    p_actor_id,
    now(),
    p_idempotency_key
  ) returning * into _new_pay;

  -- 7. The payments_recompute trigger has already fired (AFTER INSERT) and updated
  --    invoices.amount_paid_cents and invoices.status in this same transaction.
  --    Re-fetch the updated invoice to return the new state to the caller.
  select * into _inv from invoices where id = p_invoice_id;

  return jsonb_build_object(
    'payment',    row_to_json(_new_pay),
    'invoice',    row_to_json(_inv),
    'idempotent', false
  );
end;
$$;

-- Grant execute to authenticated users (RLS inside still applies via current_agency_id()).
grant execute on function record_invoice_payment_safe(uuid, integer, payment_method, text, text, uuid)
  to authenticated;

-- ── 3. VERIFICATION (informational) ──────────────────────────────────────────
-- After applying, run:
-- select column_name, data_type from information_schema.columns
--   where table_name = 'payments' and column_name = 'idempotency_key';
-- select indexname, indexdef from pg_indexes
--   where tablename = 'payments' and indexname like '%idempotency%';
-- select routine_name from information_schema.routines
--   where routine_name = 'record_invoice_payment_safe' and routine_type = 'FUNCTION';
