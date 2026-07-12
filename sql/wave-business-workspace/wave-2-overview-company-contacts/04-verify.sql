-- Wave 2: Verification queries
-- Run these after deploying 01–03 to confirm the migration succeeded.

-- 1. New clients columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'clients'
  AND column_name  IN ('sub_industry','business_email','timezone','company_description')
ORDER BY column_name;

-- 2. New client_contacts columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'client_contacts'
  AND column_name  IN ('preferred_communication','birthday','notes')
ORDER BY column_name;

-- 3. Unique primary-contact index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'client_contacts'
  AND indexname = 'uq_client_one_primary';

-- 4. set_primary_contact RPC
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'set_primary_contact';

-- 5. clients INSERT policy
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'clients' AND policyname = 'clients_insert';
