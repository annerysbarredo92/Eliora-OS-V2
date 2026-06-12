/*
==============================================================
ELIORA OS — PHASE 05: CLIENT ONBOARDING
==============================================================
File to paste into Supabase SQL Editor: phase.sql
Then verify with: verification.sql

Requires Phases 01–04.

This file is FULLY IDEMPOTENT — safe to paste and re-run.

Installs:
  1. Enums (client_onboarding_status, onboarding_question_type)
  2. Tables
       - onboarding_templates
       - onboarding_sections
       - onboarding_questions
       - onboarding_responses
       - onboarding_progress
       - onboarding_required_items
       - onboarding_activity
  3. Indexes + updated_at triggers
  4. Functions: seed_onboarding_template (default template + sections + questions),
     ensure_client_onboarding (per-client progress + required items)
  5. RLS enablement + policies (agency reads own clients; client reads/writes own)
  6. Grants
==============================================================
*/


-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────

do $$ begin
  create type client_onboarding_status as enum ('not_started', 'in_progress', 'completed', 'submitted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type onboarding_question_type as enum
    ('text', 'textarea', 'url', 'email', 'phone', 'number', 'select', 'multiselect', 'social', 'upload');
exception when duplicate_object then null; end $$;


-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

create table if not exists onboarding_templates (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  name        text        not null,
  description text,
  is_default  boolean     not null default false,
  is_active   boolean     not null default true,
  created_by  uuid        references profiles(id) on delete set null,
  updated_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists onboarding_templates_one_default
  on onboarding_templates(agency_id) where is_default;

create table if not exists onboarding_sections (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  template_id uuid        not null references onboarding_templates(id) on delete cascade,
  key         text        not null,
  title       text        not null,
  description text,
  sort_order  smallint    not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (template_id, key)
);

create table if not exists onboarding_questions (
  id            uuid                     primary key default uuid_generate_v4(),
  agency_id     uuid                     not null references agencies(id) on delete cascade,
  template_id   uuid                     not null references onboarding_templates(id) on delete cascade,
  section_id    uuid                     not null references onboarding_sections(id) on delete cascade,
  key           text                     not null,
  label         text                     not null,
  help_text     text,
  question_type onboarding_question_type not null default 'text',
  options       jsonb                    not null default '[]',
  is_required   boolean                  not null default false,
  sort_order    smallint                 not null default 0,
  created_at    timestamptz              not null default now(),
  updated_at    timestamptz              not null default now(),
  unique (section_id, key)
);

create table if not exists onboarding_responses (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  template_id uuid        not null references onboarding_templates(id) on delete cascade,
  question_id uuid        not null references onboarding_questions(id) on delete cascade,
  value       jsonb,
  created_by  uuid        references profiles(id) on delete set null,
  updated_by  uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, question_id)
);

create table if not exists onboarding_progress (
  id                uuid                     primary key default uuid_generate_v4(),
  agency_id         uuid                     not null references agencies(id) on delete cascade,
  client_id         uuid                     not null unique references clients(id) on delete cascade,
  template_id       uuid                     references onboarding_templates(id) on delete set null,
  status            client_onboarding_status not null default 'not_started',
  sections          jsonb                    not null default '{}',
  completion_pct    smallint                 not null default 0,
  total_sections    smallint                 not null default 0,
  completed_sections smallint                not null default 0,
  missing_items     jsonb                    not null default '[]',
  started_at        timestamptz,
  last_saved_at     timestamptz,
  submitted_at      timestamptz,
  created_at        timestamptz              not null default now(),
  updated_at        timestamptz              not null default now()
);

create table if not exists onboarding_required_items (
  id          uuid        primary key default uuid_generate_v4(),
  agency_id   uuid        not null references agencies(id) on delete cascade,
  client_id   uuid        not null references clients(id) on delete cascade,
  template_id uuid        references onboarding_templates(id) on delete set null,
  key         text        not null,
  label       text        not null,
  is_provided boolean     not null default false,
  provided_at timestamptz,
  sort_order  smallint    not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, key)
);

create table if not exists onboarding_activity (
  id               uuid        primary key default uuid_generate_v4(),
  agency_id        uuid        not null references agencies(id) on delete cascade,
  client_id        uuid        references clients(id) on delete cascade,
  actor_profile_id uuid        references profiles(id) on delete set null,
  action           text        not null,
  description      text,
  metadata         jsonb       not null default '{}',
  created_at       timestamptz not null default now()
);


-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

create index if not exists onboarding_sections_tpl_idx     on onboarding_sections(template_id, sort_order);
create index if not exists onboarding_questions_section_idx on onboarding_questions(section_id, sort_order);
create index if not exists onboarding_questions_tpl_idx     on onboarding_questions(template_id);
create index if not exists onboarding_responses_client_idx  on onboarding_responses(client_id);
create index if not exists onboarding_required_client_idx   on onboarding_required_items(client_id);
create index if not exists onboarding_activity_client_idx   on onboarding_activity(client_id, created_at desc);
create index if not exists onboarding_progress_agency_idx   on onboarding_progress(agency_id);


-- ── 4. updated_at TRIGGERS ────────────────────────────────────────────────────

drop trigger if exists onboarding_templates_set_updated_at on onboarding_templates;
create trigger onboarding_templates_set_updated_at before update on onboarding_templates for each row execute function set_updated_at();
drop trigger if exists onboarding_sections_set_updated_at on onboarding_sections;
create trigger onboarding_sections_set_updated_at before update on onboarding_sections for each row execute function set_updated_at();
drop trigger if exists onboarding_questions_set_updated_at on onboarding_questions;
create trigger onboarding_questions_set_updated_at before update on onboarding_questions for each row execute function set_updated_at();
drop trigger if exists onboarding_responses_set_updated_at on onboarding_responses;
create trigger onboarding_responses_set_updated_at before update on onboarding_responses for each row execute function set_updated_at();
drop trigger if exists onboarding_progress_set_updated_at on onboarding_progress;
create trigger onboarding_progress_set_updated_at before update on onboarding_progress for each row execute function set_updated_at();
drop trigger if exists onboarding_required_items_set_updated_at on onboarding_required_items;
create trigger onboarding_required_items_set_updated_at before update on onboarding_required_items for each row execute function set_updated_at();


-- ── 5. SEEDING FUNCTIONS ──────────────────────────────────────────────────────

-- Build the default template (sections + questions) for an agency. Idempotent.
create or replace function seed_onboarding_template(_agency_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _tid  uuid;
  _sid  uuid;
begin
  if _agency_id is null or _agency_id <> public.caller_agency_id() then
    raise exception 'not authorized for this agency';
  end if;

  -- Template
  insert into onboarding_templates (agency_id, name, description, is_default)
  values (_agency_id, 'Client Onboarding', 'The standard kickoff questionnaire for new clients.', true)
  on conflict (agency_id) where is_default do nothing;

  select id into _tid from onboarding_templates where agency_id = _agency_id and is_default limit 1;

  -- Sections
  insert into onboarding_sections (agency_id, template_id, key, title, description, sort_order) values
    (_agency_id, _tid, 'business_info',  'Business Information',     'The essentials about your business.',       1),
    (_agency_id, _tid, 'brand_info',     'Brand Information',        'Help us sound and look like you.',          2),
    (_agency_id, _tid, 'social',         'Social Media Accounts',    'Link the profiles we will manage.',         3),
    (_agency_id, _tid, 'assets',         'Asset Uploads',            'What you will share with us.',              4),
    (_agency_id, _tid, 'goals',          'Goals',                    'What success looks like for you.',          5),
    (_agency_id, _tid, 'communication',  'Communication Preferences','How and how often we keep in touch.',       6),
    (_agency_id, _tid, 'approval',       'Approval Preferences',     'How you review and approve work.',          7),
    (_agency_id, _tid, 'review',         'Review & Submit',          'Check everything, then submit.',            8)
  on conflict (template_id, key) do nothing;

  -- Questions helper macro via repeated inserts -------------------------------
  -- Business Information
  select id into _sid from onboarding_sections where template_id = _tid and key = 'business_info';
  insert into onboarding_questions (agency_id, template_id, section_id, key, label, question_type, is_required, sort_order, options) values
    (_agency_id, _tid, _sid, 'business_name',     'Business Name',      'text',     true,  1, '[]'),
    (_agency_id, _tid, _sid, 'website',           'Website',            'url',      false, 2, '[]'),
    (_agency_id, _tid, _sid, 'phone',             'Phone',              'phone',    false, 3, '[]'),
    (_agency_id, _tid, _sid, 'address',           'Address',            'text',     false, 4, '[]'),
    (_agency_id, _tid, _sid, 'industry',          'Industry',           'text',     false, 5, '[]'),
    (_agency_id, _tid, _sid, 'primary_services',  'Primary Services',   'textarea', false, 6, '[]'),
    (_agency_id, _tid, _sid, 'years_in_business', 'Years In Business',  'number',   false, 7, '[]')
  on conflict (section_id, key) do nothing;

  -- Brand Information
  select id into _sid from onboarding_sections where template_id = _tid and key = 'brand_info';
  insert into onboarding_questions (agency_id, template_id, section_id, key, label, question_type, is_required, sort_order, options) values
    (_agency_id, _tid, _sid, 'brand_voice',        'Brand Voice',        'text',     false, 1, '[]'),
    (_agency_id, _tid, _sid, 'brand_colors',       'Brand Colors',       'text',     false, 2, '[]'),
    (_agency_id, _tid, _sid, 'fonts',              'Fonts',              'text',     false, 3, '[]'),
    (_agency_id, _tid, _sid, 'logo_upload',        'Logo',               'upload',   false, 4, '[]'),
    (_agency_id, _tid, _sid, 'brand_guide_upload', 'Brand Guide',        'upload',   false, 5, '[]'),
    (_agency_id, _tid, _sid, 'approved_messaging', 'Approved Messaging', 'textarea', false, 6, '[]')
  on conflict (section_id, key) do nothing;

  -- Social Media Accounts
  select id into _sid from onboarding_sections where template_id = _tid and key = 'social';
  insert into onboarding_questions (agency_id, template_id, section_id, key, label, question_type, is_required, sort_order, options) values
    (_agency_id, _tid, _sid, 'instagram',       'Instagram',               'social', false, 1, '[]'),
    (_agency_id, _tid, _sid, 'facebook',        'Facebook',                'social', false, 2, '[]'),
    (_agency_id, _tid, _sid, 'tiktok',          'TikTok',                  'social', false, 3, '[]'),
    (_agency_id, _tid, _sid, 'linkedin',        'LinkedIn',                'social', false, 4, '[]'),
    (_agency_id, _tid, _sid, 'pinterest',       'Pinterest',               'social', false, 5, '[]'),
    (_agency_id, _tid, _sid, 'youtube',         'YouTube',                 'social', false, 6, '[]'),
    (_agency_id, _tid, _sid, 'google_business', 'Google Business Profile', 'social', false, 7, '[]')
  on conflict (section_id, key) do nothing;

  -- Goals
  select id into _sid from onboarding_sections where template_id = _tid and key = 'goals';
  insert into onboarding_questions (agency_id, template_id, section_id, key, label, question_type, is_required, sort_order, options) values
    (_agency_id, _tid, _sid, 'goals',          'Your Goals',     'multiselect', false, 1,
      '["Increase Followers","Generate Leads","Increase Revenue","Promote New Service","Build Brand Awareness","Increase Website Traffic","Other"]'),
    (_agency_id, _tid, _sid, 'goal_notes',      'Goal Notes',     'textarea',    false, 2, '[]'),
    (_agency_id, _tid, _sid, 'target_numbers',  'Target Numbers', 'text',        false, 3, '[]')
  on conflict (section_id, key) do nothing;

  -- Communication Preferences
  select id into _sid from onboarding_sections where template_id = _tid and key = 'communication';
  insert into onboarding_questions (agency_id, template_id, section_id, key, label, question_type, is_required, sort_order, options) values
    (_agency_id, _tid, _sid, 'contact_method',    'Preferred Contact Method',    'select', true,  1, '["Email","Phone","Portal messages"]'),
    (_agency_id, _tid, _sid, 'contact_frequency', 'Preferred Contact Frequency', 'select', false, 2, '["Daily","Weekly","Bi-weekly","Monthly"]'),
    (_agency_id, _tid, _sid, 'main_contact',      'Main Point of Contact',       'text',   false, 3, '[]'),
    (_agency_id, _tid, _sid, 'best_times',        'Best Days/Times',             'text',   false, 4, '[]')
  on conflict (section_id, key) do nothing;

  -- Approval Preferences
  select id into _sid from onboarding_sections where template_id = _tid and key = 'approval';
  insert into onboarding_questions (agency_id, template_id, section_id, key, label, question_type, is_required, sort_order, options) values
    (_agency_id, _tid, _sid, 'approver_name',     'Content Approver Name',  'text',   false, 1, '[]'),
    (_agency_id, _tid, _sid, 'approver_email',    'Content Approver Email', 'email',  true,  2, '[]'),
    (_agency_id, _tid, _sid, 'approval_timeline', 'Approval Timeline',      'select', false, 3, '["Within 24 hours","Within 48 hours","Within 72 hours","Within a week"]'),
    (_agency_id, _tid, _sid, 'auto_approval',     'Auto Approval',          'select', false, 4, '["Yes","No"]')
  on conflict (section_id, key) do nothing;

  return _tid;
end;
$$;

-- Create per-client onboarding rows (progress + required items). Idempotent.
create or replace function ensure_client_onboarding(_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _agency_id uuid;
  _tid       uuid;
  _is_owner  boolean;
  _is_admin  boolean;
begin
  if _client_id is null then raise exception 'client id required'; end if;

  select agency_id into _agency_id from clients where id = _client_id;
  if _agency_id is null then raise exception 'client not found'; end if;

  _is_owner := (_client_id = (select client_id from profiles where id = auth.uid()));
  _is_admin := public.is_agency_admin() and _agency_id = public.current_agency_id();
  if not (_is_owner or _is_admin) then
    raise exception 'not authorized for this client onboarding';
  end if;

  -- Ensure the agency template exists.
  select id into _tid from onboarding_templates where agency_id = _agency_id and is_default limit 1;
  if _tid is null then
    _tid := seed_onboarding_template(_agency_id);
  end if;

  -- Progress row (total_sections excludes the review step).
  insert into onboarding_progress (agency_id, client_id, template_id, total_sections, started_at)
  values (_agency_id, _client_id, _tid,
          (select count(*) from onboarding_sections where template_id = _tid and key <> 'review'),
          now())
  on conflict (client_id) do nothing;

  -- Required (asset) items.
  insert into onboarding_required_items (agency_id, client_id, template_id, key, label, sort_order) values
    (_agency_id, _client_id, _tid, 'logo',        'Logo',        1),
    (_agency_id, _client_id, _tid, 'brand_photos','Brand Photos',2),
    (_agency_id, _client_id, _tid, 'videos',      'Videos',      3),
    (_agency_id, _client_id, _tid, 'service_menu','Service Menu',4),
    (_agency_id, _client_id, _tid, 'brand_guide', 'Brand Guide', 5)
  on conflict (client_id, key) do nothing;
end;
$$;


-- ── 6. ENABLE RLS ─────────────────────────────────────────────────────────────

alter table onboarding_templates      enable row level security;
alter table onboarding_sections       enable row level security;
alter table onboarding_questions      enable row level security;
alter table onboarding_responses      enable row level security;
alter table onboarding_progress       enable row level security;
alter table onboarding_required_items enable row level security;
alter table onboarding_activity       enable row level security;


-- ── 7. RLS POLICIES ───────────────────────────────────────────────────────────

-- Template / sections / questions: readable by anyone in the agency (incl. the
-- agency's client users, via caller_agency_id()); writable by agency admins.
do $$
declare t text;
begin
  foreach t in array array['onboarding_templates','onboarding_sections','onboarding_questions']
  loop
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('create policy %I on %I for select using (agency_id = public.caller_agency_id())', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format($f$create policy %I on %I for all
      using (agency_id = public.current_agency_id() and public.is_agency_admin())
      with check (agency_id = public.current_agency_id() and public.is_agency_admin())$f$, t||'_write', t);
  end loop;
end $$;

-- Client-scoped tables: agency admin/assigned read; agency admin OR the client
-- user writes their own.
do $$
declare t text;
begin
  foreach t in array array['onboarding_responses','onboarding_progress','onboarding_required_items']
  loop
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

-- onboarding_activity: read like the client tables; insert by the acting user.
drop policy if exists "onboarding_activity_select" on onboarding_activity;
create policy "onboarding_activity_select" on onboarding_activity for select
  using (
    (agency_id = public.current_agency_id() and (public.is_agency_admin() or client_id is null or public.is_assigned_to_client(client_id)))
    or client_id = public.current_client_id()
  );
drop policy if exists "onboarding_activity_insert" on onboarding_activity;
create policy "onboarding_activity_insert" on onboarding_activity for insert
  with check (
    actor_profile_id = auth.uid()
    and (agency_id = public.current_agency_id() or client_id = public.current_client_id())
  );


-- ── 8. GRANTS ─────────────────────────────────────────────────────────────────

grant select, insert, update on onboarding_templates      to authenticated;
grant select, insert, update on onboarding_sections       to authenticated;
grant select, insert, update on onboarding_questions      to authenticated;
grant select, insert, update on onboarding_responses      to authenticated;
grant select, insert, update on onboarding_progress       to authenticated;
grant select, insert, update on onboarding_required_items to authenticated;
grant select, insert         on onboarding_activity       to authenticated;

grant execute on function public.seed_onboarding_template(uuid)  to authenticated;
grant execute on function public.ensure_client_onboarding(uuid)  to authenticated;
