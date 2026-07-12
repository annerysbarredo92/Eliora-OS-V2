/*
==============================================================
ELIORA OS — WAVE 4 BUSINESS WORKSPACE: ACCOUNT — RETAINERS
==============================================================
Purpose:      Canonical retainer model for the Business Workspace Account section.
              Retainers are the permanent source of truth for ongoing agreements.
              Do NOT derive retainer state from invoice.is_recurring.
Dependencies: Phases 01-05 + Waves 1-3 (agencies, clients, profiles, set_updated_at()).
Execution:    Paste AFTER wave-03 SQL. Idempotent — safe to re-run.
==============================================================
*/

-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────
do $$ begin create type retainer_status    as enum ('active','paused','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type retainer_frequency as enum ('weekly','biweekly','monthly','quarterly','annually','custom'); exception when duplicate_object then null; end $$;

-- ── 2. TABLE ──────────────────────────────────────────────────────────────────
create table if not exists retainers (
  id                uuid               primary key default uuid_generate_v4(),
  agency_id         uuid               not null references agencies(id) on delete cascade,
  client_id         uuid               not null references clients(id) on delete cascade,
  title             text               not null,
  description       text,
  status            retainer_status    not null default 'active',
  frequency         retainer_frequency not null default 'monthly',
  amount_cents      integer            not null default 0,
  start_date        date,
  end_date          date,
  next_billing_date date,
  is_auto_renew     boolean            not null default false,
  notes             text,
  created_by        uuid               references profiles(id) on delete set null,
  updated_by        uuid               references profiles(id) on delete set null,
  created_at        timestamptz        not null default now(),
  updated_at        timestamptz        not null default now()
);

-- ── 3. INDEXES ────────────────────────────────────────────────────────────────
create index if not exists retainers_client_idx on retainers(client_id, status);
create index if not exists retainers_agency_idx on retainers(agency_id, created_at desc);

-- ── 4. TRIGGER ────────────────────────────────────────────────────────────────
drop trigger if exists retainers_set_updated_at on retainers;
create trigger retainers_set_updated_at
  before update on retainers
  for each row execute function set_updated_at();

-- ── 5. ENABLE RLS ─────────────────────────────────────────────────────────────
alter table retainers enable row level security;

-- ── 6. RLS POLICIES ───────────────────────────────────────────────────────────
-- Agency members read their agency's retainers; agency admins write.
-- Clients never access retainers (internal billing record).
drop policy if exists "retainers_select" on retainers;
create policy "retainers_select" on retainers
  for select using (agency_id = public.current_agency_id());

drop policy if exists "retainers_write" on retainers;
create policy "retainers_write" on retainers
  for all
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- ── 7. GRANTS ─────────────────────────────────────────────────────────────────
grant select, insert, update, delete on retainers to authenticated;

-- ── 8. VERIFICATION ───────────────────────────────────────────────────────────
-- Run after applying to confirm objects were created:
-- select count(*) from retainers;                        -- table exists
-- select enumlabel from pg_enum where enumtypid = 'retainer_status'::regtype;
-- select enumlabel from pg_enum where enumtypid = 'retainer_frequency'::regtype;
