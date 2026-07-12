-- Wave 3 Strategy — Phase 03: Goals & KPIs Schema Corrections
-- Adds missing fields to the existing goals and kpis tables.
-- All ALTER TABLE ... ADD COLUMN IF NOT EXISTS — safe to re-run.

-- ── goals additions ───────────────────────────────────────────────────────────

ALTER TABLE goals ADD COLUMN IF NOT EXISTS description   text;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS time_period   text;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS owner         text;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_archived   boolean     NOT NULL DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS archived_at   timestamptz;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS updated_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN goals.time_period    IS 'Free-form period label, e.g. "Q3 2026" or "FY 2026".';
COMMENT ON COLUMN goals.owner          IS 'Free-form owner name or email — not a FK to allow external owner references.';
COMMENT ON COLUMN goals.is_archived    IS 'Soft-delete: archived goals are hidden by default but recoverable.';
COMMENT ON COLUMN goals.current_value  IS 'Progress toward target_value. Progress % = current_value / target_value.';

-- ── kpis additions ────────────────────────────────────────────────────────────

ALTER TABLE kpis ADD COLUMN IF NOT EXISTS description   text;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS goal_id       uuid        REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS owner         text;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS status        text        NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','needs_attention','achieved','inactive'));
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS is_archived   boolean     NOT NULL DEFAULT false;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS archived_at   timestamptz;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS updated_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN kpis.goal_id    IS 'Optional FK to a parent goal this KPI rolls up into.';
COMMENT ON COLUMN kpis.status     IS 'Reflects whether this KPI is on track or needs intervention.';
COMMENT ON COLUMN kpis.is_archived IS 'Soft-delete: archived KPIs are hidden by default but recoverable.';
