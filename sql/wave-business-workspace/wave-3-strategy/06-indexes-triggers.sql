-- Wave 3 Strategy — Phase 06: Indexes & updated_at Triggers
-- All CREATE INDEX CONCURRENTLY ... IF NOT EXISTS — safe to re-run.
-- CONCURRENTLY won't work inside a transaction; run these outside BEGIN/COMMIT.

-- ── client_products_services ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cps_agency_client
  ON client_products_services (agency_id, client_id);

CREATE INDEX IF NOT EXISTS idx_cps_client_status
  ON client_products_services (client_id, status);

CREATE INDEX IF NOT EXISTS idx_cps_client_type
  ON client_products_services (client_id, type);

-- ── client_competitors ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cc_agency_client
  ON client_competitors (agency_id, client_id);

CREATE INDEX IF NOT EXISTS idx_cc_client_created
  ON client_competitors (client_id, created_at DESC);

-- ── client_discovery_notes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cdn_agency_client
  ON client_discovery_notes (agency_id, client_id);

CREATE INDEX IF NOT EXISTS idx_cdn_client_created
  ON client_discovery_notes (client_id, created_at DESC);

-- ── goals (new columns) ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goals_client_archived
  ON goals (client_id, is_archived);

-- ── kpis (new columns) ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kpis_client_archived
  ON kpis (client_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_kpis_goal
  ON kpis (goal_id)
  WHERE goal_id IS NOT NULL;

-- ── updated_at triggers ───────────────────────────────────────────────────────
-- Reuse the moddatetime() or a custom trigger function if it exists.
-- Using a generic inline trigger function (compatible with Supabase free tier).

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- client_products_services
DROP TRIGGER IF EXISTS trg_cps_updated_at ON client_products_services;
CREATE TRIGGER trg_cps_updated_at
  BEFORE UPDATE ON client_products_services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- client_competitors
DROP TRIGGER IF EXISTS trg_cc_updated_at ON client_competitors;
CREATE TRIGGER trg_cc_updated_at
  BEFORE UPDATE ON client_competitors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- client_discovery_notes
DROP TRIGGER IF EXISTS trg_cdn_updated_at ON client_discovery_notes;
CREATE TRIGGER trg_cdn_updated_at
  BEFORE UPDATE ON client_discovery_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
