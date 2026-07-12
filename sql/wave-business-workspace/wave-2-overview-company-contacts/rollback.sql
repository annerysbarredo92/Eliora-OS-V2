-- Wave 2 Rollback
-- Reverses schema changes made by 01–03.
-- Run in reverse order.

-- 03: Restore permissive clients_insert policy (pre-Wave-2 state)
DROP POLICY IF EXISTS clients_insert ON clients;
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (true);

-- 02: Remove primary-contact RPC and unique index
DROP FUNCTION IF EXISTS set_primary_contact(uuid, uuid);
DROP INDEX IF EXISTS uq_client_one_primary;

-- 01: Remove added columns
ALTER TABLE client_contacts
  DROP COLUMN IF EXISTS preferred_communication,
  DROP COLUMN IF EXISTS birthday,
  DROP COLUMN IF EXISTS notes;

ALTER TABLE clients
  DROP COLUMN IF EXISTS sub_industry,
  DROP COLUMN IF EXISTS business_email,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS company_description;
