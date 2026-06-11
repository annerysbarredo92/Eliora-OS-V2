/*
==============================================================
ELIORA OS — PHASE 03: AGENCY ONBOARDING & OPERATIONS
==============================================================
File to paste into Supabase SQL Editor: phase.sql
Then verify with: verification.sql

Requires Phases 01 + 02 (agencies, profiles, clients,
current_agency_id(), is_agency_admin()).

This file is FULLY IDEMPOTENT — safe to paste and re-run.

Installs:
  1. Enums (onboarding_step_status, billing_type, billing_frequency, template_type)
  2. Tables
       - agency_setup_steps
       - agency_onboarding_progress
       - services
       - packages
       - package_services
       - templates
       - agency_health_scores
  3. Indexes
  4. updated_at triggers
  5. Functions: recompute_agency_onboarding, seed_agency_setup, reconcile_agency_setup
     + onboarding-progress recompute trigger
  6. RLS enablement
  7. RLS policies (agency members read; admins write)
  8. Grants
==============================================================
*/


-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────

do $$ begin
  create type onboarding_step_status as enum ('not_started', 'in_progress', 'completed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type billing_type as enum ('one_time', 'monthly', 'quarterly', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type billing_frequency as enum ('one_time', 'monthly', 'quarterly', 'annual', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type template_type as enum ('proposal', 'invoice', 'report', 'content', 'onboarding', 'task', 'email');
exception when duplicate_object then null; end $$;


-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- agency_setup_steps (8 onboarding steps per agency) ─────────────────────────
create table if not exists agency_setup_steps (
  id           uuid                   primary key default uuid_generate_v4(),
  agency_id    uuid                   not null references agencies(id) on delete cascade,
  step_key     text                   not null,
  title        text                   not null,
  description  text,
  status       onboarding_step_status not null default 'not_started',
  sort_order   smallint               not null default 0,
  completed_at timestamptz,
  created_at   timestamptz            not null default now(),
  updated_at   timestamptz            not null default now(),
  unique (agency_id, step_key)
);

-- agency_onboarding_progress (one summary row per agency) ─────────────────────
create table if not exists agency_onboarding_progress (
  id              uuid        primary key default uuid_generate_v4(),
  agency_id       uuid        not null unique references agencies(id) on delete cascade,
  total_steps     smallint    not null default 0,
  completed_steps smallint    not null default 0,
  completion_pct  smallint    not null default 0,
  readiness_score smallint    not null default 0,
  skipped         boolean     not null default false,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- services ───────────────────────────────────────────────────────────────────
create table if not exists services (
  id            uuid         primary key default uuid_generate_v4(),
  agency_id     uuid         not null references agencies(id) on delete cascade,
  name          text         not null,
  category      text,
  description   text,
  price_cents   integer      not null default 0,
  billing_type  billing_type not null default 'monthly',
  is_active     boolean      not null default true,
  created_by    uuid         references profiles(id) on delete set null,
  updated_by    uuid         references profiles(id) on delete set null,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- packages ───────────────────────────────────────────────────────────────────
create table if not exists packages (
  id                uuid              primary key default uuid_generate_v4(),
  agency_id         uuid              not null references agencies(id) on delete cascade,
  name              text              not null,
  description       text,
  price_cents       integer           not null default 0,
  billing_frequency billing_frequency not null default 'monthly',
  is_active         boolean           not null default true,
  is_default        boolean           not null default false,
  created_by        uuid              references profiles(id) on delete set null,
  updated_by        uuid              references profiles(id) on delete set null,
  created_at        timestamptz       not null default now(),
  updated_at        timestamptz       not null default now()
);

-- One default package per agency.
create unique index if not exists packages_one_default_per_agency
  on packages(agency_id) where is_default;

-- package_services (join) ─────────────────────────────────────────────────────
create table if not exists package_services (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  package_id  uuid        not null references packages(id) on delete cascade,
  service_id  uuid        not null references services(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (package_id, service_id)
);

-- templates (shell; real table for future editor) ────────────────────────────
create table if not exists templates (
  id            uuid          primary key default uuid_generate_v4(),
  agency_id     uuid          not null references agencies(id) on delete cascade,
  template_type template_type not null,
  name          text          not null,
  description   text,
  content       jsonb         not null default '{}',
  is_active     boolean       not null default true,
  created_by    uuid          references profiles(id) on delete set null,
  updated_by    uuid          references profiles(id) on delete set null,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

-- agency_health_scores (shell; early metrics) ────────────────────────────────
create table if not exists agency_health_scores (
  id         uuid        primary key default uuid_generate_v4(),
  agency_id  uuid        not null references agencies(id) on delete cascade,
  metric_key text        not null,
  score      smallint    not null default 0,
  details    jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, metric_key)
);


-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

create index if not exists agency_setup_steps_agency_idx on agency_setup_steps(agency_id, sort_order);
create index if not exists services_agency_idx           on services(agency_id, is_active);
create index if not exists packages_agency_idx           on packages(agency_id, is_active);
create index if not exists package_services_pkg_idx      on package_services(package_id);
create index if not exists package_services_svc_idx      on package_services(service_id);
create index if not exists templates_agency_idx          on templates(agency_id, template_type);
create index if not exists agency_health_agency_idx      on agency_health_scores(agency_id);


-- ── 4. updated_at TRIGGERS ────────────────────────────────────────────────────

drop trigger if exists agency_setup_steps_set_updated_at on agency_setup_steps;
create trigger agency_setup_steps_set_updated_at before update on agency_setup_steps
  for each row execute function set_updated_at();

drop trigger if exists agency_onboarding_progress_set_updated_at on agency_onboarding_progress;
create trigger agency_onboarding_progress_set_updated_at before update on agency_onboarding_progress
  for each row execute function set_updated_at();

drop trigger if exists services_set_updated_at on services;
create trigger services_set_updated_at before update on services
  for each row execute function set_updated_at();

drop trigger if exists packages_set_updated_at on packages;
create trigger packages_set_updated_at before update on packages
  for each row execute function set_updated_at();

drop trigger if exists templates_set_updated_at on templates;
create trigger templates_set_updated_at before update on templates
  for each row execute function set_updated_at();

drop trigger if exists agency_health_scores_set_updated_at on agency_health_scores;
create trigger agency_health_scores_set_updated_at before update on agency_health_scores
  for each row execute function set_updated_at();


-- ── 5. ONBOARDING FUNCTIONS + PROGRESS TRIGGER ────────────────────────────────

-- Recompute the summary progress row for one agency from its setup steps.
create or replace function recompute_agency_onboarding(_agency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _total       int;
  _completed   int;
  _in_progress int;
  _pct         int;
  _readiness   int;
begin
  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'in_progress')
  into _total, _completed, _in_progress
  from agency_setup_steps
  where agency_id = _agency_id;

  if _total = 0 then
    _pct := 0; _readiness := 0;
  else
    _pct       := round(_completed::numeric / _total * 100);
    _readiness := round((_completed + _in_progress * 0.5) / _total * 100);
  end if;

  insert into agency_onboarding_progress
    (agency_id, total_steps, completed_steps, completion_pct, readiness_score, completed_at)
  values
    (_agency_id, _total, _completed, _pct, _readiness,
     case when _total > 0 and _completed = _total then now() else null end)
  on conflict (agency_id) do update set
    total_steps     = excluded.total_steps,
    completed_steps = excluded.completed_steps,
    completion_pct  = excluded.completion_pct,
    readiness_score = excluded.readiness_score,
    completed_at    = case when excluded.completed_steps = excluded.total_steps and excluded.total_steps > 0
                           then now() else null end,
    updated_at      = now();
end;
$$;

-- Fire recompute whenever a step changes.
create or replace function on_setup_step_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recompute_agency_onboarding(coalesce(new.agency_id, old.agency_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists agency_setup_steps_progress on agency_setup_steps;
create trigger agency_setup_steps_progress
  after insert or update or delete on agency_setup_steps
  for each row execute function on_setup_step_change();

-- Seed the 8 standard steps + progress row for the caller's agency. Idempotent.
create or replace function seed_agency_setup(_agency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _agency_id is null or _agency_id <> (select agency_id from profiles where id = auth.uid()) then
    raise exception 'not authorized for this agency';
  end if;

  insert into agency_setup_steps (agency_id, step_key, title, description, sort_order) values
    (_agency_id, 'company_profile', 'Company Profile',     'Add your agency name, contact details, and basics.',  1),
    (_agency_id, 'branding',        'Branding',            'Upload your logo and set your brand colors.',          2),
    (_agency_id, 'services',        'Services',            'Define the services your agency offers.',              3),
    (_agency_id, 'packages',        'Packages',            'Bundle services into packages clients can buy.',       4),
    (_agency_id, 'billing_setup',   'Billing Setup',       'Connect billing so you can invoice clients.',          5),
    (_agency_id, 'client_portal',   'Client Portal Setup', 'Configure the portal your clients will use.',          6),
    (_agency_id, 'first_client',    'First Client',        'Add your first client to the Client Center.',          7),
    (_agency_id, 'team_setup',      'Team Setup',          'Invite teammates and assign their roles.',             8)
  on conflict (agency_id, step_key) do nothing;

  insert into agency_onboarding_progress (agency_id)
  values (_agency_id)
  on conflict (agency_id) do nothing;

  perform recompute_agency_onboarding(_agency_id);
end;
$$;

-- Auto-complete data-derived steps (services / packages / first client).
create or replace function reconcile_agency_setup(_agency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _agency_id is null or _agency_id <> (select agency_id from profiles where id = auth.uid()) then
    raise exception 'not authorized for this agency';
  end if;

  if exists (select 1 from services where agency_id = _agency_id and is_active) then
    update agency_setup_steps set status = 'completed', completed_at = coalesce(completed_at, now())
    where agency_id = _agency_id and step_key = 'services' and status <> 'completed';
  end if;

  if exists (select 1 from packages where agency_id = _agency_id and is_active) then
    update agency_setup_steps set status = 'completed', completed_at = coalesce(completed_at, now())
    where agency_id = _agency_id and step_key = 'packages' and status <> 'completed';
  end if;

  if exists (select 1 from clients where agency_id = _agency_id) then
    update agency_setup_steps set status = 'completed', completed_at = coalesce(completed_at, now())
    where agency_id = _agency_id and step_key = 'first_client' and status <> 'completed';
  end if;
end;
$$;


-- ── 6. ENABLE RLS ─────────────────────────────────────────────────────────────

alter table agency_setup_steps        enable row level security;
alter table agency_onboarding_progress enable row level security;
alter table services                   enable row level security;
alter table packages                   enable row level security;
alter table package_services           enable row level security;
alter table templates                  enable row level security;
alter table agency_health_scores       enable row level security;


-- ── 7. RLS POLICIES ───────────────────────────────────────────────────────────
-- Pattern per table: all agency members can read; only admins can write.
-- client_user has no agency_id, so current_agency_id() is null → fails closed.

-- agency_setup_steps
drop policy if exists "setup_steps_select" on agency_setup_steps;
create policy "setup_steps_select" on agency_setup_steps for select
  using (agency_id = public.current_agency_id());
drop policy if exists "setup_steps_write" on agency_setup_steps;
create policy "setup_steps_write" on agency_setup_steps for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- agency_onboarding_progress
drop policy if exists "onboarding_progress_select" on agency_onboarding_progress;
create policy "onboarding_progress_select" on agency_onboarding_progress for select
  using (agency_id = public.current_agency_id());
drop policy if exists "onboarding_progress_write" on agency_onboarding_progress;
create policy "onboarding_progress_write" on agency_onboarding_progress for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- services
drop policy if exists "services_select" on services;
create policy "services_select" on services for select
  using (agency_id = public.current_agency_id());
drop policy if exists "services_write" on services;
create policy "services_write" on services for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- packages
drop policy if exists "packages_select" on packages;
create policy "packages_select" on packages for select
  using (agency_id = public.current_agency_id());
drop policy if exists "packages_write" on packages;
create policy "packages_write" on packages for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- package_services
drop policy if exists "package_services_select" on package_services;
create policy "package_services_select" on package_services for select
  using (agency_id = public.current_agency_id());
drop policy if exists "package_services_write" on package_services;
create policy "package_services_write" on package_services for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- templates
drop policy if exists "templates_select" on templates;
create policy "templates_select" on templates for select
  using (agency_id = public.current_agency_id());
drop policy if exists "templates_write" on templates;
create policy "templates_write" on templates for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- agency_health_scores
drop policy if exists "health_scores_select" on agency_health_scores;
create policy "health_scores_select" on agency_health_scores for select
  using (agency_id = public.current_agency_id());
drop policy if exists "health_scores_write" on agency_health_scores;
create policy "health_scores_write" on agency_health_scores for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());


-- ── 8. GRANTS ─────────────────────────────────────────────────────────────────

grant select, insert, update         on agency_setup_steps        to authenticated;
grant select, insert, update         on agency_onboarding_progress to authenticated;
grant select, insert, update         on services                  to authenticated;
grant select, insert, update         on packages                  to authenticated;
grant select, insert, update, delete on package_services          to authenticated;
grant select, insert, update         on templates                 to authenticated;
grant select, insert, update         on agency_health_scores      to authenticated;

grant execute on function public.recompute_agency_onboarding(uuid) to authenticated;
grant execute on function public.seed_agency_setup(uuid)           to authenticated;
grant execute on function public.reconcile_agency_setup(uuid)      to authenticated;
