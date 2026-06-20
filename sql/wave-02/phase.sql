/*
==============================================================
ELIORA OS — WAVE 2: OPERATIONS HUB + SALES ENGINE
==============================================================
Purpose:      Team & permissions, pipeline/leads, proposals, contracts,
              agency portal settings, agency<->client messaging, client requests.
Dependencies: Phases 01-05 + Wave 1 (agencies, profiles, clients, services,
              packages, templates, current_agency_id(), current_client_id(),
              caller_agency_id(), is_agency_admin(), is_assigned_to_client(),
              set_updated_at()).
Execution:    Paste AFTER phase-01..05 + wave-01. Idempotent — safe to re-run.
Rollback:     see rollback.sql (drops Wave 2 objects only).
==============================================================
*/

-- ── 0. EXTEND template_type enum (Wave 2 adds contract/message/custom) ─────────
alter type template_type add value if not exists 'contract';
alter type template_type add value if not exists 'message';
alter type template_type add value if not exists 'custom';


-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────
do $$ begin create type team_member_status as enum ('invited','active','deactivated'); exception when duplicate_object then null; end $$;
do $$ begin create type team_invite_status as enum ('pending','accepted','expired','revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type lead_status as enum ('open','won','lost','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type proposal_status as enum ('draft','sent','viewed','accepted','declined','expired','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type contract_status as enum ('draft','sent','signed','declined','expired','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type request_type as enum ('content','file','campaign','strategy','support','meeting'); exception when duplicate_object then null; end $$;
do $$ begin create type request_status as enum ('submitted','in_review','in_progress','waiting','completed','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type meeting_type as enum ('discovery','client','internal'); exception when duplicate_object then null; end $$;
do $$ begin create type billing_kind as enum ('one_time','recurring'); exception when duplicate_object then null; end $$;


-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- TEAM & PERMISSIONS -----------------------------------------------------------
create table if not exists permission_sets (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  name        text        not null,
  description text,
  is_preset   boolean     not null default false,
  permissions jsonb       not null default '{}',     -- { module: [actions] }
  created_by  uuid        references profiles(id) on delete set null,
  updated_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agency_id, name)
);

-- Membership layer over profiles (identity stays in profiles; no duplicate id system).
create table if not exists team_memberships (
  id                uuid               primary key default uuid_generate_v4(),
  agency_id         uuid               not null references agencies(id) on delete cascade,
  profile_id        uuid               not null references profiles(id) on delete cascade,
  title             text,
  status            team_member_status not null default 'active',
  permission_set_id uuid               references permission_sets(id) on delete set null,
  overrides         jsonb              not null default '{}',
  created_by        uuid               references profiles(id) on delete set null,
  updated_by        uuid               references profiles(id) on delete set null,
  created_at        timestamptz        not null default now(),
  updated_at        timestamptz        not null default now(),
  unique (agency_id, profile_id)
);

create table if not exists team_invitations (
  id                uuid               primary key default uuid_generate_v4(),
  agency_id         uuid               not null references agencies(id) on delete cascade,
  email             text               not null,
  role              user_role          not null default 'team_member',
  title             text,
  permission_set_id uuid               references permission_sets(id) on delete set null,
  token             text               not null unique default replace(uuid_generate_v4()::text,'-',''),
  status            team_invite_status not null default 'pending',
  invited_by        uuid               references profiles(id) on delete set null,
  expires_at        timestamptz,
  accepted_at       timestamptz,
  created_at        timestamptz        not null default now(),
  updated_at        timestamptz        not null default now()
);

-- PIPELINE & LEADS -------------------------------------------------------------
create table if not exists pipeline_stages (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  name        text        not null,
  sort_order  smallint    not null default 0,
  probability smallint    not null default 0,
  is_default  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agency_id, name)
);

create table if not exists leads (
  id                  uuid        primary key default uuid_generate_v4(),
  agency_id           uuid        not null references agencies(id) on delete cascade,
  name                text,
  business_name       text        not null,
  email               text,
  phone               text,
  website             text,
  source              text,
  status              lead_status not null default 'open',
  stage_id            uuid        references pipeline_stages(id) on delete set null,
  estimated_value_cents integer   not null default 0,
  owner_id            uuid        references profiles(id) on delete set null,
  notes               text,
  converted_client_id uuid        references clients(id) on delete set null,  -- forward-compat; no logic in Wave 2
  created_by          uuid        references profiles(id) on delete set null,
  updated_by          uuid        references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists lead_notes (
  id         uuid        primary key default uuid_generate_v4(),
  agency_id  uuid        not null references agencies(id) on delete cascade,
  lead_id    uuid        not null references leads(id) on delete cascade,
  author_id  uuid        references profiles(id) on delete set null,
  body       text        not null,
  created_at timestamptz not null default now()
);

create table if not exists lead_activities (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  lead_id     uuid        not null references leads(id) on delete cascade,
  actor_id    uuid        references profiles(id) on delete set null,
  type        text        not null,
  description text,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists meetings (
  id           uuid         primary key default uuid_generate_v4(),
  agency_id    uuid         not null references agencies(id) on delete cascade,
  lead_id      uuid         references leads(id) on delete set null,
  client_id    uuid         references clients(id) on delete set null,
  title        text         not null,
  type         meeting_type not null default 'discovery',
  scheduled_at timestamptz,
  duration_min smallint     not null default 30,
  notes        text,
  created_by   uuid         references profiles(id) on delete set null,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- PROPOSALS --------------------------------------------------------------------
create table if not exists proposals (
  id           uuid            primary key default uuid_generate_v4(),
  agency_id    uuid            not null references agencies(id) on delete cascade,
  lead_id      uuid            references leads(id) on delete set null,
  client_id    uuid            references clients(id) on delete set null,
  title        text            not null,
  status       proposal_status not null default 'draft',
  total_cents  integer         not null default 0,
  version      integer         not null default 1,
  share_token  text            unique default replace(uuid_generate_v4()::text,'-',''),
  expires_at   timestamptz,
  sent_at      timestamptz,
  viewed_at    timestamptz,
  decided_at   timestamptz,
  created_by   uuid            references profiles(id) on delete set null,
  updated_by   uuid            references profiles(id) on delete set null,
  created_at   timestamptz     not null default now(),
  updated_at   timestamptz     not null default now()
);

create table if not exists proposal_sections (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  proposal_id uuid        not null references proposals(id) on delete cascade,
  kind        text        not null,   -- intro/scope/services/packages/pricing/timeline/terms/next_steps
  title       text        not null,
  body        text,
  sort_order  smallint    not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists proposal_line_items (
  id               uuid        primary key default uuid_generate_v4(),
  agency_id        uuid        not null references agencies(id) on delete cascade,
  proposal_id      uuid        not null references proposals(id) on delete cascade,
  service_id       uuid        references services(id) on delete set null,
  package_id       uuid        references packages(id) on delete set null,
  name             text        not null,
  description      text,
  quantity         smallint    not null default 1,
  unit_price_cents integer     not null default 0,
  billing_kind     billing_kind not null default 'one_time',
  sort_order       smallint    not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists proposal_versions (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  proposal_id uuid        not null references proposals(id) on delete cascade,
  version     integer     not null,
  snapshot    jsonb       not null default '{}',
  created_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists proposal_events (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  proposal_id uuid        not null references proposals(id) on delete cascade,
  type        text        not null,  -- sent/viewed/accepted/declined/expired
  actor_id    uuid        references profiles(id) on delete set null,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- CONTRACTS --------------------------------------------------------------------
create table if not exists contract_templates (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  name        text        not null,
  body        text,
  is_default  boolean     not null default false,
  created_by  uuid        references profiles(id) on delete set null,
  updated_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists contracts (
  id          uuid            primary key default uuid_generate_v4(),
  agency_id   uuid            not null references agencies(id) on delete cascade,
  proposal_id uuid            references proposals(id) on delete set null,
  lead_id     uuid            references leads(id) on delete set null,
  client_id   uuid            references clients(id) on delete set null,
  template_id uuid            references contract_templates(id) on delete set null,
  title       text            not null,
  body        text,
  status      contract_status not null default 'draft',
  share_token text            unique default replace(uuid_generate_v4()::text,'-',''),
  sent_at     timestamptz,
  signed_at   timestamptz,
  expires_at  timestamptz,
  created_by  uuid            references profiles(id) on delete set null,
  updated_by  uuid            references profiles(id) on delete set null,
  created_at  timestamptz     not null default now(),
  updated_at  timestamptz     not null default now()
);

create table if not exists contract_signatures (
  id             uuid        primary key default uuid_generate_v4(),
  agency_id      uuid        not null references agencies(id) on delete cascade,
  contract_id    uuid        not null references contracts(id) on delete cascade,
  signer_name    text        not null,
  signer_email   text,
  signature_text text        not null,   -- typed in-app signature
  is_client      boolean     not null default false,
  signed_at      timestamptz not null default now(),
  ip_address     text,
  user_agent     text
);

-- AGENCY PORTAL SETTINGS (Operations Hub -> Client Portal Settings toggles) -----
create table if not exists agency_portal_settings (
  id                       uuid        primary key default uuid_generate_v4(),
  agency_id                uuid        not null unique references agencies(id) on delete cascade,
  enable_messaging         boolean     not null default true,
  enable_content_requests  boolean     not null default true,
  enable_file_uploads      boolean     not null default true,
  enable_report_access     boolean     not null default true,
  enable_invoice_access    boolean     not null default true,
  auto_approval            boolean     not null default false,
  updated_by               uuid        references profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- MESSAGING (agency <-> client) ------------------------------------------------
create table if not exists message_threads (
  id              uuid        primary key default uuid_generate_v4(),
  agency_id       uuid        not null references agencies(id) on delete cascade,
  client_id       uuid        not null references clients(id) on delete cascade,
  subject         text,
  status          text        not null default 'open',
  last_message_at timestamptz,
  created_by      uuid        references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists messages (
  id          uuid            primary key default uuid_generate_v4(),
  agency_id   uuid            not null references agencies(id) on delete cascade,
  client_id   uuid            not null references clients(id) on delete cascade,
  thread_id   uuid            not null references message_threads(id) on delete cascade,
  author_id   uuid            references profiles(id) on delete set null,
  author_role file_owner_role not null default 'agency',
  body        text            not null,
  created_at  timestamptz     not null default now()
);

create table if not exists message_attachments (
  id           uuid        primary key default uuid_generate_v4(),
  agency_id    uuid        not null references agencies(id) on delete cascade,
  client_id    uuid        not null references clients(id) on delete cascade,
  message_id   uuid        not null references messages(id) on delete cascade,
  storage_path text        not null,
  file_name    text,
  mime_type    text,
  created_at   timestamptz not null default now()
);

-- CLIENT REQUESTS --------------------------------------------------------------
create table if not exists client_requests (
  id          uuid           primary key default uuid_generate_v4(),
  agency_id   uuid           not null references agencies(id) on delete cascade,
  client_id   uuid           not null references clients(id) on delete cascade,
  type        request_type   not null default 'support',
  title       text           not null,
  description text,
  status      request_status not null default 'submitted',
  assignee_id uuid           references profiles(id) on delete set null,
  created_by  uuid           references profiles(id) on delete set null,
  created_at  timestamptz    not null default now(),
  updated_at  timestamptz    not null default now()
);

create table if not exists request_comments (
  id          uuid            primary key default uuid_generate_v4(),
  agency_id   uuid            not null references agencies(id) on delete cascade,
  client_id   uuid            not null references clients(id) on delete cascade,
  request_id  uuid            not null references client_requests(id) on delete cascade,
  author_id   uuid            references profiles(id) on delete set null,
  author_role file_owner_role not null default 'agency',
  body        text            not null,
  created_at  timestamptz     not null default now()
);

-- NOTIFICATION PREFERENCES -----------------------------------------------------
create table if not exists notification_preferences (
  id          uuid        primary key default uuid_generate_v4(),
  profile_id  uuid        not null unique references profiles(id) on delete cascade,
  agency_id   uuid        references agencies(id) on delete cascade,
  prefs       jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ── 3. INDEXES ────────────────────────────────────────────────────────────────
create index if not exists permission_sets_agency_idx on permission_sets(agency_id);
create index if not exists team_memberships_agency_idx on team_memberships(agency_id);
create index if not exists team_memberships_profile_idx on team_memberships(profile_id);
create index if not exists team_invitations_agency_idx on team_invitations(agency_id, status);
create index if not exists pipeline_stages_agency_idx on pipeline_stages(agency_id, sort_order);
create index if not exists leads_agency_idx on leads(agency_id, stage_id);
create index if not exists leads_owner_idx on leads(owner_id);
create index if not exists lead_notes_lead_idx on lead_notes(lead_id, created_at desc);
create index if not exists lead_activities_lead_idx on lead_activities(lead_id, created_at desc);
create index if not exists meetings_agency_idx on meetings(agency_id, scheduled_at);
create index if not exists proposals_agency_idx on proposals(agency_id, status);
create index if not exists proposal_sections_idx on proposal_sections(proposal_id, sort_order);
create index if not exists proposal_line_items_idx on proposal_line_items(proposal_id, sort_order);
create index if not exists contracts_agency_idx on contracts(agency_id, status);
create index if not exists message_threads_client_idx on message_threads(client_id, last_message_at desc);
create index if not exists messages_thread_idx on messages(thread_id, created_at);
create index if not exists client_requests_client_idx on client_requests(client_id, status);


-- ── 4. updated_at TRIGGERS ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'permission_sets','team_memberships','team_invitations','pipeline_stages','leads',
    'meetings','proposals','contract_templates','contracts','agency_portal_settings',
    'message_threads','client_requests','notification_preferences'
  ] loop
    execute format('drop trigger if exists %I on %I', t||'_set_updated_at', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t||'_set_updated_at', t);
  end loop;
end $$;

-- Bump thread.last_message_at on new message.
create or replace function bump_thread_last_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin update message_threads set last_message_at = new.created_at where id = new.thread_id; return new; end; $$;
drop trigger if exists messages_bump_thread on messages;
create trigger messages_bump_thread after insert on messages for each row execute function bump_thread_last_message();


-- ── 5. SEED FUNCTIONS ─────────────────────────────────────────────────────────

-- Default pipeline stages (blueprint): Lead, Discovery Call, Proposal + Contract, Paid, Client.
create or replace function seed_pipeline_stages(_agency_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if _agency_id is null or _agency_id <> public.current_agency_id() or not public.is_agency_admin() then
    raise exception 'not authorized'; end if;
  insert into pipeline_stages (agency_id, name, sort_order, probability, is_default) values
    (_agency_id, 'Lead', 1, 10, true),
    (_agency_id, 'Discovery Call', 2, 30, true),
    (_agency_id, 'Proposal + Contract', 3, 60, true),
    (_agency_id, 'Paid', 4, 90, true),
    (_agency_id, 'Client', 5, 100, true)
  on conflict (agency_id, name) do nothing;
end; $$;

-- Editable default permission presets.
create or replace function seed_permission_presets(_agency_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if _agency_id is null or _agency_id <> public.current_agency_id() or not public.is_agency_admin() then
    raise exception 'not authorized'; end if;
  insert into permission_sets (agency_id, name, description, is_preset, permissions) values
    (_agency_id, 'Admin', 'Full access to everything', true,
      '{"clients":["manage"],"content":["manage"],"files":["manage"],"reports":["manage"],"billing":["manage"],"pipeline":["manage"],"proposals":["manage"],"contracts":["manage"],"team":["manage"],"templates":["manage"],"calendar":["manage"],"messages":["manage"]}'),
    (_agency_id, 'Account Manager', 'Owns client relationships', true,
      '{"clients":["view","edit","assign"],"content":["view","approve"],"reports":["view","share"],"files":["view","create"],"messages":["view","create"],"calendar":["view"]}'),
    (_agency_id, 'Content Manager', 'Creates and manages content', true,
      '{"content":["view","create","edit","archive"],"files":["view","create"],"calendar":["view","edit"],"clients":["view"]}'),
    (_agency_id, 'Designer', 'Produces creative assets', true,
      '{"content":["view","create","edit"],"files":["view","create"],"calendar":["view"]}'),
    (_agency_id, 'Sales Manager', 'Runs the sales pipeline', true,
      '{"pipeline":["manage"],"proposals":["manage"],"contracts":["manage"],"clients":["view"],"calendar":["view","edit"]}')
  on conflict (agency_id, name) do nothing;
end; $$;

create or replace function ensure_agency_portal_settings(_agency_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if _agency_id is null or _agency_id <> public.current_agency_id() then raise exception 'not authorized'; end if;
  insert into agency_portal_settings (agency_id) values (_agency_id) on conflict (agency_id) do nothing;
end; $$;

-- Get or create the agency<->client thread (callable by agency admin or the client).
create or replace function ensure_message_thread(_client_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare _agency_id uuid; _tid uuid; _ok boolean;
begin
  select agency_id into _agency_id from clients where id = _client_id;
  if _agency_id is null then raise exception 'client not found'; end if;
  _ok := (_client_id = (select client_id from profiles where id = auth.uid()))
         or (public.is_agency_admin() and _agency_id = public.current_agency_id());
  if not _ok then raise exception 'not authorized'; end if;
  select id into _tid from message_threads where client_id = _client_id order by created_at limit 1;
  if _tid is null then
    insert into message_threads (agency_id, client_id, subject, created_by)
    values (_agency_id, _client_id, 'Conversation', auth.uid()) returning id into _tid;
  end if;
  return _tid;
end; $$;


-- ── 6. ENABLE RLS ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'permission_sets','team_memberships','team_invitations','pipeline_stages','leads',
    'lead_notes','lead_activities','meetings','proposals','proposal_sections',
    'proposal_line_items','proposal_versions','proposal_events','contract_templates',
    'contracts','contract_signatures','agency_portal_settings','message_threads',
    'messages','message_attachments','client_requests','request_comments','notification_preferences'
  ] loop execute format('alter table %I enable row level security', t); end loop;
end $$;


-- ── 7. RLS POLICIES ───────────────────────────────────────────────────────────

-- Pattern AO: agency members read; agency admins write. (internal agency tables)
do $$
declare t text;
begin
  foreach t in array array[
    'permission_sets','team_memberships','pipeline_stages','meetings','proposal_sections',
    'proposal_line_items','proposal_versions','proposal_events','contract_templates',
    'contract_signatures'
  ] loop
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('create policy %I on %I for select using (agency_id = public.current_agency_id())', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format($f$create policy %I on %I for all
      using (agency_id = public.current_agency_id() and public.is_agency_admin())
      with check (agency_id = public.current_agency_id() and public.is_agency_admin())$f$, t||'_write', t);
  end loop;
end $$;

-- team_invitations: admin only (also for select — invitations are sensitive).
drop policy if exists "team_invitations_all" on team_invitations;
create policy "team_invitations_all" on team_invitations for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- agency_portal_settings: members read, admin write.
drop policy if exists "agency_portal_settings_select" on agency_portal_settings;
create policy "agency_portal_settings_select" on agency_portal_settings for select using (agency_id = public.current_agency_id());
drop policy if exists "agency_portal_settings_write" on agency_portal_settings;
create policy "agency_portal_settings_write" on agency_portal_settings for all
  using (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

-- Pattern AOW: agency members read; admin OR owner/creator write. (leads + sales records)
-- leads (owner_id), lead_notes/lead_activities/proposals/contracts (created_by/owner)
drop policy if exists "leads_select" on leads;
create policy "leads_select" on leads for select using (agency_id = public.current_agency_id());
drop policy if exists "leads_write" on leads;
create policy "leads_write" on leads for all
  using (agency_id = public.current_agency_id() and (public.is_agency_admin() or owner_id = auth.uid() or created_by = auth.uid()))
  with check (agency_id = public.current_agency_id());

do $$
declare t text;
begin
  foreach t in array array['lead_notes','lead_activities','proposals','contracts'] loop
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('create policy %I on %I for select using (agency_id = public.current_agency_id())', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format($f$create policy %I on %I for all
      using (agency_id = public.current_agency_id() and (public.is_agency_admin() or created_by = auth.uid()))
      with check (agency_id = public.current_agency_id())$f$, t||'_write', t);
  end loop;
end $$;

-- Pattern B: agency admin OR the client's own user (messaging + requests).
do $$
declare t text;
begin
  foreach t in array array['message_threads','messages','message_attachments','client_requests','request_comments'] loop
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

-- notification_preferences: own only.
drop policy if exists "notification_preferences_all" on notification_preferences;
create policy "notification_preferences_all" on notification_preferences for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());


-- ── 8. GRANTS ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'permission_sets','team_memberships','team_invitations','pipeline_stages','leads',
    'lead_notes','lead_activities','meetings','proposals','proposal_sections',
    'proposal_line_items','proposal_versions','proposal_events','contract_templates',
    'contracts','contract_signatures','agency_portal_settings','message_threads',
    'messages','message_attachments','client_requests','request_comments','notification_preferences'
  ] loop execute format('grant select, insert, update, delete on %I to authenticated', t); end loop;
end $$;

grant execute on function public.seed_pipeline_stages(uuid)         to authenticated;
grant execute on function public.seed_permission_presets(uuid)      to authenticated;
grant execute on function public.ensure_agency_portal_settings(uuid) to authenticated;
grant execute on function public.ensure_message_thread(uuid)        to authenticated;
