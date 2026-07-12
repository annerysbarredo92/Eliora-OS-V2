-- Wave 3 Strategy — Phase 05: Discovery Notes
-- Structured, chronological notes captured during discovery calls and meetings.
-- Separate from the free-form meeting_notes flat key in the legacy DiscoveryTab.

CREATE TABLE IF NOT EXISTS client_discovery_notes (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id   uuid        NOT NULL REFERENCES agencies(id)  ON DELETE CASCADE,
  client_id   uuid        NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,

  title       text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  source      text
    CHECK (source IN ('call','meeting','email','document','workshop','other')),
  author_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE client_discovery_notes IS
  'Structured, dated discovery notes. Replaces flat meeting_notes/call_notes keys for active clients.';
COMMENT ON COLUMN client_discovery_notes.source IS
  'Origin of the discovery note for filtering and audit trail.';
