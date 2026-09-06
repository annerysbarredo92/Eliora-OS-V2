/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 1: WEBSITES + DOMAINS
==============================================================
Purpose:      Canonical record of a client's owned websites and domains.
              This is NOT a website builder, DNS control panel, or hosting
              panel — it is the operational source of truth: what exists,
              who owns it, where it lives, and its health.

Scope note:   Only Website + Domain schema ships in this file. Full CRUD
              UI for these sections is Wave 2 — this file exists so Wave 2
              needs no schema migration, only application code.

Tenancy:      agency_id + client_id, matching every existing Business
              Workspace table (there is no separate "project" entity —
              the app's "project" workspace IS the client record).

Shared enums: website_type, digital_ownership_status, and
              digital_integration_status are defined here (file 1 of the
              deployment order) but are reused by later Digital tables —
              see 02/03 for social/listings/tracking, which depend on
              digital_ownership_status and digital_integration_status
              existing already.

Dependencies: Phases 01-02 (agencies, clients, profiles, current_agency_id(),
              is_agency_admin(), set_updated_at()) and the existing
              client_assets table (Wave 01 client delivery system) — not
              referenced directly here, but by 04-digital-assets.sql.
Execution:    01 → 02 → 03 → 04 → 05 → 06. Idempotent — safe to re-run.
==============================================================
*/

-- ── 1. SHARED ENUMS (used across multiple Digital tables) ────────────────────
-- manual:     agency/user entered this by hand; no external system involved.
-- configured: a property/account has been identified/entered in Eliora.
-- connected:  an external authorization/integration exists for it.
-- syncing:    provider synchronization is actively running.
-- live:       current provider data is available and fresh.
-- error:      integration needs attention (auth expired, sync failing, etc).
-- One shared enum instead of ad hoc per-table status text — avoids later
-- migrations to reconcile incompatible connection-state columns.
do $$ begin
  create type digital_integration_status as enum ('manual','configured','connected','syncing','live','error');
exception when duplicate_object then null; end $$;

-- Ownership/access to a digital property. Distinct from integration_status:
-- an agency can "own" (have credentials to) a website with no Eliora
-- integration configured at all.
do $$ begin
  create type digital_ownership_status as enum ('owned','shared_access','no_access','unknown');
exception when duplicate_object then null; end $$;

-- ── 2. WEBSITE ENUMS ──────────────────────────────────────────────────────────
do $$ begin
  create type website_type as enum ('primary_site','ecommerce','microsite','landing_page','secondary_brand','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type website_lifecycle_status as enum ('active','inactive','archived');
exception when duplicate_object then null; end $$;

-- ── 3. WEBSITES TABLE ─────────────────────────────────────────────────────────
-- A client may own MULTIPLE websites (ecommerce site, microsite, landing
-- page site, secondary brand site, ...). Exactly one may be is_primary —
-- enforced below by a partial unique index AND the set_primary_website()
-- RPC in 05-rpcs.sql (never trust frontend-only primary switching).
create table if not exists websites (
  id                  uuid                      primary key default uuid_generate_v4(),
  agency_id           uuid                      not null references agencies(id) on delete cascade,
  client_id           uuid                      not null references clients(id)  on delete cascade,

  name                text                      not null,
  url                 text,
  website_type        website_type              not null default 'primary_site',
  platform_cms        text,                     -- e.g. WordPress, Shopify, Webflow, custom-built
  hosting_provider    text,

  status              website_lifecycle_status  not null default 'active',
  ownership_status    digital_ownership_status  not null default 'unknown',
  integration_status  digital_integration_status not null default 'manual',
  is_primary          boolean                   not null default false,

  launch_date         date,
  notes               text,

  created_by          uuid                      references profiles(id) on delete set null,
  updated_by          uuid                      references profiles(id) on delete set null,
  created_at          timestamptz               not null default now(),
  updated_at          timestamptz               not null default now()
);

-- ── 4. WEBSITE INDEXES + PRIMARY INTEGRITY ───────────────────────────────────
create index if not exists websites_client_idx   on websites(client_id, status);
create index if not exists websites_agency_idx   on websites(agency_id, updated_at desc);

-- Database-level guarantee: at most one primary website per client, ever.
-- The set_primary_website() RPC (05-rpcs.sql) is the only supported way to
-- switch primary — it locks the client's website rows before flipping flags,
-- so two concurrent "make primary" calls cannot both succeed. This index is
-- the backstop if that RPC is ever bypassed.
create unique index if not exists websites_primary_unique_idx
  on websites(client_id)
  where is_primary;

-- ── 5. TRIGGER ────────────────────────────────────────────────────────────────
drop trigger if exists websites_set_updated_at on websites;
create trigger websites_set_updated_at
  before update on websites
  for each row execute function set_updated_at();

-- ── 6. ENABLE RLS ─────────────────────────────────────────────────────────────
alter table websites enable row level security;

-- ── 7. RLS POLICIES ───────────────────────────────────────────────────────────
-- Digital is an internal operational record, same posture as Business —
-- client portal users never get a policy here at all (no SELECT grant path
-- exists for the 'client_user' role; only agency-scoped policies below).
drop policy if exists "websites_select" on websites;
create policy "websites_select" on websites
  for select using (agency_id = public.current_agency_id());

drop policy if exists "websites_insert" on websites;
create policy "websites_insert" on websites
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "websites_update" on websites;
create policy "websites_update" on websites
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "websites_delete" on websites;
create policy "websites_delete" on websites
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on websites to authenticated;

-- ── 7b. TENANT-MATCH GUARD FOR website_id REFERENCES ─────────────────────────
-- A plain FK on website_id only proves the website row exists — it does NOT
-- prove it belongs to the same agency/client as the referencing row. Without
-- this, a domain (or tracking configuration, or SEO profile) belonging to
-- Client A could be pointed at a website belonging to Client B; ordinary FK
-- + RLS does not catch that, since RLS only filters what a query can SEE,
-- it does not validate cross-column consistency on write.
--
-- Reused by domains (below), and by tracking_configurations and seo_profiles
-- in 03-listings-seo-tracking.sql — every table with a website_id column
-- attaches this same trigger, so the check lives in exactly one place.
--
-- OWNERSHIP CONTRACT: this function is owned by THIS file (01). Later files
-- (02, 03, 04) may only CREATE TRIGGERs that execute it — they must never
-- DROP or CREATE OR REPLACE it themselves. It uses `create or replace` here,
-- which is always safe to re-run even with live dependent triggers (unlike
-- `drop function`, which fails with Postgres error 2BP01 — "cannot drop
-- function ... because other objects depend on it" — the moment any trigger
-- using it still exists). The only place this function is ever dropped is
-- rollback.sql, and only AFTER every table that could have a dependent
-- trigger has already been dropped.
create or replace function public.check_website_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _site websites;
begin
  if new.website_id is null then
    return new;
  end if;

  select * into _site from websites where id = new.website_id;
  if not found then
    raise exception 'website_not_found: Referenced website does not exist';
  end if;
  if _site.agency_id <> new.agency_id or _site.client_id <> new.client_id then
    raise exception 'website_tenant_mismatch: Referenced website belongs to a different agency/client';
  end if;

  return new;
end;
$$;

-- ── 8. DOMAIN ENUMS ───────────────────────────────────────────────────────────
do $$ begin
  create type domain_lifecycle_status as enum ('active','expired','transferring','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type domain_ssl_status as enum ('valid','invalid','none','unknown');
exception when duplicate_object then null; end $$;

-- ── 9. DOMAINS TABLE ──────────────────────────────────────────────────────────
-- Digital tracks domains operationally — not a registrar/DNS control panel.
-- Domain → Website is a real FK (nullable: a domain can exist unassigned,
-- e.g. a defensively-registered domain not yet pointed anywhere).
create table if not exists domains (
  id                  uuid                     primary key default uuid_generate_v4(),
  agency_id           uuid                     not null references agencies(id) on delete cascade,
  client_id           uuid                     not null references clients(id)  on delete cascade,
  website_id          uuid                     references websites(id) on delete set null,

  domain_name         text                     not null,
  registrar           text,
  dns_provider         text,

  registration_date   date,
  expiration_date      date,
  auto_renew          boolean                  not null default false,

  ssl_status          domain_ssl_status        not null default 'unknown',
  ssl_expiration_date date,

  status              domain_lifecycle_status  not null default 'active',
  notes               text,

  created_by          uuid                     references profiles(id) on delete set null,
  updated_by          uuid                     references profiles(id) on delete set null,
  created_at          timestamptz              not null default now(),
  updated_at          timestamptz              not null default now()
);

-- One domain name per client (case-insensitive) — prevents accidental
-- duplicate entry, not a cross-client uniqueness rule (a domain the agency
-- manages for two different clients is out of scope for Wave 1 and would
-- need its own reconciliation flow if it ever comes up).
create unique index if not exists domains_client_name_idx
  on domains(client_id, lower(domain_name));

create index if not exists domains_client_idx      on domains(client_id, status);
create index if not exists domains_agency_idx      on domains(agency_id, updated_at desc);
create index if not exists domains_website_idx     on domains(website_id) where website_id is not null;
create index if not exists domains_expiration_idx  on domains(expiration_date) where expiration_date is not null;

drop trigger if exists domains_set_updated_at on domains;
create trigger domains_set_updated_at
  before update on domains
  for each row execute function set_updated_at();

-- Enforces domains.agency_id = websites.agency_id AND domains.client_id =
-- websites.client_id whenever website_id is set. Reuses the function
-- defined immediately above — do not redefine or drop it here.
drop trigger if exists domains_check_website_tenant_match_trg on domains;
create trigger domains_check_website_tenant_match_trg
  before insert or update on domains
  for each row execute function check_website_tenant_match();

alter table domains enable row level security;

drop policy if exists "domains_select" on domains;
create policy "domains_select" on domains
  for select using (agency_id = public.current_agency_id());

drop policy if exists "domains_insert" on domains;
create policy "domains_insert" on domains
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "domains_update" on domains;
create policy "domains_update" on domains
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "domains_delete" on domains;
create policy "domains_delete" on domains
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on domains to authenticated;

-- ── 10. VERIFICATION (informational — see 06-verify-wave-1.sql for the full set) ──
-- select count(*) from websites;
-- select count(*) from domains;
-- select indexname from pg_indexes where tablename = 'websites' and indexname = 'websites_primary_unique_idx';
-- select tgname from pg_trigger where tgname = 'domains_check_website_tenant_match_trg';
