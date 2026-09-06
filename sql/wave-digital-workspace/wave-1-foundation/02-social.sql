/*
==============================================================
ELIORA OS.M — DIGITAL WORKSPACE WAVE 1: SOCIAL CHANNELS + TRACKER
==============================================================
Purpose:      Social Channels owns the ACCOUNT/PROFILE record. Social
              Tracker owns historical growth metrics via appendable
              snapshots. Neither creates, schedules, or publishes posts —
              that is Marketing's responsibility, not Digital's.

Depends on:   01-websites-domains.sql (digital_ownership_status,
              digital_integration_status).
Execution:    Paste after 01-websites-domains.sql. Idempotent.
==============================================================
*/

-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────
-- Constrained but extensible: a real enum for the common platforms, with
-- 'other' + a free-text label for anything not yet named — same principle
-- used for Business Listings' provider enum below in 03.
do $$ begin
  create type social_platform as enum (
    'instagram','facebook','tiktok','linkedin','youtube','twitter_x','pinterest','threads','other'
  );
exception when duplicate_object then null; end $$;

-- ── 2. SOCIAL CHANNELS TABLE ──────────────────────────────────────────────────
-- A client may have MULTIPLE accounts on the same platform (agency account +
-- founder personal account, regional accounts, etc.) — no uniqueness on
-- platform alone, only on (client, platform, handle) to catch accidental
-- duplicate entry of the exact same account.
create table if not exists social_channels (
  id                    uuid                        primary key default uuid_generate_v4(),
  agency_id             uuid                        not null references agencies(id) on delete cascade,
  client_id             uuid                        not null references clients(id)  on delete cascade,

  platform              social_platform             not null,
  platform_other_label  text,                       -- required when platform = 'other'
  handle                text,
  profile_url           text,
  external_account_id   text,                       -- provider-side account ID, once integrated
  account_type          text,                       -- e.g. business, creator, personal — descriptive, not enumerated

  ownership_status      digital_ownership_status    not null default 'unknown',
  integration_status    digital_integration_status  not null default 'manual',
  is_active             boolean                     not null default true,
  -- Reserved for Wave 3 (no hard uniqueness constraint yet — "primary
  -- social account" was not a Wave 1 requirement, unlike primary website).
  is_primary            boolean                     not null default false,

  -- Only for genuinely provider-specific extensibility that doesn't warrant
  -- its own column yet (e.g. a platform-specific field used by one provider's
  -- future sync). Never used for anything RLS or health logic depends on.
  metadata              jsonb                       not null default '{}',
  notes                 text,

  created_by            uuid                        references profiles(id) on delete set null,
  updated_by            uuid                        references profiles(id) on delete set null,
  created_at            timestamptz                 not null default now(),
  updated_at            timestamptz                 not null default now(),

  constraint social_channels_other_label_required
    check (platform <> 'other' or platform_other_label is not null)
);

create unique index if not exists social_channels_client_handle_idx
  on social_channels(client_id, platform, lower(coalesce(handle, '')));
create index if not exists social_channels_client_idx  on social_channels(client_id, is_active);
create index if not exists social_channels_agency_idx  on social_channels(agency_id, updated_at desc);
create index if not exists social_channels_platform_idx on social_channels(client_id, platform);

drop trigger if exists social_channels_set_updated_at on social_channels;
create trigger social_channels_set_updated_at
  before update on social_channels
  for each row execute function set_updated_at();

alter table social_channels enable row level security;

drop policy if exists "social_channels_select" on social_channels;
create policy "social_channels_select" on social_channels
  for select using (agency_id = public.current_agency_id());

drop policy if exists "social_channels_insert" on social_channels;
create policy "social_channels_insert" on social_channels
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "social_channels_update" on social_channels;
create policy "social_channels_update" on social_channels
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "social_channels_delete" on social_channels;
create policy "social_channels_delete" on social_channels
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on social_channels to authenticated;

-- ── 3. SOCIAL CHANNEL SNAPSHOTS (Social Tracker) ─────────────────────────────
-- Appendable historical record — one row per (channel, day). Manual entry
-- today; a future provider sync can upsert into the exact same table using
-- the same uniqueness constraint for idempotency (re-running a sync for a
-- day that was already recorded updates that row instead of duplicating it).
-- Deliberately NOT a table that "only manual entry" can use — a sync job
-- writes here with `source = 'integration'` and nothing else changes.
create table if not exists social_channel_snapshots (
  id                 uuid              primary key default uuid_generate_v4(),
  agency_id          uuid              not null references agencies(id) on delete cascade,
  client_id          uuid              not null references clients(id)  on delete cascade,
  social_channel_id  uuid              not null references social_channels(id) on delete cascade,

  snapshot_date      date              not null,

  followers          integer           check (followers is null or followers >= 0),
  following          integer           check (following is null or following >= 0),
  reach              integer           check (reach is null or reach >= 0),
  impressions        integer           check (impressions is null or impressions >= 0),
  engagements        integer           check (engagements is null or engagements >= 0),
  engagement_rate    numeric(6,3)      check (engagement_rate is null or engagement_rate >= 0),
  profile_views      integer           check (profile_views is null or profile_views >= 0),
  link_clicks        integer           check (link_clicks is null or link_clicks >= 0),
  posts_count        integer           check (posts_count is null or posts_count >= 0),

  source             text              not null default 'manual' check (source in ('manual','integration')),

  created_by         uuid              references profiles(id) on delete set null,
  created_at         timestamptz       not null default now(),

  -- Idempotency: one snapshot per channel per day, regardless of source.
  -- A repeated sync run for the same day upserts this row rather than
  -- creating a duplicate historical point.
  constraint social_channel_snapshots_unique_per_day unique (social_channel_id, snapshot_date)
);

create index if not exists social_snapshots_channel_idx on social_channel_snapshots(social_channel_id, snapshot_date desc);
create index if not exists social_snapshots_client_idx  on social_channel_snapshots(client_id, snapshot_date desc);

-- Same class of gap as domains.website_id (see check_website_tenant_match()
-- in 01-websites-domains.sql): a plain FK on social_channel_id only proves
-- the channel exists, not that it belongs to the same agency/client as this
-- snapshot. Without this, a snapshot tagged to Client A's agency_id/client_id
-- could reference a channel actually owned by Client B.
--
-- OWNERSHIP CONTRACT: this function is owned by THIS file (02) — no later
-- file references it, but if one ever needs to, it must only CREATE TRIGGER
-- against it, never DROP or CREATE OR REPLACE it. `create or replace` below
-- is always safe to re-run even with the live dependent trigger created
-- right after it; a plain `drop function`, by contrast, fails with Postgres
-- error 2BP01 the moment any trigger using it still exists. The only place
-- this function is ever dropped is rollback.sql, and only AFTER
-- social_channel_snapshots (and every other Digital table) has already been
-- dropped.
create or replace function public.check_social_channel_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _channel social_channels;
begin
  select * into _channel from social_channels where id = new.social_channel_id;
  if not found then
    raise exception 'social_channel_not_found: Referenced social channel does not exist';
  end if;
  if _channel.agency_id <> new.agency_id or _channel.client_id <> new.client_id then
    raise exception 'social_channel_tenant_mismatch: Referenced social channel belongs to a different agency/client';
  end if;
  return new;
end;
$$;

drop trigger if exists social_channel_snapshots_check_channel_trg on social_channel_snapshots;
create trigger social_channel_snapshots_check_channel_trg
  before insert or update on social_channel_snapshots
  for each row execute function check_social_channel_tenant_match();

alter table social_channel_snapshots enable row level security;

drop policy if exists "social_channel_snapshots_select" on social_channel_snapshots;
create policy "social_channel_snapshots_select" on social_channel_snapshots
  for select using (agency_id = public.current_agency_id());

drop policy if exists "social_channel_snapshots_insert" on social_channel_snapshots;
create policy "social_channel_snapshots_insert" on social_channel_snapshots
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "social_channel_snapshots_update" on social_channel_snapshots;
create policy "social_channel_snapshots_update" on social_channel_snapshots
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "social_channel_snapshots_delete" on social_channel_snapshots;
create policy "social_channel_snapshots_delete" on social_channel_snapshots
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on social_channel_snapshots to authenticated;

-- ── 4. VERIFICATION (informational) ──────────────────────────────────────────
-- select count(*) from social_channels;
-- select count(*) from social_channel_snapshots;
-- select conname from pg_constraint where conname = 'social_channel_snapshots_unique_per_day';
-- select tgname from pg_trigger where tgname = 'social_channel_snapshots_check_channel_trg';
