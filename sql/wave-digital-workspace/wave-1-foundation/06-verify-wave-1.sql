/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 1 VERIFICATION
==============================================================
Read-only. Run after applying 01 → 05, in order. All queries should
return the expected results below.
==============================================================
*/

-- ── Tables exist ──────────────────────────────────────────────────────────────
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in (
     'websites','domains','social_channels','social_channel_snapshots',
     'business_listings','seo_profiles','tracking_configurations','digital_assets'
   )
 order by table_name;
-- expected: all 8 tables listed

-- ── RLS enabled on every Digital table ───────────────────────────────────────
select relname, relrowsecurity
  from pg_class
 where relname in (
   'websites','domains','social_channels','social_channel_snapshots',
   'business_listings','seo_profiles','tracking_configurations','digital_assets'
 )
 order by relname;
-- expected: relrowsecurity = true for all 8 rows

-- ── RLS policy count per table (expect 4 each: select/insert/update/delete) ──
select tablename, count(*) as policy_count
  from pg_policies
 where tablename in (
   'websites','domains','social_channels','social_channel_snapshots',
   'business_listings','seo_profiles','tracking_configurations','digital_assets'
 )
 group by tablename
 order by tablename;
-- expected: 4 for every table

-- ── No client-portal SELECT policy exists on any Digital table ──────────────
-- (Digital is agency-internal only in Wave 1 — this must return 0 rows.)
select tablename, policyname, qual
  from pg_policies
 where tablename in (
   'websites','domains','social_channels','social_channel_snapshots',
   'business_listings','seo_profiles','tracking_configurations','digital_assets'
 )
   and qual not like '%current_agency_id%';
-- expected: 0 rows

-- ── Foreign keys ──────────────────────────────────────────────────────────────
select conrelid::regclass as table_name, conname, confrelid::regclass as references_table
  from pg_constraint
 where contype = 'f'
   and conrelid::regclass::text in (
     'websites','domains','social_channels','social_channel_snapshots',
     'business_listings','seo_profiles','tracking_configurations','digital_assets'
   )
 order by table_name, conname;
-- expected: includes domains -> websites, digital_assets -> client_assets,
--   digital_assets -> websites/domains/social_channels/business_listings,
--   social_channel_snapshots -> social_channels, tracking_configurations ->
--   websites (optional site-level association — see below), and every
--   table -> agencies/clients

-- ── Primary website integrity: partial unique index exists ──────────────────
select indexname, indexdef
  from pg_indexes
 where tablename = 'websites'
   and indexname = 'websites_primary_unique_idx';
-- expected: 1 row; indexdef contains "WHERE is_primary"

-- ── Primary website RPC exists ────────────────────────────────────────────────
select proname, pronargs
  from pg_proc
 where proname = 'set_primary_website';
-- expected: 1 row, pronargs = 2

-- ── Social snapshot idempotency constraint exists ────────────────────────────
select conname
  from pg_constraint
 where conname = 'social_channel_snapshots_unique_per_day';
-- expected: 1 row

-- ── Digital Assets: single-relation CHECK + full tenant-match trigger ───────
-- Covers client_asset_id AND all four optional relation columns
-- (website_id/domain_id/social_channel_id/business_listing_id).
select conname from pg_constraint where conname = 'digital_assets_single_relation';
-- expected: 1 row
select tgname from pg_trigger where tgname = 'digital_assets_check_tenant_match_trg';
-- expected: 1 row
select conname, confrelid::regclass as references_table
  from pg_constraint
 where conrelid = 'digital_assets'::regclass
   and confrelid = 'client_assets'::regclass;
-- expected: 1 row — proves Digital Assets references the canonical Files
-- table (client_assets) and not a second storage system

-- ── Cross-record tenant-match triggers: website_id references ──────────────
-- Every Digital table that carries an OPTIONAL website_id column must
-- verify agency_id/client_id match the referenced website's — a plain FK
-- alone only proves the website row exists, not who owns it.
select tgname, tgrelid::regclass as on_table
  from pg_trigger
 where tgname in (
   'domains_check_website_tenant_match_trg',
   'seo_profiles_check_website_tenant_match_trg',
   'tracking_configurations_check_website_tenant_match_trg'
 )
 order by tgname;
-- expected: 3 rows, one per table (domains, seo_profiles, tracking_configurations)

select proname from pg_proc where proname = 'check_website_tenant_match';
-- expected: 1 row (shared by all three triggers above)

-- ── Cross-record tenant-match trigger: social_channel_snapshots ────────────
-- social_channel_snapshots.social_channel_id is NOT NULL (unlike the
-- website_id columns above) but has the identical class of gap: a plain FK
-- proves the channel exists, not that it belongs to the same agency/client
-- as the snapshot.
select tgname from pg_trigger where tgname = 'social_channel_snapshots_check_channel_trg';
-- expected: 1 row
select proname from pg_proc where proname = 'check_social_channel_tenant_match';
-- expected: 1 row

-- ── No secret-shaped columns anywhere in Digital ─────────────────────────────
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name in (
     'websites','domains','social_channels','social_channel_snapshots',
     'business_listings','seo_profiles','tracking_configurations','digital_assets'
   )
   and column_name in ('access_token','refresh_token','client_secret','api_key','password');
-- expected: 0 rows

-- ── Business Listings: multiple listings per provider are structurally
--    allowed — no unique index on (client_id, provider) alone should exist.
select indexname, indexdef
  from pg_indexes
 where tablename = 'business_listings'
   and indexdef ilike '%unique%'
   and indexdef ilike '%client_id, provider)%'
   and indexdef not ilike '%external_listing_id%';
-- expected: 0 rows — a client may have 5 Google listings, 5 Yelp listings, etc.

-- ── Business Listings: duplicate representation of the SAME known
--    external listing is prevented; listings with no external ID
--    (manual/Custom) are never required to have one and are never
--    deduplicated by the database.
select indexname, indexdef
  from pg_indexes
 where tablename = 'business_listings'
   and indexname = 'business_listings_external_id_unique_idx';
-- expected: 1 row; indexdef contains "WHERE (external_listing_id IS NOT NULL)"

-- ── Tracking Configurations: multiple properties per provider are
--    structurally allowed (a client may run several GA4 properties, one
--    per website) — same absence check as Business Listings above.
select indexname, indexdef
  from pg_indexes
 where tablename = 'tracking_configurations'
   and indexdef ilike '%unique%'
   and indexdef ilike '%client_id, provider)%'
   and indexdef not ilike '%external_id%';
-- expected: 0 rows

-- ── Tracking Configurations: duplicate representation of the SAME known
--    external property/container/pixel ID is prevented; configuration-first
--    rows with no external ID yet are never required to have one.
select indexname, indexdef
  from pg_indexes
 where tablename = 'tracking_configurations'
   and indexname = 'tracking_configurations_external_id_unique_idx';
-- expected: 1 row; indexdef contains "WHERE (external_id IS NOT NULL)"

-- ── Tracking Configurations: optional website relationship is a real FK,
--    not a copied URL — supports different GA4/GTM per site.
select column_name, is_nullable
  from information_schema.columns
 where table_name = 'tracking_configurations'
   and column_name = 'website_id';
-- expected: 1 row, is_nullable = 'YES'
select conname, confrelid::regclass as references_table
  from pg_constraint
 where conrelid = 'tracking_configurations'::regclass
   and confrelid = 'websites'::regclass;
-- expected: 1 row

-- ── Useful non-unique lookup indexes exist for the new multi-record shape ──
select indexname
  from pg_indexes
 where tablename in ('business_listings','tracking_configurations')
   and indexname in (
     'business_listings_provider_idx','tracking_configurations_provider_idx',
     'tracking_configurations_website_idx'
   )
 order by indexname;
-- expected: all 3 present

-- ── Enum values sanity check ──────────────────────────────────────────────────
select t.typname, e.enumlabel
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
 where t.typname in (
   'digital_integration_status','digital_ownership_status','website_type',
   'website_lifecycle_status','domain_lifecycle_status','domain_ssl_status',
   'social_platform','digital_verification_status','business_listing_provider',
   'listing_lifecycle_status','seo_check_status','tracking_provider','digital_asset_category'
 )
 order by t.typname, e.enumsortorder;
-- expected: all 13 enum types present with their declared labels
