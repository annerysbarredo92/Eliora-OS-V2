/*
==============================================================
ELIORA OS — PHASE 04: CLIENT PORTAL FOUNDATION
==============================================================
File to paste into Supabase SQL Editor: phase.sql
Then verify with: verification.sql

Requires Phases 01–03.

This file is FULLY IDEMPOTENT — safe to paste and re-run.

Installs:
  1. Helper changes
       - current_agency_id() now EXCLUDES client_user (locks clients out of
         every agency table automatically)
       - current_client_id()  — the caller's own client account
       - caller_agency_id()   — role-agnostic agency (so a client can read its
         agency's name/logo)
  2. Tables
       - client_users (ensured)
       - client_profiles
       - client_portal_settings
       - client_portal_access
       - client_onboarding_progress
  3. Indexes, updated_at triggers
  4. ensure_client_portal() — bootstraps a client's portal rows + logs access
  5. RLS enablement + policies (agency admins AND the client's own users)
  6. activity_logs policy update so client users can read/write their own activity
  7. agencies policy so a client can read its own agency
  8. Grants
==============================================================
*/


-- ── 1. HELPER FUNCTIONS ───────────────────────────────────────────────────────

-- IMPORTANT: client_user must NEVER see agency data. By excluding that role here,
-- current_agency_id() returns NULL for client users, so every agency-table policy
-- (Phases 01–03) that keys on current_agency_id() fails closed for them.
create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.profiles
  where id = auth.uid() and role <> 'client_user';
$$;

-- The caller's own client account (null for agency users).
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- Role-agnostic agency id (works for client users too) — used only to let a
-- client read its own agency row for branding.
create or replace function public.caller_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.profiles where id = auth.uid();
$$;


-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- client_users — links an auth user (role client_user) to a client account.
-- Created in Phase 02; ensured here so this file is self-sufficient.
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

-- client_profiles — the client-maintained company/brand profile (1 per client).
create table if not exists client_profiles (
  id                   uuid        primary key default uuid_generate_v4(),
  agency_id            uuid        not null references agencies(id) on delete cascade,
  client_id            uuid        not null unique references clients(id) on delete cascade,
  -- Company Information
  company_name         text,
  company_size         text,
  industry             text,
  website              text,
  business_phone       text,
  business_address     text,
  -- Primary Contact
  contact_name         text,
  contact_email        text,
  contact_phone        text,
  contact_title        text,
  -- Brand Information
  brand_colors         jsonb       not null default '[]',
  brand_voice          text,
  logo_url             text,
  brand_notes          text,
  -- Social Media Accounts (e.g. {"instagram":"@x","facebook":"..."} )
  social_accounts      jsonb       not null default '{}',
  -- Business Goals
  business_goals       text,
  target_audience      text,
  created_by           uuid        references profiles(id) on delete set null,
  updated_by           uuid        references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- client_portal_settings — communication / approval / notification prefs (1 per client).
create table if not exists client_portal_settings (
  id                       uuid        primary key default uuid_generate_v4(),
  agency_id                uuid        not null references agencies(id) on delete cascade,
  client_id                uuid        not null unique references clients(id) on delete cascade,
  -- Communication Preferences
  communication_channel    text        not null default 'email',
  communication_frequency  text        not null default 'weekly',
  communication_notes      text,
  -- Approval Preferences
  approval_workflow        text        not null default 'single',
  approval_turnaround      text        not null default '48h',
  approver_name            text,
  -- Notification Preferences
  notify_email             boolean     not null default true,
  notify_content           boolean     not null default true,
  notify_reports           boolean     not null default true,
  notify_messages          boolean     not null default true,
  timezone                 text        not null default 'America/New_York',
  created_by               uuid        references profiles(id) on delete set null,
  updated_by               uuid        references profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- client_portal_access — per (client, user) access record + first/last access.
create table if not exists client_portal_access (
  id               uuid        primary key default uuid_generate_v4(),
  agency_id        uuid        not null references agencies(id) on delete cascade,
  client_id        uuid        not null references clients(id) on delete cascade,
  user_id          uuid        not null references profiles(id) on delete cascade,
  status           text        not null default 'active',
  first_accessed_at timestamptz,
  last_accessed_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (client_id, user_id)
);

-- client_onboarding_progress — section completion map + percentage (1 per client).
create table if not exists client_onboarding_progress (
  id              uuid        primary key default uuid_generate_v4(),
  agency_id       uuid        not null references agencies(id) on delete cascade,
  client_id       uuid        not null unique references clients(id) on delete cascade,
  sections        jsonb       not null default '{}',
  completion_pct  smallint    not null default 0,
  skipped         boolean     not null default false,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);


-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

create index if not exists client_users_profile_idx        on client_users(profile_id);
create index if not exists client_profiles_agency_idx       on client_profiles(agency_id);
create index if not exists client_portal_settings_agency_idx on client_portal_settings(agency_id);
create index if not exists client_portal_access_user_idx    on client_portal_access(user_id);
create index if not exists client_portal_access_client_idx  on client_portal_access(client_id);
create index if not exists client_onboarding_agency_idx     on client_onboarding_progress(agency_id);


-- ── 4. updated_at TRIGGERS ────────────────────────────────────────────────────

drop trigger if exists client_profiles_set_updated_at on client_profiles;
create trigger client_profiles_set_updated_at before update on client_profiles
  for each row execute function set_updated_at();

drop trigger if exists client_portal_settings_set_updated_at on client_portal_settings;
create trigger client_portal_settings_set_updated_at before update on client_portal_settings
  for each row execute function set_updated_at();

drop trigger if exists client_portal_access_set_updated_at on client_portal_access;
create trigger client_portal_access_set_updated_at before update on client_portal_access
  for each row execute function set_updated_at();

drop trigger if exists client_onboarding_progress_set_updated_at on client_onboarding_progress;
create trigger client_onboarding_progress_set_updated_at before update on client_onboarding_progress
  for each row execute function set_updated_at();


-- ── 5. BOOTSTRAP FUNCTION ─────────────────────────────────────────────────────
-- Ensures portal rows exist for a client and records access. Callable by the
-- client's own user OR an agency admin of that client's agency.

create or replace function ensure_client_portal(_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _agency_id uuid;
  _is_owner  boolean;
  _is_admin  boolean;
begin
  if _client_id is null then
    raise exception 'client id required';
  end if;

  select agency_id into _agency_id from clients where id = _client_id;
  if _agency_id is null then
    raise exception 'client not found';
  end if;

  _is_owner := (_client_id = (select client_id from profiles where id = auth.uid()));
  _is_admin := public.is_agency_admin() and _agency_id = public.current_agency_id();

  if not (_is_owner or _is_admin) then
    raise exception 'not authorized for this client portal';
  end if;

  -- Seed the client profile from the agency-entered client + primary contact.
  insert into client_profiles (
    agency_id, client_id, company_name, industry, website,
    business_phone, business_address, contact_name, contact_email, contact_phone
  )
  select
    _agency_id, _client_id, c.business_name, c.industry, c.website,
    c.business_phone, c.business_address,
    nullif(trim(coalesce(pc.first_name, '') || ' ' || coalesce(pc.last_name, '')), ''),
    pc.email, pc.phone
  from clients c
  left join lateral (
    select * from client_contacts cc
    where cc.client_id = _client_id
    order by cc.is_primary desc, cc.created_at asc
    limit 1
  ) pc on true
  where c.id = _client_id
  on conflict (client_id) do nothing;

  insert into client_portal_settings (agency_id, client_id)
  values (_agency_id, _client_id) on conflict (client_id) do nothing;

  insert into client_onboarding_progress (agency_id, client_id)
  values (_agency_id, _client_id) on conflict (client_id) do nothing;

  -- Record access for the calling user (only meaningful for client users).
  if _is_owner then
    insert into client_portal_access (agency_id, client_id, user_id, first_accessed_at, last_accessed_at)
    values (_agency_id, _client_id, auth.uid(), now(), now())
    on conflict (client_id, user_id) do update set last_accessed_at = now();
  end if;
end;
$$;


-- ── 6. ENABLE RLS ─────────────────────────────────────────────────────────────

alter table client_users               enable row level security;
alter table client_profiles            enable row level security;
alter table client_portal_settings     enable row level security;
alter table client_portal_access       enable row level security;
alter table client_onboarding_progress enable row level security;


-- ── 7. RLS POLICIES ───────────────────────────────────────────────────────────
-- Read: agency admin/assigned-team for the client's agency, OR the client's own user.
-- Write: agency admin, OR the client's own user (self-service onboarding/settings).

-- client_users (extend Phase 02 admin policies with a client self-read)
drop policy if exists "client_users_self_select" on client_users;
create policy "client_users_self_select" on client_users for select
  using (client_id = public.current_client_id());

-- helper expressions repeated per table -----------------------------------------
-- read  : (agency_id = current_agency_id() and (is_agency_admin() or is_assigned_to_client(client_id))) or client_id = current_client_id()
-- write : (agency_id = current_agency_id() and is_agency_admin()) or client_id = current_client_id()

-- client_profiles
drop policy if exists "client_profiles_select" on client_profiles;
create policy "client_profiles_select" on client_profiles for select
  using (
    (agency_id = public.current_agency_id() and (public.is_agency_admin() or public.is_assigned_to_client(client_id)))
    or client_id = public.current_client_id()
  );
drop policy if exists "client_profiles_write" on client_profiles;
create policy "client_profiles_write" on client_profiles for all
  using (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or client_id = public.current_client_id()
  )
  with check (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or client_id = public.current_client_id()
  );

-- client_portal_settings
drop policy if exists "client_portal_settings_select" on client_portal_settings;
create policy "client_portal_settings_select" on client_portal_settings for select
  using (
    (agency_id = public.current_agency_id() and (public.is_agency_admin() or public.is_assigned_to_client(client_id)))
    or client_id = public.current_client_id()
  );
drop policy if exists "client_portal_settings_write" on client_portal_settings;
create policy "client_portal_settings_write" on client_portal_settings for all
  using (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or client_id = public.current_client_id()
  )
  with check (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or client_id = public.current_client_id()
  );

-- client_portal_access
drop policy if exists "client_portal_access_select" on client_portal_access;
create policy "client_portal_access_select" on client_portal_access for select
  using (
    (agency_id = public.current_agency_id() and (public.is_agency_admin() or public.is_assigned_to_client(client_id)))
    or client_id = public.current_client_id()
  );
drop policy if exists "client_portal_access_write" on client_portal_access;
create policy "client_portal_access_write" on client_portal_access for all
  using (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or user_id = auth.uid()
  )
  with check (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or user_id = auth.uid()
  );

-- client_onboarding_progress
drop policy if exists "client_onboarding_select" on client_onboarding_progress;
create policy "client_onboarding_select" on client_onboarding_progress for select
  using (
    (agency_id = public.current_agency_id() and (public.is_agency_admin() or public.is_assigned_to_client(client_id)))
    or client_id = public.current_client_id()
  );
drop policy if exists "client_onboarding_write" on client_onboarding_progress;
create policy "client_onboarding_write" on client_onboarding_progress for all
  using (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or client_id = public.current_client_id()
  )
  with check (
    (agency_id = public.current_agency_id() and public.is_agency_admin())
    or client_id = public.current_client_id()
  );


-- ── 8. CROSS-PHASE POLICY UPDATES ─────────────────────────────────────────────

-- activity_logs: let a client user read + write activity for their own client.
drop policy if exists "activity_logs_select" on activity_logs;
create policy "activity_logs_select" on activity_logs for select
  using (
    (agency_id = public.current_agency_id()
      and (public.is_agency_admin() or client_id is null or public.is_assigned_to_client(client_id)))
    or client_id = public.current_client_id()
  );

drop policy if exists "activity_logs_insert" on activity_logs;
create policy "activity_logs_insert" on activity_logs for insert
  with check (
    actor_profile_id = auth.uid()
    and (agency_id = public.current_agency_id() or client_id = public.current_client_id())
  );

-- agencies: let a client read its own agency row (name/logo for the portal).
drop policy if exists "Caller can read own agency" on agencies;
create policy "Caller can read own agency" on agencies for select
  using (id = public.caller_agency_id());


-- ── 9. GRANTS ─────────────────────────────────────────────────────────────────

grant select, insert, update on client_users               to authenticated;
grant select, insert, update on client_profiles            to authenticated;
grant select, insert, update on client_portal_settings     to authenticated;
grant select, insert, update on client_portal_access       to authenticated;
grant select, insert, update on client_onboarding_progress to authenticated;

grant execute on function public.current_client_id()        to anon, authenticated;
grant execute on function public.caller_agency_id()         to anon, authenticated;
grant execute on function public.ensure_client_portal(uuid) to authenticated;
