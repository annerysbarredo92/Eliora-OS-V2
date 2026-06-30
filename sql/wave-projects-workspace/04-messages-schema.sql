-- ============================================================
-- Wave: Projects & Workspace — Step 04
-- Extend messages table with kind and visibility columns to
-- support: Messages (chat), Emails, Meeting Notes,
-- Announcements, and Internal Notes (agency-only).
-- ============================================================

-- Add kind (message type), subject, and client visibility.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS kind              text    NOT NULL DEFAULT 'chat'
    CHECK (kind IN ('chat', 'email', 'meeting_note', 'announcement', 'internal_note')),
  ADD COLUMN IF NOT EXISTS subject           text,
  ADD COLUMN IF NOT EXISTS is_client_visible boolean NOT NULL DEFAULT true;

-- Trigger: internal_note messages are NEVER client-visible.
CREATE OR REPLACE FUNCTION enforce_message_kind_visibility()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'internal_note' THEN
    NEW.is_client_visible = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_kind_visibility ON messages;
CREATE TRIGGER trg_message_kind_visibility
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_message_kind_visibility();

-- Update any existing messages rows to kind='chat' (they already are by default,
-- but the trigger won't run retroactively on existing rows).
UPDATE messages SET kind = 'chat', is_client_visible = true
  WHERE kind IS NULL OR kind = 'chat';

-- Index for efficient per-kind queries within a thread.
CREATE INDEX IF NOT EXISTS messages_kind_idx
  ON messages(thread_id, kind, created_at DESC);

-- RLS: clients must never see internal_note rows.
-- Add this to the existing client-visible policy filter.
-- (The existing client read policy should already filter by agency/client;
--  we enforce the visibility flag here as the canonical gate.)
CREATE OR REPLACE FUNCTION messages_client_visible_check(m messages)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.is_client_visible = true AND m.kind <> 'internal_note';
$$;
