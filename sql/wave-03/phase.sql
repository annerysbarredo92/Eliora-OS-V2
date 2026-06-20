/*
==============================================================
ELIORA OS — WAVE 3: BILLING, REPORTING & CALENDAR
==============================================================
Purpose:      Invoices/payments/plans/deposits/refunds, content performance,
              KPIs & goals, calendar events, tasks.
Dependencies: Phases 01-05 + Wave 1 + Wave 2.
Execution:    Paste AFTER wave-02. Idempotent.
Rollback:     see rollback.sql.
Notes:        No payment processor — payments are MANUAL RECORDING only
              (blueprint payment method). Recurring billing = scheduling records.
==============================================================
*/

-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────
do $$ begin create type invoice_status as enum ('draft','sent','viewed','partially_paid','paid','overdue','void','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_method as enum ('credit_card','ach','bank_transfer','manual'); exception when duplicate_object then null; end $$;
do $$ begin create type plan_status as enum ('active','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type task_status as enum ('todo','in_progress','blocked','done'); exception when duplicate_object then null; end $$;
do $$ begin create type task_priority as enum ('low','medium','high','urgent'); exception when duplicate_object then null; end $$;
do $$ begin create type calendar_event_type as enum ('content','discovery_call','client_meeting','internal_meeting','deadline','invoice_due','proposal_expiration','task'); exception when duplicate_object then null; end $$;
do $$ begin create type goal_status as enum ('on_track','at_risk','achieved','missed'); exception when duplicate_object then null; end $$;

-- ── 2. TABLES ─────────────────────────────────────────────────────────────────
-- BILLING ----------------------------------------------------------------------
create table if not exists invoices (
  id                uuid           primary key default uuid_generate_v4(),
  agency_id         uuid           not null references agencies(id) on delete cascade,
  client_id         uuid           not null references clients(id) on delete cascade,
  proposal_id       uuid           references proposals(id) on delete set null,
  number            text,
  title             text,
  status            invoice_status not null default 'draft',
  is_recurring      boolean        not null default false,
  recurrence        text,
  subtotal_cents    integer        not null default 0,
  tax_cents         integer        not null default 0,
  total_cents       integer        not null default 0,
  amount_paid_cents integer        not null default 0,
  deposit_cents     integer        not null default 0,
  due_date          date,
  issued_at         timestamptz,
  paid_at           timestamptz,
  notes             text,
  is_client_visible boolean        not null default true,
  created_by        uuid           references profiles(id) on delete set null,
  updated_by        uuid           references profiles(id) on delete set null,
  created_at        timestamptz    not null default now(),
  updated_at        timestamptz    not null default now()
);
create table if not exists invoice_items (
  id               uuid        primary key default uuid_generate_v4(),
  agency_id        uuid        not null references agencies(id) on delete cascade,
  client_id        uuid        not null references clients(id) on delete cascade,
  invoice_id       uuid        not null references invoices(id) on delete cascade,
  name             text        not null,
  description      text,
  quantity         smallint    not null default 1,
  unit_price_cents integer     not null default 0,
  sort_order       smallint    not null default 0
);
create table if not exists payments (
  id           uuid           primary key default uuid_generate_v4(),
  agency_id    uuid           not null references agencies(id) on delete cascade,
  client_id    uuid           not null references clients(id) on delete cascade,
  invoice_id   uuid           references invoices(id) on delete set null,
  amount_cents integer        not null default 0,
  method       payment_method not null default 'manual',
  note         text,
  recorded_by  uuid           references profiles(id) on delete set null,
  recorded_at  timestamptz    not null default now()
);
create table if not exists payment_plans (
  id           uuid        primary key default uuid_generate_v4(),
  agency_id    uuid        not null references agencies(id) on delete cascade,
  client_id    uuid        not null references clients(id) on delete cascade,
  invoice_id   uuid        references invoices(id) on delete set null,
  name         text        not null,
  total_cents  integer     not null default 0,
  installments smallint    not null default 1,
  frequency    text        not null default 'monthly',
  status       plan_status not null default 'active',
  created_by   uuid        references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists payment_plan_installments (
  id           uuid        primary key default uuid_generate_v4(),
  agency_id    uuid        not null references agencies(id) on delete cascade,
  client_id    uuid        not null references clients(id) on delete cascade,
  plan_id      uuid        not null references payment_plans(id) on delete cascade,
  due_date     date,
  amount_cents integer     not null default 0,
  paid         boolean     not null default false,
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);
create table if not exists refunds (
  id           uuid        primary key default uuid_generate_v4(),
  agency_id    uuid        not null references agencies(id) on delete cascade,
  client_id    uuid        not null references clients(id) on delete cascade,
  invoice_id   uuid        references invoices(id) on delete set null,
  amount_cents integer     not null default 0,
  reason       text,
  refunded_by  uuid        references profiles(id) on delete set null,
  refunded_at  timestamptz not null default now()
);

-- CONTENT PERFORMANCE ----------------------------------------------------------
create table if not exists content_metrics (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  content_id  uuid        not null unique references content_items(id) on delete cascade,
  views       integer     not null default 0,
  reach       integer     not null default 0,
  engagement  integer     not null default 0,
  clicks      integer     not null default 0,
  likes       integer     not null default 0,
  comments    integer     not null default 0,
  shares      integer     not null default 0,
  saves       integer     not null default 0,
  recorded_at timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- KPIs & GOALS -----------------------------------------------------------------
create table if not exists kpis (
  id            uuid        primary key default uuid_generate_v4(),
  agency_id     uuid        not null references agencies(id) on delete cascade,
  client_id     uuid        references clients(id) on delete cascade,
  name          text        not null,
  metric_key    text,
  target_value  numeric     not null default 0,
  current_value numeric     not null default 0,
  unit          text,
  period        text        not null default 'monthly',
  is_client_visible boolean not null default false,
  created_by    uuid        references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table if not exists goals (
  id            uuid        primary key default uuid_generate_v4(),
  agency_id     uuid        not null references agencies(id) on delete cascade,
  client_id     uuid        references clients(id) on delete cascade,
  title         text        not null,
  target_value  numeric     not null default 0,
  current_value numeric     not null default 0,
  due_date      date,
  status        goal_status not null default 'on_track',
  is_client_visible boolean not null default false,
  created_by    uuid        references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- CALENDAR & TASKS -------------------------------------------------------------
create table if not exists calendar_events (
  id                uuid                primary key default uuid_generate_v4(),
  agency_id         uuid                not null references agencies(id) on delete cascade,
  client_id         uuid                references clients(id) on delete set null,
  title             text                not null,
  type              calendar_event_type not null default 'content',
  start_at          timestamptz,
  end_at            timestamptz,
  all_day           boolean             not null default false,
  is_client_visible boolean             not null default false,
  content_id        uuid                references content_items(id) on delete set null,
  assigned_to       uuid[]              not null default '{}',
  notes             text,
  created_by        uuid                references profiles(id) on delete set null,
  created_at        timestamptz         not null default now(),
  updated_at        timestamptz         not null default now()
);
create table if not exists tasks (
  id          uuid          primary key default uuid_generate_v4(),
  agency_id   uuid          not null references agencies(id) on delete cascade,
  client_id   uuid          references clients(id) on delete set null,
  title       text          not null,
  description text,
  status      task_status   not null default 'todo',
  priority    task_priority not null default 'medium',
  due_date    date,
  assigned_to uuid          references profiles(id) on delete set null,
  created_by  uuid          references profiles(id) on delete set null,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- ── 3. INDEXES ────────────────────────────────────────────────────────────────
create index if not exists invoices_client_idx on invoices(client_id, status);
create index if not exists invoices_agency_idx on invoices(agency_id, created_at desc);
create index if not exists invoice_items_idx on invoice_items(invoice_id);
create index if not exists payments_client_idx on payments(client_id);
create index if not exists content_metrics_client_idx on content_metrics(client_id);
create index if not exists kpis_agency_idx on kpis(agency_id);
create index if not exists goals_agency_idx on goals(agency_id);
create index if not exists calendar_events_agency_idx on calendar_events(agency_id, start_at);
create index if not exists tasks_agency_idx on tasks(agency_id, status);
create index if not exists tasks_assignee_idx on tasks(assigned_to);

-- ── 4. updated_at TRIGGERS ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['invoices','payment_plans','content_metrics','kpis','goals','calendar_events','tasks'] loop
    execute format('drop trigger if exists %I on %I', t||'_set_updated_at', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t||'_set_updated_at', t);
  end loop;
end $$;

-- Keep invoice amount_paid + status in sync when payments are recorded.
create or replace function recompute_invoice_paid()
returns trigger language plpgsql security definer set search_path=public as $$
declare _inv invoices; _paid integer;
begin
  if new.invoice_id is null then return new; end if;
  select * into _inv from invoices where id = new.invoice_id;
  select coalesce(sum(amount_cents),0) into _paid from payments where invoice_id = new.invoice_id;
  update invoices set amount_paid_cents = _paid,
    status = case when _paid >= _inv.total_cents and _inv.total_cents > 0 then 'paid'::invoice_status
                  when _paid > 0 then 'partially_paid'::invoice_status else _inv.status end,
    paid_at = case when _paid >= _inv.total_cents and _inv.total_cents > 0 then now() else _inv.paid_at end
  where id = new.invoice_id;
  return new;
end; $$;
drop trigger if exists payments_recompute on payments;
create trigger payments_recompute after insert on payments for each row execute function recompute_invoice_paid();

-- ── 5. ENABLE RLS ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['invoices','invoice_items','payments','payment_plans','payment_plan_installments','refunds','content_metrics','kpis','goals','calendar_events','tasks'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ── 6. RLS POLICIES ───────────────────────────────────────────────────────────
-- Agency manages; clients read their own VISIBLE records (invoices via is_client_visible,
-- content_metrics for their content, calendar_events that are client_visible, kpis/goals visible).
-- Internal-only (payments, plans, refunds, tasks): agency-only.

-- Agency-only (no client read): payments, payment_plans, installments, refunds, tasks, invoice_items.
do $$
declare t text;
begin
  foreach t in array array['payments','payment_plans','payment_plan_installments','refunds','tasks','invoice_items'] loop
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('create policy %I on %I for select using (agency_id = public.current_agency_id())', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format($f$create policy %I on %I for all
      using (agency_id = public.current_agency_id() and public.is_agency_admin())
      with check (agency_id = public.current_agency_id() and public.is_agency_admin())$f$, t||'_write', t);
  end loop;
end $$;

-- Agency manage + client read own (invoices, content_metrics, kpis, goals, calendar_events).
-- Client read filtered by visibility in the app/views; base policy allows the client's own rows.
do $$
declare t text;
begin
  foreach t in array array['invoices','content_metrics','kpis','goals','calendar_events'] loop
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format($f$create policy %I on %I for select using (
        (agency_id = public.current_agency_id() and (public.is_agency_admin() or public.is_assigned_to_client(client_id)))
        or client_id = public.current_client_id())$f$, t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format($f$create policy %I on %I for all
      using (agency_id = public.current_agency_id() and public.is_agency_admin())
      with check (agency_id = public.current_agency_id() and public.is_agency_admin())$f$, t||'_write', t);
  end loop;
end $$;

-- Client-safe views (hide internal + non-visible).
create or replace view invoices_client with (security_invoker = off) as
  select id, agency_id, client_id, number, title, status, total_cents, amount_paid_cents, due_date, issued_at, created_at
  from invoices where client_id = public.current_client_id() and is_client_visible = true and status <> 'draft';
create or replace view calendar_client with (security_invoker = off) as
  select id, agency_id, client_id, title, type, start_at, end_at, all_day, content_id, created_at
  from calendar_events where client_id = public.current_client_id() and is_client_visible = true
    and type in ('content','client_meeting','deadline');

-- ── 7. GRANTS ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['invoices','invoice_items','payments','payment_plans','payment_plan_installments','refunds','content_metrics','kpis','goals','calendar_events','tasks'] loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
grant select on invoices_client, calendar_client to authenticated;
