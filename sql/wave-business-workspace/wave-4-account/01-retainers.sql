/*
==============================================================
ELIORA OS — WAVE 4 BUSINESS WORKSPACE: ACCOUNT — RETAINERS
==============================================================
Purpose:      Canonical retainer model for the Business Workspace Account section.
              Retainers are the permanent source of truth for ongoing agreements.
              Do NOT derive retainer state from invoice.is_recurring.

Lifecycle:    draft → active → paused ⇄ active
              active/paused/ending → ending → ended
              Renewal creates a NEW retainer via previous_retainer_id.
              Only draft retainers may be hard-deleted.
              Ended retainers are preserved as historical records.

Dependencies: Phases 01-05 + Waves 1-3 (agencies, clients, profiles,
              proposals, contracts, set_updated_at()).
Execution:    Paste AFTER wave-03 SQL. Idempotent — safe to re-run.
==============================================================
*/

-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────
-- draft:   being configured, not yet active
-- active:  engagement live, billing running
-- paused:  temporarily suspended; billing suspended; can resume
-- ending:  notice given, running through end_date
-- ended:   concluded; preserved as immutable history
do $$ begin create type retainer_status    as enum ('draft','active','paused','ending','ended'); exception when duplicate_object then null; end $$;
do $$ begin create type retainer_frequency as enum ('weekly','biweekly','monthly','quarterly','annually','custom'); exception when duplicate_object then null; end $$;

-- ── 2. TABLE ──────────────────────────────────────────────────────────────────
create table if not exists retainers (
  id                   uuid               primary key default uuid_generate_v4(),
  agency_id            uuid               not null references agencies(id) on delete cascade,
  client_id            uuid               not null references clients(id) on delete cascade,

  -- Core agreement terms
  title                text               not null,
  description          text,
  status               retainer_status    not null default 'draft',
  frequency            retainer_frequency not null default 'monthly',
  amount_cents         integer            not null default 0 check (amount_cents >= 0),

  -- Scheduling
  start_date           date,
  end_date             date,
  next_billing_date    date,
  is_auto_renew        boolean            not null default false,

  -- Lifecycle timestamps (set on the transition that creates them)
  paused_at            timestamptz,
  ended_at             timestamptz,

  -- Included agency services — snapshot on the retainer; editing the catalog
  -- does NOT rewrite these terms. Schema per element:
  --   { "name": "string", "description": "string|null", "sort_order": number }
  included_services    jsonb              not null default '[]',

  -- Recurring invoice configuration (stored for future automation; not active)
  -- Schema: { "payment_terms_days": number, "notes_template": "string|null",
  --           "auto_generate": false }
  invoice_config       jsonb,

  -- Linked originating documents (optional; nullable)
  linked_proposal_id   uuid               references proposals(id)  on delete set null,
  linked_contract_id   uuid               references contracts(id)  on delete set null,

  -- Renewal chain: this retainer was created as a renewal of previous_retainer_id.
  -- The previous retainer is set to 'ended' when renewal is confirmed.
  previous_retainer_id uuid               references retainers(id)  on delete set null,

  notes                text,
  created_by           uuid               references profiles(id)   on delete set null,
  updated_by           uuid               references profiles(id)   on delete set null,
  created_at           timestamptz        not null default now(),
  updated_at           timestamptz        not null default now()
);

-- ── 3. INDEXES ────────────────────────────────────────────────────────────────
create index if not exists retainers_client_idx  on retainers(client_id, status);
create index if not exists retainers_agency_idx  on retainers(agency_id, created_at desc);
create index if not exists retainers_renewal_idx on retainers(previous_retainer_id)
  where previous_retainer_id is not null;

-- ── 4. TRIGGER ────────────────────────────────────────────────────────────────
drop trigger if exists retainers_set_updated_at on retainers;
create trigger retainers_set_updated_at
  before update on retainers
  for each row execute function set_updated_at();

-- ── 5. ENABLE RLS ─────────────────────────────────────────────────────────────
alter table retainers enable row level security;

-- ── 6. RLS POLICIES ───────────────────────────────────────────────────────────
-- Clients NEVER access retainers (internal billing record).
-- SELECT: all agency members read their own agency's retainers.
drop policy if exists "retainers_select" on retainers;
create policy "retainers_select" on retainers
  for select using (agency_id = public.current_agency_id());

-- INSERT: agency admins only; agency_id must match session agency.
drop policy if exists "retainers_insert" on retainers;
create policy "retainers_insert" on retainers
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- UPDATE: agency admins only.
drop policy if exists "retainers_update" on retainers;
create policy "retainers_update" on retainers
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- DELETE: only draft retainers may be hard-deleted.
-- active/paused/ending/ended records are preserved as history.
drop policy if exists "retainers_delete" on retainers;
create policy "retainers_delete" on retainers
  for delete
  using (
    agency_id = public.current_agency_id()
    and public.is_agency_admin()
    and status = 'draft'
  );

-- ── 7. GRANTS ─────────────────────────────────────────────────────────────────
grant select, insert, update, delete on retainers to authenticated;

-- ── 8. VERIFICATION ───────────────────────────────────────────────────────────
-- Run these after applying to confirm objects were created:
-- select count(*) from retainers;
-- select enumlabel from pg_enum where enumtypid = 'retainer_status'::regtype order by enumsortorder;
--   → should return: draft, active, paused, ending, ended
-- select enumlabel from pg_enum where enumtypid = 'retainer_frequency'::regtype;
-- select policyname, cmd from pg_policies where tablename = 'retainers' order by cmd;
