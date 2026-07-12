-- Wave 3 Strategy — Phase 01: Brand & Discovery Schema
-- Migrates existing flat brand keys in discovery_data to structured JSONB domains.
-- All operations are safe to run multiple times (idempotent).
-- Run BEFORE any application code that writes to the new structured domains.

-- ── Brand Voice migration ─────────────────────────────────────────────────────
-- Old key: discovery_data.brand_voice = "string describing tone"
-- New key: discovery_data.brand_voice = { voice_descriptor, tone_guidelines, ... }
-- Migration: convert only when current value is a non-null string (not yet migrated).

UPDATE clients
SET discovery_data = jsonb_set(
  COALESCE(discovery_data, '{}'::jsonb),
  '{brand_voice}',
  jsonb_build_object(
    'voice_descriptor',     COALESCE(discovery_data->>'brand_voice', ''),
    'tone_guidelines',      '',
    'approved_language',    '[]'::jsonb,
    'prohibited_language',  '[]'::jsonb,
    'writing_example',      ''
  )
)
WHERE discovery_data ? 'brand_voice'
  AND jsonb_typeof(discovery_data->'brand_voice') = 'string'
  AND (discovery_data->>'brand_voice') IS NOT NULL
  AND (discovery_data->>'brand_voice') != '';

-- ── Brand Strategy migration ──────────────────────────────────────────────────
-- Collects brand_mission + current_tagline into brand_strategy domain.
-- Only migrates when brand_strategy domain does not yet exist.

UPDATE clients
SET discovery_data = jsonb_set(
  COALESCE(discovery_data, '{}'::jsonb),
  '{brand_strategy}',
  jsonb_build_object(
    'mission',              COALESCE(discovery_data->>'brand_mission', ''),
    'vision',               '',
    'values',               '[]'::jsonb,
    'positioning',          '',
    'uvp',                  '',
    'taglines',             CASE
                              WHEN (discovery_data->>'current_tagline') IS NOT NULL
                               AND (discovery_data->>'current_tagline') != ''
                              THEN jsonb_build_array(discovery_data->>'current_tagline')
                              ELSE '[]'::jsonb
                            END,
    'approved_messaging',   '[]'::jsonb,
    'hashtags',             '[]'::jsonb,
    'keywords',             '[]'::jsonb
  )
)
WHERE (discovery_data ? 'brand_mission' OR discovery_data ? 'current_tagline')
  AND NOT (discovery_data ? 'brand_strategy');

-- ── Ensure all clients have the discovery folder ──────────────────────────────
-- The ensure_client_folders RPC already creates Brand Assets (sort_order 1) and
-- Logos (sort_order 4). We add a 'Discovery Documents' folder here if it doesn't exist.
-- Using ON CONFLICT DO NOTHING via direct INSERT; safe to run multiple times.

INSERT INTO asset_folders (agency_id, client_id, name, is_default, sort_order)
SELECT DISTINCT
  c.agency_id,
  c.id,
  'Discovery Documents',
  true,
  7
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM asset_folders af
  WHERE af.client_id = c.id AND af.name = 'Discovery Documents'
)
ON CONFLICT DO NOTHING;
