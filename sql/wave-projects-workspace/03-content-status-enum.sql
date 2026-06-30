-- ============================================================
-- Wave: Projects & Workspace — Step 03
-- Add new content workflow statuses to the content_status enum.
-- New values: idea, filming, editing
-- Note: PostgreSQL enum values cannot be reordered after insertion.
-- The UI maps 'published' → "Posted" at the display layer only.
-- ============================================================

-- Supabase runs each ALTER in its own implicit transaction so
-- IF NOT EXISTS is the safe guard for idempotency.
ALTER TYPE content_status ADD VALUE IF NOT EXISTS 'idea';
ALTER TYPE content_status ADD VALUE IF NOT EXISTS 'filming';
ALTER TYPE content_status ADD VALUE IF NOT EXISTS 'editing';
