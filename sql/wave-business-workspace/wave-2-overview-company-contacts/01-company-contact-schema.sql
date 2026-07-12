-- Wave 2: Overview, Company, and Contacts
-- Schema additions for Company and Contact sections.
-- All additions are idempotent (IF NOT EXISTS / DO $$ … END $$).

-- ── clients: new normalized company fields ───────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sub_industry        text,
  ADD COLUMN IF NOT EXISTS business_email      text,
  ADD COLUMN IF NOT EXISTS timezone            text,
  ADD COLUMN IF NOT EXISTS company_description text;

COMMENT ON COLUMN clients.sub_industry        IS 'Optional secondary industry category (e.g. "SaaS" under "Technology")';
COMMENT ON COLUMN clients.business_email      IS 'Primary business contact email (not a login email)';
COMMENT ON COLUMN clients.timezone            IS 'IANA timezone identifier, e.g. "America/New_York"';
COMMENT ON COLUMN clients.company_description IS 'Short company description used in AI context generation';

-- ── client_contacts: new contact preference fields ───────────────────────────

ALTER TABLE client_contacts
  ADD COLUMN IF NOT EXISTS preferred_communication text,
  ADD COLUMN IF NOT EXISTS birthday               date,
  ADD COLUMN IF NOT EXISTS notes                  text;

COMMENT ON COLUMN client_contacts.preferred_communication IS 'How the contact prefers to be reached: email, phone, text, video_call, in_person';
COMMENT ON COLUMN client_contacts.birthday               IS 'Contact birthday for relationship management';
COMMENT ON COLUMN client_contacts.notes                  IS 'Agency-internal notes about this contact';
