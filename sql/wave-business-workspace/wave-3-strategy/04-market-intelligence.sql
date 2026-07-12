-- Wave 3 Strategy — Phase 04: Market Intelligence
-- Creates client_competitors table.
-- SWOT and Market Position are stored as JSONB domains in clients.discovery_data
-- using the keys: market_swot and market_position.
-- They are patched via the existing patch_client_discovery_data() RPC.

CREATE TABLE IF NOT EXISTS client_competitors (
  id                        uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id                 uuid        NOT NULL REFERENCES agencies(id)  ON DELETE CASCADE,
  client_id                 uuid        NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,

  name                      text        NOT NULL,
  website                   text,
  description               text,
  social_profiles           jsonb       NOT NULL DEFAULT '{}',
  strengths                 text[]      NOT NULL DEFAULT '{}',
  weaknesses                text[]      NOT NULL DEFAULT '{}',
  notes                     text,
  ai_summary                text,
  ai_summary_generated_at   timestamptz,

  created_by                uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by                uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE client_competitors IS
  'Known competitors of the client. Used for SWOT analysis and AI context.';
COMMENT ON COLUMN client_competitors.social_profiles IS
  'JSON map of platform → URL, e.g. { "instagram": "https://…", "linkedin": "https://…" }.';
