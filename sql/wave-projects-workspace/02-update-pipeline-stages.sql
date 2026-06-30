-- ============================================================
-- Wave: Projects & Workspace — Step 02
-- Update pipeline stages to match the Projects lifecycle spec.
-- New order: New Inquiry/Lead → Discovery Call → Proposal Sent
--            → Proposal Signed → Onboarding → Client
-- ============================================================

-- Rename existing stages and update sort order / probability.
-- Matching on name so this is safe to run per-agency across all rows.
UPDATE pipeline_stages SET name = 'New Inquiry / Lead', sort_order = 1, probability = 10
  WHERE name IN ('Lead', 'New Inquiry / Lead');

UPDATE pipeline_stages SET sort_order = 2, probability = 30
  WHERE name = 'Discovery Call';

UPDATE pipeline_stages SET name = 'Proposal Sent', sort_order = 3, probability = 60
  WHERE name IN ('Proposal + Contract', 'Proposal Sent');

UPDATE pipeline_stages SET name = 'Onboarding', sort_order = 5, probability = 90
  WHERE name IN ('Paid', 'Onboarding');

UPDATE pipeline_stages SET sort_order = 6, probability = 100
  WHERE name = 'Client';

-- Insert the new "Proposal Signed" stage for every agency that has stages
-- but doesn't already have it.
INSERT INTO pipeline_stages (agency_id, name, sort_order, probability, is_default)
SELECT DISTINCT ps.agency_id, 'Proposal Signed', 4, 75, false
FROM pipeline_stages ps
WHERE ps.name = 'Proposal Sent'
  AND NOT EXISTS (
    SELECT 1 FROM pipeline_stages x
    WHERE x.agency_id = ps.agency_id AND x.name = 'Proposal Signed'
  );

-- Update the seed function so future new agencies get the correct stages.
CREATE OR REPLACE FUNCTION seed_pipeline_stages(_agency_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO pipeline_stages (agency_id, name, sort_order, probability, is_default) VALUES
    (_agency_id, 'New Inquiry / Lead', 1, 10,  true),
    (_agency_id, 'Discovery Call',     2, 30,  true),
    (_agency_id, 'Proposal Sent',      3, 60,  true),
    (_agency_id, 'Proposal Signed',    4, 75,  true),
    (_agency_id, 'Onboarding',         5, 90,  true),
    (_agency_id, 'Client',             6, 100, true)
  ON CONFLICT (agency_id, name) DO NOTHING;
END;
$$;
