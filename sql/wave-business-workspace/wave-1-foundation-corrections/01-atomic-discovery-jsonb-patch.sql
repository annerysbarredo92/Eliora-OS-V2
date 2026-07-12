-- Wave 1 Foundation Corrections
-- Issue: browser-side { ...current, ...patch } merge is stale at write time.
-- Fix: atomic JSONB patch via PostgreSQL || operator inside an RPC.
--
-- The || operator does a shallow merge of top-level JSONB keys.
-- All callers send complete top-level domain objects, so this is safe.

CREATE OR REPLACE FUNCTION patch_client_discovery_data(
  p_client_id uuid,
  p_patch      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- runs as the authenticated user; RLS on clients enforces agency ownership
AS $$
BEGIN
  UPDATE clients
  SET
    discovery_data = COALESCE(discovery_data, '{}'::jsonb) || p_patch,
    updated_at     = now()
  WHERE id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found or access denied: %', p_client_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION patch_client_discovery_data(uuid, jsonb) IS
  'Atomically merges p_patch into clients.discovery_data using JSONB || operator. '
  'SECURITY INVOKER ensures RLS on the clients table is enforced.';
