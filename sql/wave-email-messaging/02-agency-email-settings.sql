-- ============================================================
-- Wave: Email Messaging — Step 02  (CANONICAL / FINAL)
-- Per-agency email sender configuration.
--
-- Auto-provisioned when an agency is created (trigger).
-- Agencies can edit via Settings → Communication.
-- Eliora owns the sending domain — agencies never touch Resend.
--
-- Schema version: final (no provider, no shared_from_email,
-- no sender_email, no domain_verified)
--
-- Safe to run multiple times (idempotent).
-- Paste into: Supabase SQL Editor
-- Run AFTER: 01-email-tables.sql
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────
create table if not exists agency_email_settings (
  id                   uuid        primary key default uuid_generate_v4(),
  agency_id            uuid        not null unique references agencies(id) on delete cascade,
  sender_name          text        not null default '',
  reply_to_email       text,
  email_signature      text,
  email_mode           text        not null default 'shared',
  sending_enabled      boolean     not null default false,
  custom_sender_email  text,
  custom_domain_status text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Align schema for existing deployments ────────────────────
-- Add columns introduced after the initial table creation:
alter table agency_email_settings
  add column if not exists email_signature      text,
  add column if not exists email_mode           text not null default 'shared',
  add column if not exists custom_sender_email  text,
  add column if not exists custom_domain_status text;

-- Remove columns that should not exist in the final schema:
alter table agency_email_settings drop column if exists sender_email;
alter table agency_email_settings drop column if exists domain_verified;
alter table agency_email_settings drop column if exists provider;
alter table agency_email_settings drop column if exists shared_from_email;

-- Add email_mode check constraint (idempotent via DO block):
do $$ begin
  alter table agency_email_settings
    add constraint agency_email_settings_email_mode_check
    check (email_mode in ('shared', 'custom'));
exception when duplicate_object then null; end $$;

-- Strip empty-string reply_to values from any old rows:
update agency_email_settings
  set reply_to_email = null
  where reply_to_email = '';

-- ── updated_at trigger ────────────────────────────────────────
create or replace function touch_agency_email_settings_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_agency_email_settings_updated_at on agency_email_settings;
create trigger trg_agency_email_settings_updated_at
  before update on agency_email_settings
  for each row execute function touch_agency_email_settings_updated_at();

-- ── Auto-provision trigger ────────────────────────────────────
-- Fires after every INSERT on agencies.
-- Creates a default email settings row so agencies can send
-- email immediately without manual setup.
--
-- Defaults:
--   sender_name     = agency.name
--   reply_to_email  = owner profile email
--   email_signature = "Owner Name · Agency Name" (or just agency name)
--   sending_enabled = true if owner email exists, false otherwise
--
-- SECURITY DEFINER so it can read profiles regardless of caller.

create or replace function provision_agency_email_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner_email   text;
  _owner_name    text;
  _sig           text;
  _send_enabled  boolean;
begin
  select email, display_name
  into   _owner_email, _owner_name
  from   profiles
  where  id = NEW.owner_id;

  _sig := case
    when _owner_name is not null and NEW.name is not null
    then _owner_name || ' · ' || NEW.name
    when NEW.name is not null
    then NEW.name
    else null
  end;

  _send_enabled := (_owner_email is not null);

  insert into agency_email_settings (
    agency_id,
    sender_name,
    reply_to_email,
    email_signature,
    email_mode,
    sending_enabled
  ) values (
    NEW.id,
    coalesce(nullif(trim(NEW.name), ''), 'Your Agency'),
    _owner_email,
    _sig,
    'shared',
    _send_enabled
  )
  on conflict (agency_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_provision_agency_email_settings on agencies;
create trigger trg_provision_agency_email_settings
  after insert on agencies
  for each row execute function provision_agency_email_settings();

-- ── Index ─────────────────────────────────────────────────────
create index if not exists agency_email_settings_agency_idx
  on agency_email_settings(agency_id);

-- ── RLS ───────────────────────────────────────────────────────
alter table agency_email_settings enable row level security;

drop policy if exists "Agency members can read email settings"   on agency_email_settings;
drop policy if exists "Agency members can insert email settings" on agency_email_settings;
drop policy if exists "Agency members can update email settings" on agency_email_settings;

create policy "Agency members can read email settings"
  on agency_email_settings for select
  using (agency_id = public.current_agency_id());

create policy "Agency members can insert email settings"
  on agency_email_settings for insert
  with check (agency_id = public.current_agency_id());

create policy "Agency members can update email settings"
  on agency_email_settings for update
  using (agency_id = public.current_agency_id());

-- ── Grants ────────────────────────────────────────────────────
grant select, insert, update on agency_email_settings to authenticated;

-- ── Backfill: existing agencies created before this migration ─
-- This INSERT runs once. Agencies created after migration get
-- a row via the trigger above.
insert into agency_email_settings (
  agency_id,
  sender_name,
  reply_to_email,
  email_signature,
  email_mode,
  sending_enabled
)
select
  a.id,
  coalesce(nullif(trim(a.name), ''), 'Your Agency'),
  p.email,
  case
    when p.display_name is not null then p.display_name || ' · ' || a.name
    else a.name
  end,
  'shared',
  (p.email is not null)
from   agencies a
left   join profiles p on p.id = a.owner_id
where  not exists (
  select 1 from agency_email_settings s where s.agency_id = a.id
);
