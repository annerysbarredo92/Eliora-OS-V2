-- Verify: patch_client_discovery_data RPC exists and has correct signature
SELECT
  routine_name,
  routine_type,
  security_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'patch_client_discovery_data';

-- Verify parameter types
SELECT
  parameter_name,
  data_type,
  udt_name
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name LIKE 'patch_client_discovery_data%'
ORDER BY ordinal_position;
