/*
==============================================================
ELIORA OS — PHASE 02: AGENCY CORE
==============================================================
File to paste into Supabase SQL Editor: phase.sql
Then verify with: verification.sql

Requires Phase 01 to be installed first (agencies, profiles,
current_agency_id(), current_user_role()).

This file is FULLY IDEMPOTENT — safe to paste and re-run any
number of times. Re-running repairs an existing install.

Installs:
  1. Enums (client_status, client_health, invitation_status)
  2. Tables
       - clients
       - client_contacts
       - client_users
       - client_invitations
       - activity_logs
       - team_assignments
  3. Indexes
  4. updated_at triggers + last-activity trigger
  5. SECURITY DEFINER access helpers (is_agency_admin, is_assigned_to_client)
  6. RLS enablement
  7. RLS policies (agency isolation + role rules)
  8. Grants
==============================================================
*/


-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────

do $$ begin
  create type client_status as enum ('active', 'onboarding', 'paused', 'archived', 'lead');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_health as enum ('healthy', 'at_risk', 'critical', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
exception when duplicate_object then null; end $$;


-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- clients ───────────────────────────────────────────────────────────────────
create table if not exists clients (
  id               uuid          primary key default uuid_generate_v4(),
  agency_id        uuid          not null references agencies(id) on delete cascade,
  business_name    text          not null,
  industry         text,
  website          text,
  business_phone   text,
  business_address text,
  status           client_status not null default 'active',
  health           client_health not null default 'unknown',   -- placeholder (Phase 03+)
  package_name     text,                                        -- placeholder (Phase 10)
  portal_enabled   boolean       not null default false,        -- portal status placeholder
  internal_notes   text,
  last_activity_at timestamptz,
  created_by       uuid          references profiles(id) on delete set null,
  updated_by       uuid          references profiles(id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

-- client_contacts ───────────────────────────────────────────────────────────
create table if not exists client_contacts (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  first_name  text        not null default '',
  last_name   text        not null default '',
  email       text,
  phone       text,
  title       text,
  is_primary  boolean     not null default false,
  created_by  uuid        references profiles(id) on delete set null,
  updated_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- client_users (links auth users with role client_user to a client) ──────────
create table if not exists client_users (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  profile_id  uuid        references profiles(id) on delete set null,
  email       text        not null,
  status      text        not null default 'active',
  created_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, email)
);

-- client_invitations (portal invite placeholder) ─────────────────────────────
create table if not exists client_invitations (
  id          uuid              primary key default uuid_generate_v4(),
  agency_id   uuid              not null references agencies(id) on delete cascade,
  client_id   uuid              not null references clients(id) on delete cascade,
  email       text              not null,
  token       text              not null unique default replace(uuid_generate_v4()::text, '-', ''),
  status      invitation_status not null default 'pending',
  invited_by  uuid              references profiles(id) on delete set null,
  expires_at  timestamptz,
  accepted_at timestamptz,
  created_at  timestamptz       not null default now(),
  updated_at  timestamptz       not null default now()
);

-- activity_logs (append-only) ────────────────────────────────────────────────
create table if not exists activity_logs (
  id               uuid        primary key default uuid_generate_v4(),
  agency_id        uuid        not null references agencies(id) on delete cascade,
  client_id        uuid        references clients(id) on delete set null,
  actor_profile_id uuid        references profiles(id) on delete set null,
  action           text        not null,
  entity_type      text        not null,
  entity_id        uuid,
  description      text,
  metadata         jsonb       not null default '{}',
  created_at       timestamptz not null default now()
);

-- team_assignments (which team members can access which clients) ─────────────
create table if not exists team_assignments (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  profile_id  uuid        not null references profiles(id) on delete cascade,
  role        text,
  created_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, profile_id)
);


-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

create index if not exists clients_agency_idx            on clients(agency_id);
create index if not exists clients_status_idx            on clients(agency_id, status);
create index if not exists client_contacts_client_idx    on client_contacts(client_id);
create index if not exists client_contacts_agency_idx    on client_contacts(agency_id);
create index if not exists client_contacts_primary_idx   on client_contacts(client_id) where is_primary;
create index if not exists client_users_client_idx       on client_users(client_id);
create index if not exists client_users_agency_idx       on client_users(agency_id);
create index if not exists client_invitations_client_idx on client_invitations(client_id);
create index if not exists activity_logs_agency_idx      on activity_logs(agency_id, created_at desc);
create index if not exists activity_logs_client_idx      on activity_logs(client_id, created_at desc);
create index if not exists team_assignments_profile_idx  on team_assignments(profile_id);
create index if not exists team_assignments_client_idx   on team_assignments(client_id);


-- ── 4. TRIGGERS ───────────────────────────────────────────────────────────────
-- set_updated_at() is defined in Phase 01.

drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at
  before update on clients for each row execute function set_updated_at();

drop trigger if exists client_contacts_set_updated_at on client_contacts;
create trigger client_contacts_set_updated_at
  before update on client_contacts for each row execute function set_updated_at();

drop trigger if exists client_users_set_updated_at on client_users;
create trigger client_users_set_updated_at
  before update on client_users for each row execute function set_updated_at();

drop trigger if exists client_invitations_set_updated_at on client_invitations;
create trigger client_invitations_set_updated_at
  before update on client_invitations for each row execute function set_updated_at();

drop trigger if exists team_assignments_set_updated_at on team_assignments;
create trigger team_assignments_set_updated_at
  before update on team_assignments for each row execute function set_updated_at();

-- Keep clients.last_activity_at fresh whenever an activity row is written for it.
create or replace function bump_client_last_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null then
    update clients set last_activity_at = new.created_at where id = new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists activity_logs_bump_client on activity_logs;
create trigger activity_logs_bump_client
  after insert on activity_logs for each row execute function bump_client_last_activity();


-- ── 5. ACCESS HELPERS (SECURITY DEFINER — avoid RLS recursion) ────────────────

-- True when the caller is an agency-admin-tier role.
create or replace function public.is_agency_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid())
      in ('master_admin', 'agency_owner', 'admin'),
    false
  );
$$;

-- True when the caller is explicitly assigned to a given client.
create or replace function public.is_assigned_to_client(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_assignments
    where client_id = _client_id and profile_id = auth.uid()
  );
$$;


-- ── 6. ENABLE RLS ─────────────────────────────────────────────────────────────

alter table clients            enable row level security;
alter table client_contacts    enable row level security;
alter table client_users       enable row level security;
alter table client_invitations enable row level security;
alter table activity_logs      enable row level security;
alter table team_assignments   enable row level security;


-- ── 7. RLS POLICIES ───────────────────────────────────────────────────────────
-- Rule of thumb:
--   * Everything is hard-scoped to the caller's agency (current_agency_id()).
--   * Admin-tier roles get full agency access.
--   * team_member sees only assigned clients (is_assigned_to_client).
--   * Writes are restricted to admin-tier roles in Phase 02.
--   * client_user has NO agency_id, so current_agency_id() is null and every
--     policy below fails closed for them — they can never read the Client Center.

-- clients ─────────────────────────────────────────────────────────────────────
drop policy if exists "clients_select" on clients;
create policy "clients_select" on clients for select
  using (
    agency_id = public.current_agency_id()
    and (public.is_agency_admin() or public.is_assigned_to_client(id))
  );

drop policy if exists "clients_insert" on clients;
create policy "clients_insert" on clients for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "clients_update" on clients;
create policy "clients_update" on clients for update
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- client_contacts ─────────────────────────────────────────────────────────────
drop policy if exists "client_contacts_select" on client_contacts;
create policy "client_contacts_select" on client_contacts for select
  using (
    agency_id = public.current_agency_id()
    and (public.is_agency_admin() or public.is_assigned_to_client(client_id))
  );

drop policy if exists "client_contacts_write" on client_contacts;
create policy "client_contacts_write" on client_contacts for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- client_users ────────────────────────────────────────────────────────────────
drop policy if exists "client_users_select" on client_users;
create policy "client_users_select" on client_users for select
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "client_users_write" on client_users;
create policy "client_users_write" on client_users for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- client_invitations ──────────────────────────────────────────────────────────
drop policy if exists "client_invitations_select" on client_invitations;
create policy "client_invitations_select" on client_invitations for select
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "client_invitations_write" on client_invitations;
create policy "client_invitations_write" on client_invitations for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- activity_logs (append-only: select + insert, no update/delete) ──────────────
drop policy if exists "activity_logs_select" on activity_logs;
create policy "activity_logs_select" on activity_logs for select
  using (
    agency_id = public.current_agency_id()
    and (
      public.is_agency_admin()
      or client_id is null
      or public.is_assigned_to_client(client_id)
    )
  );

drop policy if exists "activity_logs_insert" on activity_logs;
create policy "activity_logs_insert" on activity_logs for insert
  with check (
    agency_id = public.current_agency_id()
    and actor_profile_id = auth.uid()
  );

-- team_assignments ────────────────────────────────────────────────────────────
drop policy if exists "team_assignments_select" on team_assignments;
create policy "team_assignments_select" on team_assignments for select
  using (
    agency_id = public.current_agency_id()
    and (public.is_agency_admin() or profile_id = auth.uid())
  );

drop policy if exists "team_assignments_write" on team_assignments;
create policy "team_assignments_write" on team_assignments for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());


-- ── 8. GRANTS ─────────────────────────────────────────────────────────────────
-- RLS still governs which rows are visible; grants just open the API surface.

grant select, insert, update on clients            to authenticated;
grant select, insert, update on client_contacts    to authenticated;
grant select, insert, update on client_users       to authenticated;
grant select, insert, update on client_invitations to authenticated;
grant select, insert         on activity_logs      to authenticated;
grant select, insert, update on team_assignments   to authenticated;

grant execute on function public.is_agency_admin()           to anon, authenticated;
grant execute on function public.is_assigned_to_client(uuid) to anon, authenticated;
