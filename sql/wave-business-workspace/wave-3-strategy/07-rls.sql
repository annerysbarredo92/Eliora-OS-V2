-- Wave 3 Strategy — Phase 07: Row Level Security
-- Enables RLS on all three new tables and adds policies matching the existing pattern:
--   - agency admins/owners: full write access
--   - agency members: read access on agency-owned rows
--   - client users: read access on client_visible rows only (where column exists)

-- ══════════════════════════════════════════════════════════════════════════════
-- client_products_services
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE client_products_services ENABLE ROW LEVEL SECURITY;

-- Agency staff full access
CREATE POLICY "agency_staff_cps_all"
  ON client_products_services
  FOR ALL
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- client_competitors
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE client_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_staff_cc_all"
  ON client_competitors
  FOR ALL
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- client_discovery_notes
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE client_discovery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_staff_cdn_all"
  ON client_discovery_notes
  FOR ALL
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );
