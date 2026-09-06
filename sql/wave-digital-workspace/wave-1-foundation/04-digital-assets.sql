/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 1: DIGITAL ASSETS
==============================================================
Purpose:      Associate EXISTING Files (client_assets) with digital
              properties and purposes. This table stores NO files, NO
              storage paths, and NO uploads of its own — client_assets
              (Wave 01 client delivery system) remains the one and only
              canonical file store in Eliora.

Referential   Avoids a polymorphic (entity_type, entity_id) pair — the
integrity:    existing precedent for that shape (activity_logs) is
              deliberately loose/unconstrained, which is fine for an
              activity feed but not for a table other Digital tables get
              cascaded deletes from. Four separate, individually
              FK-constrained, nullable columns preserve real referential
              integrity; a CHECK constraint keeps at most one set at a time.

Depends on:   01-websites-domains.sql, 02-social.sql,
              03-listings-seo-tracking.sql, and the existing client_assets
              table.
Execution:    Paste after 03-listings-seo-tracking.sql. Idempotent.
==============================================================
*/

-- ── 1. ENUM ───────────────────────────────────────────────────────────────────
do $$ begin
  create type digital_asset_category as enum (
    'favicon','website_image','app_icon','social_profile_asset',
    'downloadable_resource','technical_document','platform_asset','other'
  );
exception when duplicate_object then null; end $$;

-- ── 2. TABLE ──────────────────────────────────────────────────────────────────
create table if not exists digital_assets (
  id                    uuid                     primary key default uuid_generate_v4(),
  agency_id             uuid                     not null references agencies(id)      on delete cascade,
  client_id             uuid                     not null references clients(id)       on delete cascade,
  client_asset_id       uuid                     not null references client_assets(id) on delete cascade,

  category              digital_asset_category   not null default 'other',

  -- At most ONE of these four may be set (enforced below) — an asset is
  -- either general-purpose (all null) or tied to exactly one digital
  -- property. Real foreign keys, not a generic entity_type/entity_id pair.
  website_id            uuid                     references websites(id)         on delete set null,
  domain_id             uuid                     references domains(id)          on delete set null,
  social_channel_id     uuid                     references social_channels(id)  on delete set null,
  business_listing_id   uuid                     references business_listings(id) on delete set null,

  notes                 text,

  created_by            uuid                     references profiles(id) on delete set null,
  created_at            timestamptz              not null default now(),

  constraint digital_assets_single_relation check (
    (case when website_id          is not null then 1 else 0 end) +
    (case when domain_id           is not null then 1 else 0 end) +
    (case when social_channel_id   is not null then 1 else 0 end) +
    (case when business_listing_id is not null then 1 else 0 end) <= 1
  )
);

-- One Digital categorization per underlying file — re-categorizing a file
-- is an UPDATE, not a second row.
create unique index if not exists digital_assets_client_asset_unique_idx
  on digital_assets(client_asset_id);

create index if not exists digital_assets_client_idx on digital_assets(client_id, category);
create index if not exists digital_assets_agency_idx on digital_assets(agency_id, created_at desc);

-- ── 3. CONSISTENCY TRIGGER ────────────────────────────────────────────────────
-- Postgres CHECK constraints cannot reference another table. This trigger is
-- the equivalent guarantee, covering EVERY foreign key on this row — not
-- just client_asset_id: the referenced client_assets row, and whichever ONE
-- of website_id/domain_id/social_channel_id/business_listing_id is set,
-- must all belong to the same agency/client this digital_assets row claims.
-- RLS already scopes every table to one agency, so this is a data-integrity
-- backstop, not a security boundary on its own — but it keeps cross-client
-- mixups impossible even from a privileged (service-role) write path.
-- Drop the earlier, narrower version of this function/trigger by name, in
-- case an earlier draft of this file was ever applied — safe no-op otherwise.
drop trigger if exists digital_assets_check_client_asset_match_trg on digital_assets;
drop function if exists digital_assets_check_client_asset_match();

create or replace function digital_assets_check_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _asset   client_assets;
  _site    websites;
  _domain  domains;
  _channel social_channels;
  _listing business_listings;
begin
  select * into _asset from client_assets where id = new.client_asset_id;
  if not found then
    raise exception 'client_asset_not_found: Referenced file does not exist';
  end if;
  if _asset.agency_id <> new.agency_id or _asset.client_id <> new.client_id then
    raise exception 'client_asset_mismatch: Referenced file belongs to a different agency/client';
  end if;

  if new.website_id is not null then
    select * into _site from websites where id = new.website_id;
    if not found or _site.agency_id <> new.agency_id or _site.client_id <> new.client_id then
      raise exception 'website_mismatch: Referenced website belongs to a different agency/client';
    end if;
  end if;

  if new.domain_id is not null then
    select * into _domain from domains where id = new.domain_id;
    if not found or _domain.agency_id <> new.agency_id or _domain.client_id <> new.client_id then
      raise exception 'domain_mismatch: Referenced domain belongs to a different agency/client';
    end if;
  end if;

  if new.social_channel_id is not null then
    select * into _channel from social_channels where id = new.social_channel_id;
    if not found or _channel.agency_id <> new.agency_id or _channel.client_id <> new.client_id then
      raise exception 'social_channel_mismatch: Referenced social channel belongs to a different agency/client';
    end if;
  end if;

  if new.business_listing_id is not null then
    select * into _listing from business_listings where id = new.business_listing_id;
    if not found or _listing.agency_id <> new.agency_id or _listing.client_id <> new.client_id then
      raise exception 'business_listing_mismatch: Referenced business listing belongs to a different agency/client';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists digital_assets_check_tenant_match_trg on digital_assets;
create trigger digital_assets_check_tenant_match_trg
  before insert or update on digital_assets
  for each row execute function digital_assets_check_tenant_match();

-- ── 4. ENABLE RLS ─────────────────────────────────────────────────────────────
alter table digital_assets enable row level security;

-- ── 5. RLS POLICIES ───────────────────────────────────────────────────────────
drop policy if exists "digital_assets_select" on digital_assets;
create policy "digital_assets_select" on digital_assets
  for select using (agency_id = public.current_agency_id());

drop policy if exists "digital_assets_insert" on digital_assets;
create policy "digital_assets_insert" on digital_assets
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "digital_assets_update" on digital_assets;
create policy "digital_assets_update" on digital_assets
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "digital_assets_delete" on digital_assets;
create policy "digital_assets_delete" on digital_assets
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on digital_assets to authenticated;

-- ── 6. VERIFICATION (informational) ──────────────────────────────────────────
-- select count(*) from digital_assets;
-- select conname from pg_constraint where conname = 'digital_assets_single_relation';
-- select tgname from pg_trigger where tgname = 'digital_assets_check_tenant_match_trg';
