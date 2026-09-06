/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 1 ROLLBACK
==============================================================
Drops everything created by 01-05, in dependency order. Destructive —
only run if you need to fully undo Wave 1. Does NOT touch client_assets,
websites' website type name collisions with other waves, or any
Business Workspace object.
==============================================================
*/

-- Tables FIRST, functions AFTER. Dropping a table drops any trigger defined
-- on it automatically, but the trigger FUNCTION itself survives until
-- dropped separately — dropping the function first, while a trigger still
-- depends on it, fails with "cannot drop function ... because other objects
-- depend on it" (Postgres 2BP01). Once every table below is gone, none of
-- these functions has any dependent left, so the plain (non-CASCADE) drops
-- succeed cleanly.
drop table if exists digital_assets;
drop table if exists tracking_configurations;
drop table if exists seo_profiles;
drop table if exists business_listings;
drop table if exists social_channel_snapshots;
drop table if exists social_channels;
drop table if exists domains;
drop table if exists websites;

drop function if exists set_primary_website(uuid, uuid);
drop function if exists digital_assets_check_tenant_match();
drop function if exists digital_assets_check_client_asset_match(); -- earlier draft name, safe no-op if never applied
drop function if exists check_social_channel_tenant_match();
drop function if exists check_website_tenant_match();

drop type if exists digital_asset_category;
drop type if exists tracking_provider;
drop type if exists seo_check_status;
drop type if exists listing_lifecycle_status;
drop type if exists business_listing_provider;
drop type if exists digital_verification_status;
drop type if exists social_platform;
drop type if exists domain_ssl_status;
drop type if exists domain_lifecycle_status;
drop type if exists website_lifecycle_status;
drop type if exists website_type;
drop type if exists digital_ownership_status;
drop type if exists digital_integration_status;
