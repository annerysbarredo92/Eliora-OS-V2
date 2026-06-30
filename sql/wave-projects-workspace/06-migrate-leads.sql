-- ============================================================
-- Wave: Projects & Workspace — Step 06
-- Migrate any existing leads records into the clients table
-- (the unified project record). Safe to run multiple times.
-- MUST be run after 01-extend-clients-table.sql.
-- ============================================================

DO $$
DECLARE
  _lead_count   int;
  _migrated     int := 0;
  _skipped      int := 0;
  _new_id       uuid;
  _stage_id     uuid;
  _rec          record;
  _first        text;
  _last         text;
BEGIN
  -- Guard: skip if leads table doesn't exist (wave-02 not applied)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leads'
  ) THEN
    RAISE NOTICE 'leads table not found — skipping migration (wave-02 may not have been applied yet)';
    RETURN;
  END IF;

  SELECT count(*) INTO _lead_count FROM leads;
  RAISE NOTICE 'Found % total lead records', _lead_count;

  IF _lead_count = 0 THEN
    RAISE NOTICE 'No leads to migrate.';
    RETURN;
  END IF;

  -- Migrate only unconverted leads (converted_client_id IS NULL).
  FOR _rec IN
    SELECT * FROM leads WHERE converted_client_id IS NULL ORDER BY created_at
  LOOP
    -- Get the lowest sort_order stage for this agency
    SELECT id INTO _stage_id
    FROM pipeline_stages
    WHERE agency_id = _rec.agency_id
    ORDER BY sort_order ASC
    LIMIT 1;

    -- Create the client (project) record
    INSERT INTO clients (
      agency_id, business_name, website, business_phone, status,
      stage_id, project_value_cents, lead_source, sales_owner_id,
      internal_notes, created_at, updated_at
    ) VALUES (
      _rec.agency_id, _rec.business_name, _rec.website, _rec.phone, 'lead',
      _stage_id, _rec.estimated_value_cents, _rec.source, _rec.owner_id,
      _rec.notes, _rec.created_at, _rec.updated_at
    )
    RETURNING id INTO _new_id;

    IF _new_id IS NOT NULL THEN
      -- Create primary contact if any contact info exists
      IF _rec.name IS NOT NULL OR _rec.email IS NOT NULL THEN
        _first := COALESCE(split_part(trim(_rec.name), ' ', 1), 'Contact');
        _last  := NULLIF(trim(substring(trim(coalesce(_rec.name,'')) FROM position(' ' IN trim(coalesce(_rec.name,''))) + 1)), '');

        INSERT INTO client_contacts (
          agency_id, client_id, first_name, last_name, email, phone, is_primary
        ) VALUES (
          _rec.agency_id, _new_id, _first, _last, _rec.email, _rec.phone, true
        ) ON CONFLICT DO NOTHING;
      END IF;

      -- Mark the lead as converted to the new client record
      UPDATE leads SET converted_client_id = _new_id WHERE id = _rec.id;
      _migrated := _migrated + 1;

    ELSE
      _skipped := _skipped + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration complete: % leads migrated → clients, % skipped (already converted)', _migrated, _skipped;
END $$;
