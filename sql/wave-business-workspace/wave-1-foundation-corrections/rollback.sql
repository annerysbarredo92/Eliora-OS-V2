-- Rollback: remove patch_client_discovery_data RPC
DROP FUNCTION IF EXISTS patch_client_discovery_data(uuid, jsonb);
