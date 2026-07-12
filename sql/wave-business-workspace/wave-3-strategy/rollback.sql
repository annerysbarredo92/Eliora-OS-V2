-- Wave 3 Strategy — Rollback
-- DANGER: This permanently destroys Wave 3 data. Run only if Wave 3 must be reverted.
-- Requires confirmation: comment out the guard line before executing.

-- SAFETY GUARD — remove this line to allow rollback:
DO $$ BEGIN RAISE EXCEPTION 'Rollback guard active. Edit rollback.sql to confirm.'; END $$;

-- ── Drop triggers ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_cdn_updated_at ON client_discovery_notes;
DROP TRIGGER IF EXISTS trg_cc_updated_at  ON client_competitors;
DROP TRIGGER IF EXISTS trg_cps_updated_at ON client_products_services;

-- ── Drop indexes ──────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_cps_agency_client;
DROP INDEX IF EXISTS idx_cps_client_status;
DROP INDEX IF EXISTS idx_cps_client_type;
DROP INDEX IF EXISTS idx_cc_agency_client;
DROP INDEX IF EXISTS idx_cc_client_created;
DROP INDEX IF EXISTS idx_cdn_agency_client;
DROP INDEX IF EXISTS idx_cdn_client_created;
DROP INDEX IF EXISTS idx_goals_client_archived;
DROP INDEX IF EXISTS idx_kpis_client_archived;
DROP INDEX IF EXISTS idx_kpis_goal;

-- ── Drop new tables ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS client_discovery_notes   CASCADE;
DROP TABLE IF EXISTS client_competitors        CASCADE;
DROP TABLE IF EXISTS client_products_services  CASCADE;

-- ── Revert goals / kpis columns ──────────────────────────────────────────────
ALTER TABLE goals DROP COLUMN IF EXISTS description;
ALTER TABLE goals DROP COLUMN IF EXISTS time_period;
ALTER TABLE goals DROP COLUMN IF EXISTS owner;
ALTER TABLE goals DROP COLUMN IF EXISTS is_archived;
ALTER TABLE goals DROP COLUMN IF EXISTS archived_at;
ALTER TABLE goals DROP COLUMN IF EXISTS updated_by;

ALTER TABLE kpis DROP COLUMN IF EXISTS description;
ALTER TABLE kpis DROP COLUMN IF EXISTS goal_id;
ALTER TABLE kpis DROP COLUMN IF EXISTS owner;
ALTER TABLE kpis DROP COLUMN IF EXISTS status;
ALTER TABLE kpis DROP COLUMN IF EXISTS is_archived;
ALTER TABLE kpis DROP COLUMN IF EXISTS archived_at;
ALTER TABLE kpis DROP COLUMN IF EXISTS updated_by;

-- NOTE: The brand_voice migration (01-brand-discovery-schema.sql) converted
-- string values to objects. There is no automatic rollback for this data migration
-- since it was a content transformation, not a schema change.
-- If needed, restore discovery_data from a database backup taken before Wave 3.
