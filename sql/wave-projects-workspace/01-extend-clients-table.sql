-- ============================================================
-- Wave: Projects & Workspace — Step 01
-- Extend clients table to become the unified project record.
-- Run in order: 01 → 02 → 03 → 04 → 05 → 06
-- ============================================================

-- Pipeline stage link (the primary stage progression column)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stage_id              uuid        REFERENCES pipeline_stages(id) ON DELETE SET NULL;

-- Sales / pipeline fields (structured columns for queryability)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS project_value_cents   integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_source           text,
  ADD COLUMN IF NOT EXISTS estimated_budget_cents integer    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_probability     smallint    CHECK (close_probability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS decision_maker        text,
  ADD COLUMN IF NOT EXISTS next_follow_up_at     timestamptz,
  ADD COLUMN IF NOT EXISTS sales_owner_id        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_manager_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_score            smallint    CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS expected_close_date   date,
  ADD COLUMN IF NOT EXISTS client_since          date,
  ADD COLUMN IF NOT EXISTS location              text,
  ADD COLUMN IF NOT EXISTS next_action           text;

-- Rich unstructured fields stored as jsonb to avoid dozens of nullable columns.
-- lead_info: services_interested, pain_points, requirements, competitors, sales_notes
-- discovery_data: business, audience, brand, marketing sections
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS lead_info             jsonb       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discovery_data        jsonb       NOT NULL DEFAULT '{}';

-- Performance indexes
CREATE INDEX IF NOT EXISTS clients_stage_idx
  ON clients(agency_id, stage_id)
  WHERE status <> 'archived';

CREATE INDEX IF NOT EXISTS clients_follow_up_idx
  ON clients(agency_id, next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL AND status <> 'archived';

CREATE INDEX IF NOT EXISTS clients_lead_status_idx
  ON clients(agency_id, status)
  WHERE status = 'lead';
