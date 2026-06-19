/*
==============================================================
ELIORA OS — WAVE 1: CLIENT DELIVERY SYSTEM
==============================================================
Paste into Supabase SQL Editor: phase.sql   ·   Verify: verification.sql

Covers Phases 06–09 (Content, Files & Deliverables, Reports, Client
Approvals). Phase 05 (Client Onboarding) ships in
sql/phase-05-client-onboarding/phase.sql — apply that first.

PREREQUISITES (apply in order, once each):
  phase-01 → phase-02 → phase-03 → phase-04 → phase-05 → THIS FILE

This file is FULLY IDEMPOTENT — safe to paste and re-run.

Reuses helpers from earlier phases:
  current_agency_id() (excludes client_user), current_client_id(),
  caller_agency_id(), is_agency_admin(), is_assigned_to_client(), set_updated_at()

Installs:
  1. Enums
  2. Tables — content (6), files (6), reports (4), notifications (1)
  3. Indexes + updated_at triggers
  4. Storage bucket 'eliora-files' + storage RLS
  5. Default-folder seeding function
  6. RLS enablement + policies
  7. Client-safe security-definer views (hide internal columns)
  8. Grants
==============================================================
*/


-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────

do $$ begin create type content_type as enum
  ('static_post','carousel','reel','story','video','blog','email','custom');
exception when duplicate_object then null; end $$;

do $$ begin create type content_platform as enum
  ('instagram','facebook','tiktok','linkedin','pinterest','youtube','google_business','custom');
exception when duplicate_object then null; end $$;

do $$ begin create type content_status as enum
  ('draft','internal_review','client_review','approved','revision_requested','rejected','scheduled','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin create type content_approval_action as enum
  ('approve','request_changes','reject','comment');
exception when duplicate_object then null; end $$;

do $$ begin create type file_owner_role as enum ('agency','client');
exception when duplicate_object then null; end $$;

do $$ begin create type file_request_status as enum ('open','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin create type report_status as enum ('active','archived');
exception when duplicate_object then null; end $$;


-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- CONTENT ----------------------------------------------------------------------
create table if not exists content_items (
  id              uuid             primary key default uuid_generate_v4(),
  agency_id       uuid             not null references agencies(id) on delete cascade,
  client_id       uuid             not null references clients(id) on delete cascade,
  title           text             not null,
  content_type    content_type     not null default 'static_post',
  platform        content_platform not null default 'instagram',
  campaign        text,
  caption         text,
  cta             text,
  hashtags        text,
  scheduled_date  timestamptz,
  status          content_status   not null default 'draft',
  internal_notes  text,                                   -- agency-only (hidden from clients via view)
  client_notes    text,                                   -- client-visible
  comment_count   integer          not null default 0,
  created_by      uuid             references profiles(id) on delete set null,
  updated_by      uuid             references profiles(id) on delete set null,
  created_at      timestamptz      not null default now(),
  updated_at      timestamptz      not null default now()
);

create table if not exists content_comments (
  id            uuid        primary key default uuid_generate_v4(),
  agency_id     uuid        not null references agencies(id) on delete cascade,
  client_id     uuid        not null references clients(id) on delete cascade,
  content_id    uuid        not null references content_items(id) on delete cascade,
  author_id     uuid        references profiles(id) on delete set null,
  author_role   file_owner_role not null default 'agency',
  body          text        not null,
  is_internal   boolean     not null default false,       -- internal agency-only when true
  created_at    timestamptz not null default now()
);

create table if not exists content_approvals (
  id            uuid                    primary key default uuid_generate_v4(),
  agency_id     uuid                    not null references agencies(id) on delete cascade,
  client_id     uuid                    not null references clients(id) on delete cascade,
  content_id    uuid                    not null references content_items(id) on delete cascade,
  action        content_approval_action not null,
  note          text,
  actor_id      uuid                    references profiles(id) on delete set null,
  created_at    timestamptz             not null default now()
);

create table if not exists content_approval_history (
  id            uuid           primary key default uuid_generate_v4(),
  agency_id     uuid           not null references agencies(id) on delete cascade,
  client_id     uuid           not null references clients(id) on delete cascade,
  content_id    uuid           not null references content_items(id) on delete cascade,
  from_status   content_status,
  to_status     content_status not null,
  actor_id      uuid           references profiles(id) on delete set null,
  reason        text,
  created_at    timestamptz    not null default now()
);

create table if not exists content_revisions (
  id              uuid        primary key default uuid_generate_v4(),
  agency_id       uuid        not null references agencies(id) on delete cascade,
  client_id       uuid        not null references clients(id) on delete cascade,
  content_id      uuid        not null references content_items(id) on delete cascade,
  revision_number integer     not null default 1,
  caption         text,
  notes           text,
  created_by      uuid        references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists content_assets (
  id            uuid        primary key default uuid_generate_v4(),
  agency_id     uuid        not null references agencies(id) on delete cascade,
  client_id     uuid        not null references clients(id) on delete cascade,
  content_id    uuid        not null references content_items(id) on delete cascade,
  file_id       uuid,                                         -- optional link to client_assets
  storage_path  text,                                         -- or a direct upload path
  file_name     text,
  mime_type     text,
  created_by    uuid        references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- FILES & DELIVERABLES ---------------------------------------------------------
create table if not exists asset_folders (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  name        text        not null,
  is_default  boolean     not null default false,
  sort_order  smallint    not null default 0,
  created_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, name)
);

create table if not exists client_assets (
  id                uuid            primary key default uuid_generate_v4(),
  agency_id         uuid            not null references agencies(id) on delete cascade,
  client_id         uuid            not null references clients(id) on delete cascade,
  folder_id         uuid            references asset_folders(id) on delete set null,
  name              text            not null,
  storage_path      text            not null,
  mime_type         text,
  size_bytes        bigint          not null default 0,
  owner_role        file_owner_role not null default 'agency',
  is_client_visible boolean         not null default true,
  internal_notes    text,
  is_archived       boolean         not null default false,
  created_by        uuid            references profiles(id) on delete set null,
  updated_by        uuid            references profiles(id) on delete set null,
  created_at        timestamptz     not null default now(),
  updated_at        timestamptz     not null default now()
);

create table if not exists file_versions (
  id             uuid        primary key default uuid_generate_v4(),
  agency_id      uuid        not null references agencies(id) on delete cascade,
  client_id      uuid        not null references clients(id) on delete cascade,
  file_id        uuid        not null references client_assets(id) on delete cascade,
  version_number integer     not null default 1,
  storage_path   text        not null,
  size_bytes     bigint      not null default 0,
  created_by     uuid        references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists file_requests (
  id          uuid                primary key default uuid_generate_v4(),
  agency_id   uuid                not null references agencies(id) on delete cascade,
  client_id   uuid                not null references clients(id) on delete cascade,
  title       text                not null,
  description text,
  status      file_request_status not null default 'open',
  created_by  uuid                references profiles(id) on delete set null,
  created_at  timestamptz         not null default now(),
  updated_at  timestamptz         not null default now()
);

create table if not exists file_request_items (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  request_id  uuid        not null references file_requests(id) on delete cascade,
  label       text        not null,
  fulfilled   boolean     not null default false,
  file_id     uuid        references client_assets(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists deliverables (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  title       text        not null,
  description text,
  file_id     uuid        references client_assets(id) on delete set null,
  status      text        not null default 'draft',
  created_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- REPORTS ----------------------------------------------------------------------
create table if not exists reports (
  id                uuid          primary key default uuid_generate_v4(),
  agency_id         uuid          not null references agencies(id) on delete cascade,
  client_id         uuid          not null references clients(id) on delete cascade,
  title             text          not null,
  period_label      text,
  description       text,
  storage_path      text,
  file_name         text,
  mime_type         text,
  size_bytes        bigint        not null default 0,
  is_client_visible boolean       not null default true,
  status            report_status not null default 'active',
  internal_notes    text,
  created_by        uuid          references profiles(id) on delete set null,
  updated_by        uuid          references profiles(id) on delete set null,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create table if not exists report_files (
  id           uuid        primary key default uuid_generate_v4(),
  agency_id    uuid        not null references agencies(id) on delete cascade,
  client_id    uuid        not null references clients(id) on delete cascade,
  report_id    uuid        not null references reports(id) on delete cascade,
  storage_path text        not null,
  file_name    text,
  mime_type    text,
  size_bytes   bigint      not null default 0,
  created_by   uuid        references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists report_sections (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  report_id   uuid        not null references reports(id) on delete cascade,
  title       text        not null,
  body        text,
  sort_order  smallint    not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists report_shares (
  id         uuid        primary key default uuid_generate_v4(),
  agency_id  uuid        not null references agencies(id) on delete cascade,
  client_id  uuid        not null references clients(id) on delete cascade,
  report_id  uuid        not null references reports(id) on delete cascade,
  shared_by  uuid        references profiles(id) on delete set null,
  shared_at  timestamptz not null default now()
);

-- NOTIFICATIONS ----------------------------------------------------------------
create table if not exists notifications (
  id                 uuid        primary key default uuid_generate_v4(),
  agency_id          uuid        not null references agencies(id) on delete cascade,
  recipient_profile_id uuid      not null references profiles(id) on delete cascade,
  client_id          uuid        references clients(id) on delete set null,
  type               text        not null,
  title              text        not null,
  body               text,
  entity_type        text,
  entity_id          uuid,
  is_read            boolean     not null default false,
  created_at         timestamptz not null default now()
);


-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

create index if not exists content_items_client_idx    on content_items(client_id, status);
create index if not exists content_items_agency_idx     on content_items(agency_id, created_at desc);
create index if not exists content_comments_content_idx on content_comments(content_id, created_at);
create index if not exists content_approvals_content_idx on content_approvals(content_id, created_at desc);
create index if not exists content_history_content_idx  on content_approval_history(content_id, created_at desc);
create index if not exists content_assets_content_idx   on content_assets(content_id);
create index if not exists asset_folders_client_idx     on asset_folders(client_id, sort_order);
create index if not exists client_assets_client_idx     on client_assets(client_id, folder_id);
create index if not exists client_assets_agency_idx     on client_assets(agency_id, created_at desc);
create index if not exists file_requests_client_idx     on file_requests(client_id, status);
create index if not exists reports_client_idx           on reports(client_id, status);
create index if not exists reports_agency_idx           on reports(agency_id, created_at desc);
create index if not exists notifications_recipient_idx  on notifications(recipient_profile_id, is_read, created_at desc);


-- ── 4. updated_at TRIGGERS ────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'content_items','asset_folders','client_assets','file_requests','file_request_items',
    'deliverables','reports'
  ] loop
    execute format('drop trigger if exists %I on %I', t||'_set_updated_at', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t||'_set_updated_at', t);
  end loop;
end $$;


-- ── 5. STORAGE ────────────────────────────────────────────────────────────────
-- Private bucket. Object paths are prefixed with the agency id, so storage RLS
-- isolates objects by agency. Per-client/row visibility is enforced by the
-- table RLS + client views below. App path convention:
--   <agency_id>/clients/<client_id>/<area>/<uuid>-<filename>

insert into storage.buckets (id, name, public)
values ('eliora-files', 'eliora-files', false)
on conflict (id) do nothing;

drop policy if exists "eliora_files_read"   on storage.objects;
drop policy if exists "eliora_files_insert" on storage.objects;
drop policy if exists "eliora_files_update" on storage.objects;
drop policy if exists "eliora_files_delete" on storage.objects;

create policy "eliora_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'eliora-files' and (storage.foldername(name))[1] = public.caller_agency_id()::text);
create policy "eliora_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'eliora-files' and (storage.foldername(name))[1] = public.caller_agency_id()::text);
create policy "eliora_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'eliora-files' and (storage.foldername(name))[1] = public.caller_agency_id()::text);
create policy "eliora_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'eliora-files' and (storage.foldername(name))[1] = public.caller_agency_id()::text
         and public.current_agency_id() is not null);  -- only agency users delete


-- ── 6. DEFAULT FOLDER SEEDING ─────────────────────────────────────────────────

create or replace function ensure_client_folders(_client_id uuid)
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
  if _client_id is null then raise exception 'client id required'; end if;
  select agency_id into _agency_id from clients where id = _client_id;
  if _agency_id is null then raise exception 'client not found'; end if;

  _is_owner := (_client_id = (select client_id from profiles where id = auth.uid()));
  _is_admin := public.is_agency_admin() and _agency_id = public.current_agency_id();
  if not (_is_owner or _is_admin) then raise exception 'not authorized'; end if;

  insert into asset_folders (agency_id, client_id, name, is_default, sort_order) values
    (_agency_id, _client_id, 'Brand Assets', true, 1),
    (_agency_id, _client_id, 'Photos',       true, 2),
    (_agency_id, _client_id, 'Videos',       true, 3),
    (_agency_id, _client_id, 'Logos',        true, 4),
    (_agency_id, _client_id, 'Documents',    true, 5),
    (_agency_id, _client_id, 'Other',        true, 6)
  on conflict (client_id, name) do nothing;
end;
$$;


-- ── 7. ENABLE RLS + POLICIES ──────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'content_items','content_comments','content_approvals','content_approval_history',
    'content_revisions','content_assets','asset_folders','client_assets','file_versions',
    'file_requests','file_request_items','deliverables','reports','report_files',
    'report_sections','report_shares','notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Pattern A — agency manages, client reads own (read both, write agency-only).
-- Applies to tables where clients should NOT write.
do $$
declare t text;
begin
  foreach t in array array[
    'content_items','content_approval_history','content_revisions','content_assets',
    'asset_folders','file_versions','file_requests','deliverables','reports',
    'report_files','report_sections','report_shares'
  ] loop
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

-- Pattern B — agency manages, client also writes own (comments, approvals,
-- client uploads, request fulfillment).
do $$
declare t text;
begin
  foreach t in array array[
    'content_comments','content_approvals','client_assets','file_request_items'
  ] loop
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format($f$create policy %I on %I for select using (
        (agency_id = public.current_agency_id() and (public.is_agency_admin() or public.is_assigned_to_client(client_id)))
        or client_id = public.current_client_id())$f$, t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format($f$create policy %I on %I for all
      using ((agency_id = public.current_agency_id() and public.is_agency_admin()) or client_id = public.current_client_id())
      with check ((agency_id = public.current_agency_id() and public.is_agency_admin()) or client_id = public.current_client_id())$f$, t||'_write', t);
  end loop;
end $$;

-- notifications — recipient reads/updates own; agency admins insert for their agency.
drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select
  using (recipient_profile_id = auth.uid());
drop policy if exists "notifications_update" on notifications;
create policy "notifications_update" on notifications for update
  using (recipient_profile_id = auth.uid()) with check (recipient_profile_id = auth.uid());
drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert
  with check (agency_id = public.current_agency_id() or client_id = public.current_client_id());


-- ── 8. CLIENT-SAFE VIEWS (hide internal columns; enforce client scope) ────────
-- SECURITY DEFINER views: clients read these instead of the base tables, so the
-- internal_notes columns and non-visible rows are never exposed to clients.

create or replace view content_items_client
with (security_invoker = off) as
  select id, agency_id, client_id, title, content_type, platform, campaign,
         caption, cta, hashtags, scheduled_date, status, client_notes,
         comment_count, created_at, updated_at
  from content_items
  where client_id = public.current_client_id()
    and status in ('client_review','revision_requested','approved','rejected','scheduled','published');

create or replace view client_assets_client
with (security_invoker = off) as
  select id, agency_id, client_id, folder_id, name, storage_path, mime_type,
         size_bytes, owner_role, created_at, updated_at
  from client_assets
  where client_id = public.current_client_id()
    and is_archived = false
    and (is_client_visible = true or owner_role = 'client');

create or replace view reports_client
with (security_invoker = off) as
  select id, agency_id, client_id, title, period_label, description, storage_path,
         file_name, mime_type, size_bytes, created_at, updated_at
  from reports
  where client_id = public.current_client_id()
    and is_client_visible = true
    and status = 'active';


-- ── 8b. CONTENT HELPERS (client decisions + comment count) ────────────────────

-- Keep content_items.comment_count in sync (any author, bypasses RLS).
create or replace function bump_content_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update content_items set comment_count = comment_count + 1 where id = new.content_id;
  return new;
end;
$$;
drop trigger if exists content_comments_bump on content_comments;
create trigger content_comments_bump after insert on content_comments
  for each row execute function bump_content_comment_count();

-- Client approval decision: clients cannot write content_items directly, so this
-- guarded SECURITY DEFINER function applies the status change + writes history.
create or replace function client_content_decision(
  _content_id uuid, _action content_approval_action, _note text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  _c        content_items;
  _to       content_status;
begin
  select * into _c from content_items where id = _content_id;
  if _c.id is null then raise exception 'content not found'; end if;
  if _c.client_id <> public.current_client_id() then raise exception 'not authorized'; end if;

  _to := case _action
           when 'approve'         then 'approved'::content_status
           when 'request_changes' then 'revision_requested'::content_status
           when 'reject'          then 'rejected'::content_status
           else null end;

  if _to is not null then
    insert into content_approval_history (agency_id, client_id, content_id, from_status, to_status, actor_id, reason)
    values (_c.agency_id, _c.client_id, _content_id, _c.status, _to, auth.uid(), _note);
    update content_items set status = _to, updated_at = now() where id = _content_id;
  end if;

  insert into content_approvals (agency_id, client_id, content_id, action, note, actor_id)
  values (_c.agency_id, _c.client_id, _content_id, _action, _note, auth.uid());
end;
$$;


-- ── 9. GRANTS ─────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'content_items','content_comments','content_approvals','content_approval_history',
    'content_revisions','content_assets','asset_folders','client_assets','file_versions',
    'file_requests','file_request_items','deliverables','reports','report_files',
    'report_sections','report_shares','notifications'
  ] loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

grant select on content_items_client, client_assets_client, reports_client to authenticated;

grant execute on function public.ensure_client_folders(uuid) to authenticated;
grant execute on function public.client_content_decision(uuid, content_approval_action, text) to authenticated;
