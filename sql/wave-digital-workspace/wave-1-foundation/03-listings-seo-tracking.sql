/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 1: LISTINGS + SEO + TRACKING
==============================================================
Purpose:      Business Listings (canonical provider directory presence),
              SEO (technical/infrastructure status + baseline visibility,
              NOT campaign strategy), and Tracking & Analytics
              (provider-neutral, configuration-first — no live API
              integrations, no secrets, this wave).

Multi-record  A client may have multiple locations (multiple listings on
correction:   the SAME provider) and multiple tracking properties (multiple
              GA4/GTM configs, one per website). Neither table enforces
              one-row-per-provider — idempotency instead keys on the
              provider's own external ID where one exists, and does not
              require one for manual/configuration-first records. See the
              business_listings_external_id_unique_idx and
              tracking_configurations_external_id_unique_idx comments below.

Depends on:   01-websites-domains.sql (digital_ownership_status,
              digital_integration_status, websites, and the
              check_website_tenant_match() trigger function reused by
              seo_profiles and tracking_configurations below).
Execution:    Paste after 02-social.sql. Idempotent.
==============================================================
*/

-- ── 1. SHARED VERIFICATION ENUM ──────────────────────────────────────────────
do $$ begin
  create type digital_verification_status as enum ('verified','unverified','pending','not_applicable');
exception when duplicate_object then null; end $$;

-- ── 2. BUSINESS LISTINGS ──────────────────────────────────────────────────────
do $$ begin
  create type business_listing_provider as enum (
    'google_business_profile','apple_business_connect','bing_places','yelp','custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_lifecycle_status as enum ('active','inactive','archived');
exception when duplicate_object then null; end $$;

-- Reviews are represented here as reputation METRICS only (rating,
-- review_count, last_review_at) — no review-response/customer-success
-- workflow. That belongs to Client Success, not Digital.
create table if not exists business_listings (
  id                    uuid                          primary key default uuid_generate_v4(),
  agency_id             uuid                          not null references agencies(id) on delete cascade,
  client_id             uuid                          not null references clients(id)  on delete cascade,

  provider              business_listing_provider     not null,
  custom_provider_name  text,                         -- required when provider = 'custom'
  profile_url           text,
  external_listing_id   text,

  ownership_status      digital_ownership_status      not null default 'unknown',
  verification_status   digital_verification_status   not null default 'unverified',
  listing_status        listing_lifecycle_status      not null default 'active',

  business_name         text,
  address               text,
  phone                 text,
  hours                 jsonb,
  category              text,

  rating                numeric(3,2)                  check (rating is null or (rating >= 0 and rating <= 5)),
  review_count          integer                       not null default 0 check (review_count >= 0),
  last_review_at        timestamptz,

  notes                 text,

  created_by            uuid                          references profiles(id) on delete set null,
  updated_by            uuid                          references profiles(id) on delete set null,
  created_at            timestamptz                   not null default now(),
  updated_at            timestamptz                   not null default now(),

  constraint business_listings_custom_name_required
    check (provider <> 'custom' or custom_provider_name is not null)
);

-- A client may have multiple physical locations, so multiple listings on
-- the SAME provider are legitimate and expected (5 Google Business Profiles
-- for 5 storefronts, 5 Yelp listings, etc.) — there is deliberately NO
-- uniqueness on (client_id, provider) alone.
--
-- What must still be prevented is duplicate REPRESENTATION of the exact
-- same provider listing (the same Google Business Profile entered twice).
-- That is only knowable once an external_listing_id exists — a manually
-- entered listing with no ID yet cannot be deduplicated by the database,
-- and must not be required to have one.
create unique index if not exists business_listings_external_id_unique_idx
  on business_listings(client_id, provider, external_listing_id)
  where external_listing_id is not null;

-- Non-unique — supports "all of this client's Google listings" without
-- enforcing any cardinality rule.
create index if not exists business_listings_provider_idx on business_listings(client_id, provider);
create index if not exists business_listings_client_idx   on business_listings(client_id, listing_status);
create index if not exists business_listings_agency_idx   on business_listings(agency_id, updated_at desc);

drop trigger if exists business_listings_set_updated_at on business_listings;
create trigger business_listings_set_updated_at
  before update on business_listings
  for each row execute function set_updated_at();

alter table business_listings enable row level security;

drop policy if exists "business_listings_select" on business_listings;
create policy "business_listings_select" on business_listings
  for select using (agency_id = public.current_agency_id());

drop policy if exists "business_listings_insert" on business_listings;
create policy "business_listings_insert" on business_listings
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "business_listings_update" on business_listings;
create policy "business_listings_update" on business_listings
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "business_listings_delete" on business_listings;
create policy "business_listings_delete" on business_listings
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on business_listings to authenticated;

-- ── 3. SEO PROFILE ────────────────────────────────────────────────────────────
-- Technical/infrastructure SEO + baseline visibility only — SEO campaigns
-- and content strategy live in Marketing, not here. One row per client
-- (not an ever-growing metrics table): Wave 1 needs current status, not a
-- time series. A future wave can add a history table without touching this
-- one if that becomes genuinely necessary.
do $$ begin
  create type seo_check_status as enum ('unknown','not_configured','issue','healthy');
exception when duplicate_object then null; end $$;

create table if not exists seo_profiles (
  id                        uuid                        primary key default uuid_generate_v4(),
  agency_id                 uuid                        not null references agencies(id) on delete cascade,
  client_id                 uuid                        not null references clients(id)  on delete cascade,
  website_id                uuid                        references websites(id) on delete set null,

  indexing_status           seo_check_status            not null default 'unknown',
  sitemap_status            seo_check_status            not null default 'unknown',
  robots_status             seo_check_status            not null default 'unknown',
  search_console_status     digital_integration_status  not null default 'manual',
  technical_health_status   seo_check_status            not null default 'unknown',

  keyword_baseline_count    integer                     check (keyword_baseline_count is null or keyword_baseline_count >= 0),
  visibility_baseline_score numeric(5,2),

  -- [{ "code": "string", "label": "string", "severity": "low|medium|high" }]
  issues                    jsonb                       not null default '[]',
  recommendations           text,

  last_checked_at           timestamptz,
  notes                     text,

  created_by                uuid                        references profiles(id) on delete set null,
  updated_by                uuid                        references profiles(id) on delete set null,
  created_at                timestamptz                 not null default now(),
  updated_at                timestamptz                 not null default now(),

  constraint seo_profiles_one_per_client unique (client_id)
);

create index if not exists seo_profiles_agency_idx on seo_profiles(agency_id, updated_at desc);

drop trigger if exists seo_profiles_set_updated_at on seo_profiles;
create trigger seo_profiles_set_updated_at
  before update on seo_profiles
  for each row execute function set_updated_at();

-- Same website_id tenant-match gap as domains. Reuses the function owned
-- by 01-websites-domains.sql — this file only attaches a trigger to it and
-- must never redefine or drop that function.
drop trigger if exists seo_profiles_check_website_tenant_match_trg on seo_profiles;
create trigger seo_profiles_check_website_tenant_match_trg
  before insert or update on seo_profiles
  for each row execute function check_website_tenant_match();

alter table seo_profiles enable row level security;

drop policy if exists "seo_profiles_select" on seo_profiles;
create policy "seo_profiles_select" on seo_profiles
  for select using (agency_id = public.current_agency_id());

drop policy if exists "seo_profiles_insert" on seo_profiles;
create policy "seo_profiles_insert" on seo_profiles
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "seo_profiles_update" on seo_profiles;
create policy "seo_profiles_update" on seo_profiles
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "seo_profiles_delete" on seo_profiles;
create policy "seo_profiles_delete" on seo_profiles
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on seo_profiles to authenticated;

-- ── 4. TRACKING & ANALYTICS CONFIGURATION ────────────────────────────────────
-- Configuration-first: what property/container/pixel IS, and its
-- connection state — never how to authenticate to it. See the hard rule
-- below: this table must never grow an access_token/refresh_token/
-- client_secret/api_key column. Any future OAuth flow stores credentials
-- in a server-side secrets store, never here.
do $$ begin
  create type tracking_provider as enum (
    'ga4','gtm','search_console','meta_pixel','google_ads','tiktok_pixel','linkedin_insight','custom'
  );
exception when duplicate_object then null; end $$;

create table if not exists tracking_configurations (
  id                    uuid                        primary key default uuid_generate_v4(),
  agency_id             uuid                        not null references agencies(id) on delete cascade,
  client_id             uuid                        not null references clients(id)  on delete cascade,

  -- Optional: which website this property/container/pixel measures. A
  -- client with multiple websites legitimately needs different GA4
  -- properties / GTM containers per site — a real FK, never a copied URL.
  -- Nullable: some tracking (e.g. a client-wide Google Ads conversion
  -- config) isn't tied to one specific site.
  website_id            uuid                        references websites(id) on delete set null,

  provider              tracking_provider           not null,
  custom_provider_name  text,                       -- required when provider = 'custom'
  external_id           text,                       -- property/container/pixel ID — never a credential

  status                digital_integration_status  not null default 'manual',
  verification_status   digital_verification_status not null default 'unverified',

  last_checked_at       timestamptz,
  last_synced_at        timestamptz,

  -- Non-secret configuration only (e.g. { "stream_name": "Web" }).
  -- Enforced by convention + code review, not by the database — Postgres
  -- cannot know a value is a secret. See NO SECRET STORAGE rule.
  configuration         jsonb                       not null default '{}',
  notes                 text,

  created_by            uuid                        references profiles(id) on delete set null,
  updated_by            uuid                        references profiles(id) on delete set null,
  created_at            timestamptz                 not null default now(),
  updated_at            timestamptz                 not null default now(),

  constraint tracking_configurations_custom_name_required
    check (provider <> 'custom' or custom_provider_name is not null)
);

-- A client may legitimately have multiple properties of the same provider
-- (a GA4 property per website, multiple GTM containers, etc.) — no
-- uniqueness on (client_id, provider) alone. Duplicate representation of
-- the exact same property/container/pixel is only preventable once a real
-- external_id exists; configuration-first/manual rows without one are
-- never required to have an ID and are never deduplicated by the database.
create unique index if not exists tracking_configurations_external_id_unique_idx
  on tracking_configurations(client_id, provider, external_id)
  where external_id is not null;

create index if not exists tracking_configurations_provider_idx on tracking_configurations(client_id, provider);
create index if not exists tracking_configurations_client_idx   on tracking_configurations(client_id, status);
create index if not exists tracking_configurations_agency_idx   on tracking_configurations(agency_id, updated_at desc);
create index if not exists tracking_configurations_website_idx  on tracking_configurations(website_id) where website_id is not null;

drop trigger if exists tracking_configurations_set_updated_at on tracking_configurations;
create trigger tracking_configurations_set_updated_at
  before update on tracking_configurations
  for each row execute function set_updated_at();

-- Enforces tracking_configurations.agency_id = websites.agency_id AND
-- tracking_configurations.client_id = websites.client_id whenever website_id
-- is set. Without this, a tracking configuration could reference a website
-- belonging to a different agency/client purely because the FK alone only
-- proves the website row exists, not who it belongs to. Reuses the function
-- owned by 01-websites-domains.sql — this file only attaches a trigger to
-- it and must never redefine or drop that function.
drop trigger if exists tracking_configurations_check_website_tenant_match_trg on tracking_configurations;
create trigger tracking_configurations_check_website_tenant_match_trg
  before insert or update on tracking_configurations
  for each row execute function check_website_tenant_match();

alter table tracking_configurations enable row level security;

drop policy if exists "tracking_configurations_select" on tracking_configurations;
create policy "tracking_configurations_select" on tracking_configurations
  for select using (agency_id = public.current_agency_id());

drop policy if exists "tracking_configurations_insert" on tracking_configurations;
create policy "tracking_configurations_insert" on tracking_configurations
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "tracking_configurations_update" on tracking_configurations;
create policy "tracking_configurations_update" on tracking_configurations
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "tracking_configurations_delete" on tracking_configurations;
create policy "tracking_configurations_delete" on tracking_configurations
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on tracking_configurations to authenticated;

-- ── 5. VERIFICATION (informational — see 06-verify-wave-1.sql for the full set) ──
-- select count(*) from business_listings;
-- select count(*) from seo_profiles;
-- select count(*) from tracking_configurations;
-- select indexname from pg_indexes where tablename = 'business_listings' and indexname = 'business_listings_external_id_unique_idx';
-- select indexname from pg_indexes where tablename = 'tracking_configurations' and indexname = 'tracking_configurations_external_id_unique_idx';
-- select column_name from information_schema.columns where table_name = 'tracking_configurations' and column_name = 'website_id';
-- select tgname from pg_trigger where tgname = 'tracking_configurations_check_website_tenant_match_trg';
-- select tgname from pg_trigger where tgname = 'seo_profiles_check_website_tenant_match_trg';
-- select column_name from information_schema.columns
--   where table_name = 'tracking_configurations'
--     and column_name in ('access_token','refresh_token','client_secret','api_key');
--   → expected: 0 rows
