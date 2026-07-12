-- Wave 2: Primary contact integrity
-- Enforces exactly one primary contact per client at the database level.
-- Uses a UNIQUE partial index + an atomic RPC for safe reassignment.

-- ── Unique partial index ─────────────────────────────────────────────────────
-- Existing index client_contacts_primary_idx is NOT unique.
-- Add a uniqueness constraint so the DB rejects concurrent double-primary states.

-- Note: CREATE UNIQUE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run this file outside of BEGIN/COMMIT if your migration runner wraps in a transaction.

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_one_primary
  ON client_contacts(client_id)
  WHERE is_primary = true;

-- ── Atomic primary-contact reassignment RPC ──────────────────────────────────
-- Atomically removes primary from any current primary, then sets the target.
-- Runs as SECURITY INVOKER so RLS on client_contacts enforces agency isolation.

CREATE OR REPLACE FUNCTION set_primary_contact(
  p_client_id  uuid,
  p_contact_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Verify the contact belongs to the requested client (RLS-visible to caller).
  IF NOT EXISTS (
    SELECT 1 FROM client_contacts
    WHERE id = p_contact_id AND client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'contact % does not belong to client %', p_contact_id, p_client_id;
  END IF;

  -- Step 1: clear any existing primary for this client.
  UPDATE client_contacts
  SET is_primary = false
  WHERE client_id = p_client_id AND is_primary = true AND id <> p_contact_id;

  -- Step 2: mark the target contact as primary.
  UPDATE client_contacts
  SET is_primary = true
  WHERE id = p_contact_id AND client_id = p_client_id;
END;
$$;

COMMENT ON FUNCTION set_primary_contact(uuid, uuid) IS
  'Atomically reassigns the primary contact for a client. '
  'Runs as SECURITY INVOKER; RLS on client_contacts enforces agency ownership.';
