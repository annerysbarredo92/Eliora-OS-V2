/*
==============================================================
ELIORA OS — WAVE 4 RETAINER RPCs
==============================================================
Purpose:  Atomic DB-level operations for retainer lifecycle.
          Client-side cannot guarantee atomicity for multi-step
          retainer operations (renewal, end). These RPCs run
          both steps in a single transaction.

Depends:  01-retainers.sql must be applied first.
Idempotent: yes — uses CREATE OR REPLACE.
==============================================================
*/

-- ── renew_retainer ────────────────────────────────────────────────────────────
-- Atomically:
--   1. Sets the old retainer status to 'ended' (ended_at = now).
--   2. Creates a new retainer copying the old one's terms,
--      overriding amount/frequency/dates with caller-supplied values.
--   3. Links the new retainer to the old via previous_retainer_id.
--   4. Returns the newly created retainer row.
--
-- Only active, paused, or ending retainers may be renewed.
-- The new retainer starts as 'active' by default.
-- included_services, linked documents, notes, and is_auto_renew are copied.
-- Call from the browser via: supabase.rpc('renew_retainer', { ... })
create or replace function renew_retainer(
  p_old_id              uuid,
  p_new_amount_cents    integer,
  p_new_frequency       retainer_frequency,
  p_new_start_date      date,
  p_new_end_date        date,
  p_new_next_billing    date,
  p_notes               text,
  p_actor_id            uuid
) returns retainers
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  _old retainers;
  _new retainers;
begin
  -- Lock + verify: caller belongs to the agency, and no concurrent renewal can proceed
  -- until this transaction commits. The retainers_renewal_unique_idx prevents a second
  -- successor even if two transactions somehow both pass the status check.
  select * into _old
    from retainers
   where id = p_old_id
     and agency_id = public.current_agency_id()
  for update;

  if not found then
    raise exception 'retainer not found or access denied';
  end if;

  if _old.status not in ('active', 'paused', 'ending') then
    raise exception 'only active, paused, or ending retainers can be renewed; status is %', _old.status;
  end if;

  if p_new_amount_cents < 0 then
    raise exception 'amount_cents must be >= 0';
  end if;

  -- 1. End the old retainer (preserve all terms — only status/ended_at change).
  update retainers
     set status     = 'ended',
         ended_at   = now(),
         updated_by = p_actor_id,
         updated_at = now()
   where id = p_old_id;

  -- 2. Create the renewed retainer.
  insert into retainers (
    agency_id,
    client_id,
    title,
    description,
    status,
    frequency,
    amount_cents,
    start_date,
    end_date,
    next_billing_date,
    is_auto_renew,
    included_services,
    invoice_config,
    linked_proposal_id,
    linked_contract_id,
    previous_retainer_id,
    notes,
    created_by,
    updated_by
  )
  select
    _old.agency_id,
    _old.client_id,
    _old.title,
    _old.description,
    'active'::retainer_status,
    p_new_frequency,
    p_new_amount_cents,
    p_new_start_date,
    p_new_end_date,
    p_new_next_billing,
    _old.is_auto_renew,
    _old.included_services,
    _old.invoice_config,
    _old.linked_proposal_id,
    _old.linked_contract_id,
    p_old_id,                            -- renewal chain link
    coalesce(p_notes, _old.notes),
    p_actor_id,
    p_actor_id
  returning * into _new;

  return _new;
end;
$$;

-- Grant execute to authenticated users (RLS inside still applies).
grant execute on function renew_retainer(uuid, integer, retainer_frequency, date, date, date, text, uuid) to authenticated;
