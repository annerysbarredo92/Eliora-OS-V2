-- Wave 3 Strategy — Phase 08: Verification Queries
-- Run these after all Wave 3 SQL to confirm deployment was successful.
-- Expected: all checks return rows or the described values.

-- 1. New tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'client_products_services',
    'client_competitors',
    'client_discovery_notes'
  )
ORDER BY table_name;
-- Expected: 3 rows

-- 2. goals schema has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'goals'
  AND column_name IN ('description','time_period','owner','is_archived','archived_at','updated_by')
ORDER BY column_name;
-- Expected: 6 rows

-- 3. kpis schema has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'kpis'
  AND column_name IN ('description','goal_id','owner','status','is_archived','archived_at','updated_by')
ORDER BY column_name;
-- Expected: 7 rows

-- 4. RLS is enabled on all new tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'client_products_services',
    'client_competitors',
    'client_discovery_notes'
  )
ORDER BY tablename;
-- Expected: all 3 rows have rowsecurity = true

-- 5. Policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'client_products_services',
    'client_competitors',
    'client_discovery_notes'
  )
ORDER BY tablename, policyname;
-- Expected: at least 1 policy per table

-- 6. Indexes exist
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_cps_agency_client',
    'idx_cc_agency_client',
    'idx_cdn_agency_client',
    'idx_goals_client_archived',
    'idx_kpis_client_archived'
  )
ORDER BY indexname;
-- Expected: 5 rows

-- 7. brand_voice migration check (sample — spot check a few clients)
SELECT id,
  jsonb_typeof(discovery_data->'brand_voice') AS brand_voice_type
FROM clients
WHERE discovery_data ? 'brand_voice'
LIMIT 10;
-- Expected: all rows show 'object', none show 'string'

-- 8. Check set_updated_at function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'set_updated_at';
-- Expected: 1 row
