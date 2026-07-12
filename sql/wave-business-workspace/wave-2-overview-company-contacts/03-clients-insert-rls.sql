-- Wave 2: Fix clients INSERT RLS gap
-- The existing clients_insert policy has no USING/WITH CHECK expression,
-- allowing any authenticated user to insert a client with any agency_id.
-- Replace it with a proper WITH CHECK that enforces agency scoping.

-- Drop the permissive no-check policy.
DROP POLICY IF EXISTS clients_insert ON clients;

-- Re-create with agency scope + admin-only requirement (consistent with clients_update).
CREATE POLICY clients_insert ON clients
  FOR INSERT
  WITH CHECK (agency_id = current_agency_id() AND is_agency_admin());

COMMENT ON TABLE clients IS 'Agency client records. INSERT requires is_agency_admin() and correct agency_id.';
