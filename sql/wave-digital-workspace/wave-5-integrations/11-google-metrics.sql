-- ==============================================================
-- ELIORA OS.M - DIGITAL INTEGRATIONS: GOOGLE PHASE 1 SLICE G1
-- FILE 11: GA4 + SEARCH CONSOLE DAILY METRICS
-- ==============================================================
-- Purpose:      Two narrow, additive historical-metrics tables. Neither
--               tracking_configurations nor seo_profiles can hold a
--               time series: tracking_configurations has no date
--               dimension at all, and seo_profiles is hard-constrained
--               to exactly one row per client (seo_profiles_one_per_
--               client) -- structurally incapable of a time series. This
--               file does not touch either table's own shape, and does
--               not create a second GA4/SEO configuration system --
--               these tables hold ONLY dated metric values, resolving
--               back to the existing canonical records via FK.
--
-- Scope:        No Edge Function writes to these tables yet (Slice G4,
--               not built here). This file is schema only.
--
-- Metrics:      ga4_daily_metrics: active_users, sessions, engaged_
--               sessions, engagement_rate, screen_page_views. key_events
--               (conversions) is deliberately OMITTED from this file --
--               current GA4 API terminology for this metric is actively
--               in flux (see the Slice G1 audit's official-doc
--               revalidation), and the exact stable API metric name has
--               not yet been confirmed via a live getMetadata call. Add
--               it in a later, additive migration once Slice G4
--               confirms it, rather than committing to a name now that
--               may already be wrong.
--
--               search_console_daily_metrics: clicks, impressions, ctr,
--               average_position -- all confirmed stable, current
--               Search Console API fields.
--
-- NULL vs zero: Every metric column is nullable with NO default. NULL
--               means the provider did not report a value for that
--               day/field (a failed or partial fetch); it is never
--               written as 0. A future sync writer must never coerce a
--               missing value to zero -- that would misrepresent "no
--               data" as "zero activity," a real, meaningful difference
--               (e.g. clicks = 0 is a fact Google actually reported;
--               clicks = NULL means Google's response for that day
--               could not be obtained).
--
-- Idempotency:  One row per (canonical configuration, date) -- a
--               repeated sync for a day already recorded MUST upsert
--               this row (same pattern as social_channel_snapshots'
--               proven one-row-per-channel-per-day model), never insert
--               a duplicate historical point.
--
-- Tenant        Every row's agency_id/client_id is validated, via
-- integrity:    trigger, against BOTH its canonical configuration
--               (tracking_configurations / seo_profiles) AND its
--               integration_resources row -- and the resource itself
--               must be the correct resource_type and must actually be
--               linked to that exact canonical record (not merely
--               assigned to the same client). Enforced entirely
--               server-side/database-side -- a future sync Edge
--               Function's own request payload is never the source of
--               truth for these values, matching the "never trust
--               browser-supplied tenant IDs" rule already applied
--               throughout this wave.
--
-- FK deletion   tracking_configuration_id/integration_resource_id (and
-- behavior:     seo_profile_id/integration_resource_id) are NOT NULL
--               with ON DELETE CASCADE. Neither their canonical record
--               nor their integration_resources row is ever deleted by
--               any flow this project has designed (disconnect changes
--               integration_connections.status only -- it does not
--               delete tracking_configurations/seo_profiles/
--               integration_resources rows; see the Slice G1 report's
--               disconnect design). CASCADE here is therefore a
--               referential-integrity safety net for an edge case with
--               no current designed trigger, not an expected operational
--               path -- historical metrics survive disconnect precisely
--               because nothing disconnect does ever reaches these FKs.
--               A hard delete of the canonical record itself (e.g. a
--               deliberate admin removing a tracking_configurations row
--               via the existing deleteTrackingConfiguration path) is a
--               different, rare, explicit action, and IS expected to
--               take its historical metrics with it -- an orphaned
--               metrics row pointing at a canonical record that no
--               longer exists would violate the "must unambiguously
--               resolve to... canonical configuration" requirement.
--
-- Depends on:   10-google-resource-linkage.sql (integration_resource_
--               type's ga4_property/search_console_site values, the
--               linked_tracking_configuration_id/linked_seo_profile_id
--               columns, tracking_configurations.integration_resource_id/
--               seo_profiles.integration_resource_id).
-- Execution:    Run after 10. NOT YET RUN -- prepared for manual review.
--               Idempotent -- safe to re-run once applied.
-- ==============================================================

-- -- 1. GA4 DAILY METRICS -----------------------------------------------------------
create table if not exists ga4_daily_metrics (
  id                        uuid          primary key default uuid_generate_v4(),
  agency_id                 uuid          not null references agencies(id) on delete cascade,
  client_id                 uuid          not null references clients(id)  on delete cascade,

  tracking_configuration_id uuid          not null references tracking_configurations(id) on delete cascade,
  integration_resource_id   uuid          not null references integration_resources(id)   on delete cascade,

  metric_date               date          not null,

  active_users              integer       check (active_users is null or active_users >= 0),
  sessions                  integer       check (sessions is null or sessions >= 0),
  engaged_sessions          integer       check (engaged_sessions is null or engaged_sessions >= 0),
  engagement_rate           numeric(6,3)  check (engagement_rate is null or engagement_rate >= 0),
  screen_page_views         integer       check (screen_page_views is null or screen_page_views >= 0),

  -- 'integration' for every row this table will ever hold in practice
  -- (no manual-entry UI is planned for this table -- GA4 numbers are
  -- either synced for real or absent) -- kept as a text column rather
  -- than an enum, matching social_channel_snapshots' own precedent, in
  -- case a manual-correction path is ever added later without a schema
  -- change.
  source                    text          not null default 'integration' check (source in ('manual', 'integration')),

  created_at                timestamptz   not null default now(),

  constraint ga4_daily_metrics_unique_per_day unique (tracking_configuration_id, metric_date)
);

create index if not exists ga4_daily_metrics_config_idx   on ga4_daily_metrics(tracking_configuration_id, metric_date desc);
create index if not exists ga4_daily_metrics_client_idx   on ga4_daily_metrics(client_id, metric_date desc);
create index if not exists ga4_daily_metrics_resource_idx on ga4_daily_metrics(integration_resource_id, metric_date desc);

create or replace function public.check_ga4_daily_metric_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _tracking public.tracking_configurations;
  _resource public.integration_resources;
begin
  select * into _tracking from public.tracking_configurations where id = new.tracking_configuration_id;
  if not found then
    raise exception 'tracking_configuration_not_found: Referenced tracking configuration does not exist';
  end if;
  if _tracking.agency_id <> new.agency_id or _tracking.client_id <> new.client_id then
    raise exception 'tracking_configuration_tenant_mismatch: Referenced tracking configuration belongs to a different agency/client';
  end if;

  select * into _resource from public.integration_resources where id = new.integration_resource_id;
  if not found then
    raise exception 'integration_resource_not_found: Referenced integration resource does not exist';
  end if;
  if _resource.agency_id <> new.agency_id or _resource.client_id <> new.client_id then
    raise exception 'integration_resource_tenant_mismatch: Referenced integration resource belongs to a different agency/client';
  end if;
  if _resource.resource_type <> 'ga4_property' then
    raise exception 'integration_resource_type_mismatch: Referenced integration resource is not a GA4 property';
  end if;
  if _resource.linked_tracking_configuration_id is distinct from new.tracking_configuration_id then
    raise exception 'integration_resource_link_mismatch: Referenced integration resource is not linked to this tracking configuration';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_ga4_daily_metric_tenant_match() from public;

drop trigger if exists ga4_daily_metrics_check_tenant_match_trg on ga4_daily_metrics;
create trigger ga4_daily_metrics_check_tenant_match_trg
  before insert or update on ga4_daily_metrics
  for each row execute function check_ga4_daily_metric_tenant_match();

alter table ga4_daily_metrics enable row level security;

drop policy if exists "ga4_daily_metrics_select" on ga4_daily_metrics;
create policy "ga4_daily_metrics_select" on ga4_daily_metrics
  for select using (agency_id = public.current_agency_id());

drop policy if exists "ga4_daily_metrics_insert" on ga4_daily_metrics;
create policy "ga4_daily_metrics_insert" on ga4_daily_metrics
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "ga4_daily_metrics_update" on ga4_daily_metrics;
create policy "ga4_daily_metrics_update" on ga4_daily_metrics
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "ga4_daily_metrics_delete" on ga4_daily_metrics;
create policy "ga4_daily_metrics_delete" on ga4_daily_metrics
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on ga4_daily_metrics to authenticated;

-- -- 2. SEARCH CONSOLE DAILY METRICS --------------------------------------------------
create table if not exists search_console_daily_metrics (
  id                       uuid          primary key default uuid_generate_v4(),
  agency_id                uuid          not null references agencies(id) on delete cascade,
  client_id                uuid          not null references clients(id)  on delete cascade,

  seo_profile_id           uuid          not null references seo_profiles(id)         on delete cascade,
  integration_resource_id  uuid          not null references integration_resources(id) on delete cascade,

  metric_date              date          not null,

  clicks                   integer       check (clicks is null or clicks >= 0),
  impressions              integer       check (impressions is null or impressions >= 0),
  ctr                      numeric(6,4)  check (ctr is null or ctr >= 0),
  average_position         numeric(6,2)  check (average_position is null or average_position >= 0),

  source                   text          not null default 'integration' check (source in ('manual', 'integration')),

  created_at               timestamptz   not null default now(),

  constraint search_console_daily_metrics_unique_per_day unique (seo_profile_id, metric_date)
);

-- Indexes for client/date and resource/date retrieval, per the Slice G1
-- spec -- same shape as ga4_daily_metrics above.
create index if not exists search_console_daily_metrics_profile_idx  on search_console_daily_metrics(seo_profile_id, metric_date desc);
create index if not exists search_console_daily_metrics_client_idx   on search_console_daily_metrics(client_id, metric_date desc);
create index if not exists search_console_daily_metrics_resource_idx on search_console_daily_metrics(integration_resource_id, metric_date desc);

create or replace function public.check_search_console_daily_metric_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _seo      public.seo_profiles;
  _resource public.integration_resources;
begin
  select * into _seo from public.seo_profiles where id = new.seo_profile_id;
  if not found then
    raise exception 'seo_profile_not_found: Referenced SEO profile does not exist';
  end if;
  if _seo.agency_id <> new.agency_id or _seo.client_id <> new.client_id then
    raise exception 'seo_profile_tenant_mismatch: Referenced SEO profile belongs to a different agency/client';
  end if;

  select * into _resource from public.integration_resources where id = new.integration_resource_id;
  if not found then
    raise exception 'integration_resource_not_found: Referenced integration resource does not exist';
  end if;
  if _resource.agency_id <> new.agency_id or _resource.client_id <> new.client_id then
    raise exception 'integration_resource_tenant_mismatch: Referenced integration resource belongs to a different agency/client';
  end if;
  if _resource.resource_type <> 'search_console_site' then
    raise exception 'integration_resource_type_mismatch: Referenced integration resource is not a Search Console site';
  end if;
  if _resource.linked_seo_profile_id is distinct from new.seo_profile_id then
    raise exception 'integration_resource_link_mismatch: Referenced integration resource is not linked to this SEO profile';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_search_console_daily_metric_tenant_match() from public;

drop trigger if exists search_console_daily_metrics_check_tenant_match_trg on search_console_daily_metrics;
create trigger search_console_daily_metrics_check_tenant_match_trg
  before insert or update on search_console_daily_metrics
  for each row execute function check_search_console_daily_metric_tenant_match();

alter table search_console_daily_metrics enable row level security;

drop policy if exists "search_console_daily_metrics_select" on search_console_daily_metrics;
create policy "search_console_daily_metrics_select" on search_console_daily_metrics
  for select using (agency_id = public.current_agency_id());

drop policy if exists "search_console_daily_metrics_insert" on search_console_daily_metrics;
create policy "search_console_daily_metrics_insert" on search_console_daily_metrics
  for insert
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "search_console_daily_metrics_update" on search_console_daily_metrics;
create policy "search_console_daily_metrics_update" on search_console_daily_metrics
  for update
  using  (agency_id = public.current_agency_id() and public.is_agency_admin())
  with check (agency_id = public.current_agency_id() and public.is_agency_admin());

drop policy if exists "search_console_daily_metrics_delete" on search_console_daily_metrics;
create policy "search_console_daily_metrics_delete" on search_console_daily_metrics
  for delete
  using (agency_id = public.current_agency_id() and public.is_agency_admin());

grant select, insert, update, delete on search_console_daily_metrics to authenticated;

-- -- 3. VERIFICATION (informational -- full suite lives in 12-verify-google-g1.sql) --
-- select table_name from information_schema.tables where table_name in ('ga4_daily_metrics','search_console_daily_metrics'); -> expected: 2 rows
-- select conname from pg_constraint where conname in ('ga4_daily_metrics_unique_per_day','search_console_daily_metrics_unique_per_day'); -> expected: 2 rows
-- select column_name from information_schema.columns where table_name = 'ga4_daily_metrics' and column_name = 'key_events'; -> expected: 0 rows (deliberately omitted, see header)
-- select relrowsecurity from pg_class where relname in ('ga4_daily_metrics','search_console_daily_metrics'); -> expected: true, true
