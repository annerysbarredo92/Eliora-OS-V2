/*
==============================================================
ELIORA OS — PHASE 01: FOUNDATION
==============================================================
File to paste into Supabase SQL Editor: phase.sql
Then verify with: verification.sql

This file is FULLY IDEMPOTENT — safe to paste and re-run any
number of times on the same project. Re-running will not error
on existing enums, triggers, or policies.

What this phase installs:
  1. Extensions
  2. Enums (user_role, plan_type)
  3. Shared functions (set_updated_at)
  4. Table: agencies
  5. Table: profiles
  6. Table: agency_settings
  7. Indexes
  8. RLS enablement
  9. SECURITY DEFINER helpers (avoid RLS recursion)
 10. RLS policies
 11. Signup trigger (auto-creates agency + profile + settings)
 12. Grants

Run this ONCE on a fresh Supabase project before any other phase.
(Re-running is safe and will repair an existing install.)
==============================================================
*/


-- ── 1. EXTENSIONS ─────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";


-- ── 2. ENUMS ──────────────────────────────────────────────────────────────────
-- Guarded so re-running the file does not error with "type already exists".

do $$ begin
  create type user_role as enum (
    'master_admin',
    'agency_owner',
    'admin',
    'content_manager',
    'strategist',
    'editor',
    'client_success',
    'contractor',
    'team_member',
    'client_user',
    'pending'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type plan_type as enum (
    'starter',
    'growth',
    'scale',
    'enterprise'
  );
exception when duplicate_object then null;
end $$;


-- ── 3. SHARED FUNCTIONS ───────────────────────────────────────────────────────

-- Automatically sets updated_at to now() on every update.
-- Reused by every table in every phase.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── 4. TABLE: agencies ────────────────────────────────────────────────────────
-- One row per agency (tenant). All agency-scoped tables reference this.

create table if not exists agencies (
  id                  uuid        primary key default uuid_generate_v4(),
  name                text        not null,
  slug                text        not null unique,
  logo_url            text,
  plan                plan_type   not null default 'starter',
  owner_id            uuid,       -- references auth.users; set during signup trigger
  onboarding_step     smallint    not null default 1,
  onboarding_complete boolean     not null default false,
  settings            jsonb       not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists agencies_set_updated_at on agencies;
create trigger agencies_set_updated_at
  before update on agencies
  for each row execute function set_updated_at();


-- ── 5. TABLE: profiles ────────────────────────────────────────────────────────
-- One row per auth.users row. Auto-created by the signup trigger below.
-- client_id column is a forward reference — populated in phase-04.

create table if not exists profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  email               text        not null,
  role                user_role   not null default 'pending',
  agency_id           uuid        references agencies(id) on delete set null,
  client_id           uuid,       -- populated in phase-04 for client_user rows
  display_name        text        not null default '',
  avatar_url          text,
  avatar_initials     text        not null default '',
  department          text,
  job_title           text,
  is_active           boolean     not null default true,
  onboarding_complete boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();


-- ── 6. TABLE: agency_settings ─────────────────────────────────────────────────
-- Key/value store for agency-level configuration.
-- Avoids bloating the agencies row with a large jsonb blob.

create table if not exists agency_settings (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  key         text        not null,
  value       jsonb       not null default 'null',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agency_id, key)
);

drop trigger if exists agency_settings_set_updated_at on agency_settings;
create trigger agency_settings_set_updated_at
  before update on agency_settings
  for each row execute function set_updated_at();


-- ── 7. INDEXES ────────────────────────────────────────────────────────────────

create index if not exists profiles_agency_id_idx    on profiles(agency_id);
create index if not exists profiles_role_idx          on profiles(role);
create index if not exists profiles_email_idx         on profiles(email);
create index if not exists agency_settings_agency_idx on agency_settings(agency_id);


-- ── 8. ENABLE RLS ─────────────────────────────────────────────────────────────

alter table agencies        enable row level security;
alter table profiles        enable row level security;
alter table agency_settings enable row level security;


-- ── 9. SECURITY DEFINER HELPERS ───────────────────────────────────────────────
-- CRITICAL: these read the caller's own profile WITHOUT triggering RLS.
--
-- Why this matters: a policy on `profiles` that subqueries `profiles`
-- (e.g. "read teammates in my agency") causes Postgres to re-evaluate the
-- same policy on the inner subquery, producing:
--     ERROR: infinite recursion detected in policy for relation "profiles"
-- That error makes EVERY profile read fail — which is what made signup appear
-- to succeed while login reported "Account not found".
--
-- By moving the "who am I / what agency am I in" lookup into a SECURITY DEFINER
-- function, the inner read bypasses RLS and the recursion disappears.

create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;


-- ── 10. RLS POLICIES ──────────────────────────────────────────────────────────
-- Dropped-then-recreated so the file is safe to re-run.

-- agencies ─────────────────────────────────────────────────────────────────────

drop policy if exists "Agency members can read own agency" on agencies;
create policy "Agency members can read own agency"
  on agencies for select
  using (id = public.current_agency_id());

drop policy if exists "Agency owner can update agency" on agencies;
create policy "Agency owner can update agency"
  on agencies for update
  using (owner_id = auth.uid());

-- profiles ─────────────────────────────────────────────────────────────────────

-- Every user can always read their own profile.
-- (This single policy is what login + session bootstrap rely on.)
drop policy if exists "User can read own profile" on profiles;
create policy "User can read own profile"
  on profiles for select
  using (id = auth.uid());

-- Every user can update their own profile.
drop policy if exists "User can update own profile" on profiles;
create policy "User can update own profile"
  on profiles for update
  using (id = auth.uid());

-- Agency members can read other profiles within the same agency.
-- Uses current_agency_id() (SECURITY DEFINER) to avoid RLS recursion.
drop policy if exists "Agency members can read team profiles" on profiles;
create policy "Agency members can read team profiles"
  on profiles for select
  using (
    agency_id is not null
    and agency_id = public.current_agency_id()
  );

-- agency_settings ──────────────────────────────────────────────────────────────

drop policy if exists "Agency members can read agency settings" on agency_settings;
create policy "Agency members can read agency settings"
  on agency_settings for select
  using (agency_id = public.current_agency_id());

drop policy if exists "Agency admins can write agency settings" on agency_settings;
create policy "Agency admins can write agency settings"
  on agency_settings for all
  using (
    agency_id = public.current_agency_id()
    and public.current_user_role() in ('master_admin', 'agency_owner', 'admin')
  );


-- ── 11. SIGNUP TRIGGER ────────────────────────────────────────────────────────
-- Fires after every new row in auth.users.
-- For agency_owner signups: creates the agency, the profile, AND a default
-- agency_settings row, all inside the same transaction.
-- For all other signups: creates only the profile (agency_id assigned later).
--
-- SECURITY DEFINER + explicit search_path so it runs with the privileges needed
-- to write into public tables regardless of the calling role.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _display_name text;
  _agency_name  text;
  _agency_id    uuid;
  _role         user_role;
  _initials     text;
  _first        text;
  _second       text;
begin
  -- Resolve display name from metadata or fall back to email prefix
  _display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Resolve role from metadata, defaulting to agency_owner for self-signup
  begin
    _role := coalesce(new.raw_user_meta_data->>'role', 'agency_owner')::user_role;
  exception when invalid_text_representation then
    _role := 'agency_owner';
  end;

  -- Compute two-letter initials
  _first  := upper(substr(_display_name, 1, 1));
  _second := upper(substr(split_part(_display_name, ' ', 2), 1, 1));
  _initials := coalesce(nullif(_first || _second, ''), '?');

  -- For agency_owner: create the agency + default settings first
  if _role = 'agency_owner' then
    _agency_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'agency_name'), ''),
      _display_name || '''s Agency'
    );

    insert into agencies (name, slug, owner_id)
    values (
      _agency_name,
      -- Slug: lowercase, hyphens, unique suffix from user id
      lower(regexp_replace(trim(_agency_name), '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || substr(new.id::text, 1, 8),
      new.id
    )
    returning id into _agency_id;

    -- Seed a default agency_settings row so the agency is fully provisioned.
    insert into agency_settings (agency_id, key, value)
    values (_agency_id, 'onboarding', jsonb_build_object('step', 1, 'complete', false))
    on conflict (agency_id, key) do nothing;
  end if;

  -- Create the profile row
  insert into profiles (
    id, email, role, agency_id, display_name, avatar_initials
  )
  values (
    new.id,
    new.email,
    _role,
    _agency_id,
    _display_name,
    _initials
  );

  return new;
end;
$$;

-- Drop and recreate to avoid duplicate trigger errors on re-runs
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ── 12. GRANTS ────────────────────────────────────────────────────────────────
-- The anon and authenticated roles reach these tables through the API.
-- RLS policies control which rows each role can actually see.

grant usage on schema public to anon, authenticated;

grant select, insert, update on profiles        to authenticated;
grant select, insert, update on agencies        to authenticated;
grant select, insert, update on agency_settings to authenticated;

grant select on profiles to anon;
grant select on agencies to anon;

-- Allow the API roles to call the SECURITY DEFINER helpers used by policies.
grant execute on function public.current_agency_id()  to anon, authenticated;
grant execute on function public.current_user_role()  to anon, authenticated;
