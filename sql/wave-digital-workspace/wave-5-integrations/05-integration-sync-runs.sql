/*
==============================================================
ELIORA OS.M — DIGITAL INTEGRATIONS WAVE 5: INTEGRATION SYNC RUNS
==============================================================
Purpose:      A minimal operational log — one row per sync attempt
              (discovery, initial sync, manual "Sync Now", or the future
              scheduled sync), not per API call. This is deliberately
              NOT a general observability platform: no per-metric rows,
              no request/response bodies, no headers. It exists only to
              support success/failure visibility, retry/debugging, and a
              "last few syncs" view in the UI.

Depends on:   01-integration-connections.sql, 02-integration-resources.sql.
Execution:    Paste after 04-integration-oauth-states.sql. Idempotent.
==============================================================
*/

-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────
do $$ begin
  create type integration_run_type as enum (
    'discovery','initial_sync','manual_sync','scheduled_sync'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type integration_run_status as enum ('running','success','partial','error');
exception when duplicate_object then null; end $$;

-- ── 2. TABLE ──────────────────────────────────────────────────────────────────
create table if not exists integration_sync_runs (
  id                 uuid                     primary key default uuid_generate_v4(),
  agency_id          uuid                     not null references agencies(id) on delete cascade,
  client_id          uuid                     not null references clients(id)  on delete cascade,

  -- A run always belongs to exactly one connection. Connections are
  -- expected to be disconnected via a status flip, not hard-deleted (see
  -- integration-disconnect in the approved architecture), so this cascade
  -- is a rarely-exercised administrative safety net, not the normal
  -- lifecycle path — accepted as the simplest correct rule rather than
  -- leaving a NOT NULL column nullable to avoid it.
  connection_id      uuid                     not null references integration_connections(id) on delete cascade,
  -- Null for a connection-level run (discovery). Deliberately ON DELETE
  -- SET NULL, not CASCADE — a resource can later be removed without
  -- losing the operational history of syncs that referenced it (§16:
  -- "sync run history should remain useful for operational debugging").
  resource_id        uuid                     references integration_resources(id) on delete set null,

  run_type           integration_run_type     not null,
  status             integration_run_status   not null default 'running',

  started_at         timestamptz              not null default now(),
  finished_at        timestamptz,
  -- Safe, normalized codes/messages only — see integration_connections'
  -- last_error_code/last_error_message header comment. NEVER tokens,
  -- authorization codes, secret headers, or provider secret values.
  error_code         text,
  error_message      text,
  metrics_written    integer,

  -- Fully automated (cron or an Edge-Function-triggered run, not a
  -- direct human edit of this row) — no created_by/updated_by, same
  -- reasoning as integration_resources. No updated_at either: a run's
  -- own started_at/finished_at pair already captures its lifecycle
  -- precisely, and this is an append-then-finalize log, not a record
  -- users edit — adding a third timestamp column here would be exactly
  -- the unnecessary-complexity the "not a general observability
  -- platform" purpose statement warns against.
  created_at         timestamptz              not null default now()
);

create index if not exists integration_sync_runs_client_idx     on integration_sync_runs(agency_id, client_id, started_at desc);
create index if not exists integration_sync_runs_connection_idx on integration_sync_runs(connection_id, started_at desc);
create index if not exists integration_sync_runs_resource_idx   on integration_sync_runs(resource_id) where resource_id is not null;

-- ── 3. TENANT-MATCH TRIGGER ────────────────────────────────────────────────────
create or replace function public.check_integration_sync_run_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _conn     integration_connections;
  _resource integration_resources;
begin
  select * into _conn from integration_connections where id = new.connection_id;
  if not found then
    raise exception 'integration_connection_not_found: Referenced connection does not exist';
  end if;
  if _conn.agency_id <> new.agency_id or _conn.client_id <> new.client_id then
    raise exception 'integration_connection_tenant_mismatch: Referenced connection belongs to a different agency/client';
  end if;

  if new.resource_id is not null then
    select * into _resource from integration_resources where id = new.resource_id;
    if not found then
      raise exception 'integration_resource_not_found: Referenced resource does not exist';
    end if;
    if _resource.agency_id <> new.agency_id or _resource.client_id <> new.client_id then
      raise exception 'integration_resource_tenant_mismatch: Referenced resource belongs to a different agency/client';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists integration_sync_runs_check_tenant_match_trg on integration_sync_runs;
create trigger integration_sync_runs_check_tenant_match_trg
  before insert or update on integration_sync_runs
  for each row execute function check_integration_sync_run_tenant_match();

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
-- Safe operational metadata (no tokens, no secrets) — same standard
-- agency-scoped-read / admin-gated-write shape as integration_connections
-- and integration_resources, powering a future "recent syncs" UI without
-- exposing anything sensitive. Real writes come from Edge Functions via
-- the service role, same as everywhere else in this wave.
alter table integration_sync_runs enable row level security;

drop policy if exists "integration_sync_runs_select" on integration_sync_runs;
create policy "integration_sync_runs_select" on integration_sync_runs
  for select using (agency_id = public.current_agency_id());

drop policy if exists "integration_sync_runs_insert" on integration_sync_runs;
create policy "integration_sync_runs_insert" on integration_sync_runs
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "integration_sync_runs_update" on integration_sync_runs;
create policy "integration_sync_runs_update" on integration_sync_runs
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "integration_sync_runs_delete" on integration_sync_runs;
create policy "integration_sync_runs_delete" on integration_sync_runs
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on integration_sync_runs to authenticated;

-- ── 5. VERIFICATION (informational) ──────────────────────────────────────────
-- select count(*) from integration_sync_runs;
-- select tgname from pg_trigger where tgname = 'integration_sync_runs_check_tenant_match_trg';
