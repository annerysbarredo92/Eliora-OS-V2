-- ============================================================
-- Wave: Email Messaging Phase 1
-- Creates email_messages and email_events tables.
-- Schema supports Phase 2 Resend webhook tracking.
-- Paste into: Supabase SQL Editor
-- ============================================================

-- ── 1. email_message_status enum ─────────────────────────────
do $$ begin
  create type email_message_status as enum (
    'draft', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
  );
exception when duplicate_object then null; end $$;


-- ── 2. email_messages ─────────────────────────────────────────
create table if not exists email_messages (
  id                   uuid        primary key default uuid_generate_v4(),
  agency_id            uuid        not null references agencies(id)        on delete cascade,
  client_id            uuid                    references clients(id)       on delete set null,
  contact_id           uuid                    references client_contacts(id) on delete set null,
  to_email             text        not null,
  to_name              text,
  from_email           text        not null,
  from_name            text,
  subject              text        not null,
  body_html            text,
  body_text            text,
  provider_message_id  text,
  status               email_message_status not null default 'sent',
  opened_at            timestamptz,
  clicked_at           timestamptz,
  created_by           uuid        references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- updated_at auto-trigger
create or replace function touch_email_message_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_email_message_updated_at on email_messages;
create trigger trg_email_message_updated_at
  before update on email_messages
  for each row execute function touch_email_message_updated_at();

-- Indexes
create index if not exists email_messages_agency_client_idx
  on email_messages(agency_id, client_id, created_at desc);
create index if not exists email_messages_contact_idx
  on email_messages(contact_id) where contact_id is not null;
create index if not exists email_messages_status_idx
  on email_messages(agency_id, status);


-- ── 3. email_events ───────────────────────────────────────────
-- Stores webhook payloads from Resend (Phase 2).
-- Also used for any manual status updates in Phase 1.
create table if not exists email_events (
  id                uuid        primary key default uuid_generate_v4(),
  agency_id         uuid        not null references agencies(id) on delete cascade,
  email_message_id  uuid        not null references email_messages(id) on delete cascade,
  provider          text        not null default 'resend',
  event_type        text        not null,
  event_payload     jsonb       not null default '{}',
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists email_events_message_idx
  on email_events(email_message_id, occurred_at desc);
create index if not exists email_events_agency_idx
  on email_events(agency_id, occurred_at desc);


-- ── 4. RLS ────────────────────────────────────────────────────
alter table email_messages enable row level security;
alter table email_events    enable row level security;

-- email_messages: agency members see only their agency rows
drop policy if exists "Agency members can read email_messages"   on email_messages;
drop policy if exists "Agency members can insert email_messages" on email_messages;
drop policy if exists "Agency members can update email_messages" on email_messages;

create policy "Agency members can read email_messages"
  on email_messages for select
  using (agency_id = public.current_agency_id());

create policy "Agency members can insert email_messages"
  on email_messages for insert
  with check (agency_id = public.current_agency_id());

create policy "Agency members can update email_messages"
  on email_messages for update
  using (agency_id = public.current_agency_id());

-- email_events: agency members see only their agency rows
drop policy if exists "Agency members can read email_events"   on email_events;
drop policy if exists "Agency members can insert email_events" on email_events;

create policy "Agency members can read email_events"
  on email_events for select
  using (agency_id = public.current_agency_id());

create policy "Agency members can insert email_events"
  on email_events for insert
  with check (agency_id = public.current_agency_id());


-- ── 5. Grants ─────────────────────────────────────────────────
grant select, insert, update on email_messages to authenticated;
grant select, insert         on email_events    to authenticated;
