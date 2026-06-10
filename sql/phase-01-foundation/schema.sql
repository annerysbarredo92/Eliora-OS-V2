/*
--------------------------------------------------
FILE:    schema.sql
PHASE:   phase-01-foundation
PURPOSE: Core auth, profiles, multi-tenancy, and base enums
STATUS:  Ready — run first

WHEN TO RUN:
  Before any other phase. One-time migration on new Supabase project.

WHAT IT CHANGES:
  - Creates enums: user_role, portal_type, plan_type
  - Creates table: agencies
  - Creates table: profiles (extends auth.users)
  - Enables RLS on all tables
  - Creates updated_at triggers
--------------------------------------------------
*/

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ───────────────────────────────────────────────────────────────────
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

create type plan_type as enum (
  'starter',
  'growth',
  'scale',
  'enterprise'
);

-- ── updated_at trigger function ──────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── agencies ────────────────────────────────────────────────────────────────
create table if not exists agencies (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  slug                 text unique not null,
  logo_url             text,
  plan                 plan_type not null default 'starter',
  owner_id             uuid,                  -- fk to auth.users, set after profile created
  onboarding_step      int not null default 1,
  onboarding_complete  boolean not null default false,
  settings             jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger agencies_updated_at
  before update on agencies
  for each row execute function set_updated_at();

alter table agencies enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth.user. Created by a trigger on auth.users insert.
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  role                 user_role not null default 'pending',
  agency_id            uuid references agencies(id) on delete set null,
  client_id            uuid,                  -- fk to clients (added in phase-04)
  display_name         text not null default '',
  avatar_url           text,
  avatar_initials      text not null default '',
  department           text,
  job_title            text,
  is_active            boolean not null default true,
  onboarding_complete  boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

-- ── Auto-create profile on signup ────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
declare
  _display_name text;
  _agency_name  text;
  _agency_id    uuid;
  _initials     text;
begin
  _display_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));
  _agency_name  := coalesce(new.raw_user_meta_data->>'agency_name', _display_name || '''s Agency');

  -- Create the agency for agency_owner signups
  if coalesce(new.raw_user_meta_data->>'role', 'agency_owner') = 'agency_owner' then
    insert into agencies (name, slug, owner_id)
    values (
      _agency_name,
      lower(regexp_replace(_agency_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(new.id::text, 1, 8),
      new.id
    )
    returning id into _agency_id;
  end if;

  -- Compute initials
  _initials := upper(
    substr(_display_name, 1, 1) ||
    coalesce(substr(split_part(_display_name, ' ', 2), 1, 1), '')
  );

  insert into profiles (id, email, role, agency_id, display_name, avatar_initials)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'agency_owner')::user_role,
    _agency_id,
    _display_name,
    _initials
  );

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
