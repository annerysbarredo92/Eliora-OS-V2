-- Wave 3 Strategy — Phase 09: Product Image Relationship
-- Adds primary_asset_id to client_products_services.
-- Run AFTER the initial Wave 3 SQL (files 01–08).

ALTER TABLE client_products_services
  ADD COLUMN IF NOT EXISTS primary_asset_id uuid
    REFERENCES client_assets(id) ON DELETE SET NULL;

COMMENT ON COLUMN client_products_services.primary_asset_id IS
  'Optional primary image for this product or service. References a client_assets record.';

-- Index for reverse lookups (which products use a given asset)
CREATE INDEX IF NOT EXISTS idx_cps_primary_asset
  ON client_products_services (primary_asset_id)
  WHERE primary_asset_id IS NOT NULL;
