/*
==============================================================
ELIORA OS.M -- GOOGLE PHASE 1 SLICE G1: VERIFICATION
==============================================================
Sections 0-2 are READ-ONLY -- plain SELECTs, safe to run any time,
against real production data, with zero side effects. Same convention as
06-verify-wave-5.sql.

Section 3 (INTEGRITY FIXTURE TESTS) is NOT read-only -- it creates
throwaway agencies/clients/connections/resources inside one explicit
transaction and ends with ROLLBACK, so nothing it does is ever
persisted. Run it in the Supabase SQL Editor (which runs a pasted script
as one session/transaction) as a deliberate, separate step from sections
0-2 -- do not mix it into a script you intend to keep running against
production carelessly. Every fixture row uses an obviously-fake
name/slug so it is unmistakable if anything were ever left behind by a
mistake (it should not be, given the ROLLBACK).

This file HAS since been run against a live database. Section 3's first
pass surfaced a real bug -- not in this fixture's logic, but in the
deployed check_integration_resource_canonical_link_consistency() and its
two siblings (from 10-google-resource-linkage.sql), which trusted a
potentially-stale NEW value when the same row was touched by more than
one statement (e.g. INSERT then UPDATE) before SET CONSTRAINTS ALL
IMMEDIATE fired. See 13-fix-google-link-consistency.sql for the full
root-cause trace and the fix. Section 3's statement sequence below is
unchanged by that fix -- it was a legitimate test that correctly caught a
real defect; it does not need correcting, only 13 does. Re-run this file
(section 3 in particular) only AFTER 13 has been applied.
==============================================================
*/

-- ── 0. DETAILED PREFLIGHT: SAME-AGENCY CROSS-CLIENT LINKED CONFLICTS ──────────
-- The exact identification query referenced by 10-google-resource-
-- linkage.sql's abort guard. Run this FIRST, before 10, any time you
-- want to see (not just count) which rows would trip the guard.
select
  agency_id,
  provider,
  resource_type,
  external_resource_id,
  array_agg(id)        as conflicting_resource_ids,
  array_agg(client_id) as conflicting_client_ids
from integration_resources
where client_id is not null
  and linked_channel_id is not null
group by agency_id, provider, resource_type, external_resource_id
having count(distinct client_id) > 1;
-- expected today: 0 rows (no known conflicts) -- if this returns any
-- rows, 10-google-resource-linkage.sql's own preflight guard will abort
-- automatically; this query exists so you can see WHICH rows before
-- deciding how to resolve them manually. Do not auto-resolve.

-- ── 1. SCHEMA ──────────────────────────────────────────────────────────────────
select table_name, column_name, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and (
     (table_name = 'integration_connections' and column_name = 'client_id')
     or (table_name = 'integration_resources' and column_name = 'client_id')
     or (table_name = 'integration_credentials' and column_name = 'client_id')
     or (table_name = 'integration_sync_runs' and column_name = 'client_id')
     or (table_name = 'integration_oauth_states' and column_name = 'client_id')
   )
 order by table_name;
-- expected: is_nullable = YES for the first 4; NO for integration_oauth_states

select indexname from pg_indexes
 where indexname in (
   'integration_connections_client_scoped_unique_idx',
   'integration_connections_agency_scoped_unique_idx',
   'integration_resources_agency_identity_idx'
 )
 order by indexname;
-- expected: exactly 3 rows

select indexname from pg_indexes where indexname = 'integration_connections_provider_account_unique_idx';
-- expected: 0 rows (replaced)

select unnest(enum_range(null::integration_resource_type))::text as resource_type;
-- expected: facebook_page, instagram_business_account, ga4_property, search_console_site

select unnest(enum_range(null::integration_token_type))::text as token_type;
-- expected: user_long_lived, page, google_access, google_refresh (assumes 08 already applied)

select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and (
     (table_name = 'integration_resources' and column_name in ('linked_tracking_configuration_id','linked_seo_profile_id'))
     or (table_name in ('tracking_configurations','seo_profiles') and column_name = 'integration_resource_id')
   )
 order by table_name, column_name;
-- expected: 4 rows total

select conname from pg_constraint where conname = 'integration_resources_link_status_consistency';
-- expected: 1 row -- its existence here also proves every EXISTING row
-- already satisfied the new (generalized) shape: Postgres validates all
-- current rows against a plain ADD CONSTRAINT at the moment it is added
-- (this migration did not use NOT VALID), so if 10 applied successfully
-- at all, this check has already effectively passed for all of today's
-- Meta data -- no separate "do existing rows still validate" query is
-- needed.

select table_name from information_schema.tables
 where table_name in ('ga4_daily_metrics','search_console_daily_metrics');
-- expected: 2 rows

select tgname, tgrelid::regclass::text as table_name, tgdeferrable, tginitdeferred
  from pg_trigger
 where tgname in (
   'integration_resources_check_canonical_link_trg',
   'tracking_configurations_check_resource_link_trg',
   'seo_profiles_check_resource_link_trg'
 )
 order by tgname;
-- expected: 3 rows, tgdeferrable = true and tginitdeferred = true for all 3

select tgname, tgrelid::regclass::text as table_name
  from pg_trigger
 where tgname in (
   'ga4_daily_metrics_check_tenant_match_trg',
   'search_console_daily_metrics_check_tenant_match_trg'
 )
 order by tgname;
-- expected: 2 rows

-- ── 2. SECURITY ────────────────────────────────────────────────────────────────
select relname, relrowsecurity
  from pg_class
 where relname in ('ga4_daily_metrics','search_console_daily_metrics')
 order by relname;
-- expected: relrowsecurity = true for both

select tablename, policyname, cmd
  from pg_policies
 where tablename in ('ga4_daily_metrics','search_console_daily_metrics')
 order by tablename, cmd;
-- expected: 4 rows each (select/insert/update/delete)

-- integration_credentials must remain completely browser-inaccessible --
-- unaffected by this slice, re-confirmed here.
select has_table_privilege('authenticated', 'public.integration_credentials', 'SELECT') as can_select_credentials;
-- expected: false

select policyname from pg_policies where tablename = 'integration_credentials';
-- expected: 0 rows (still default-deny, unchanged)

-- Every new/replaced SECURITY DEFINER function in 09-11 uses the
-- maximally-restricted `search_path = ''` pattern (not `= public`) with
-- every table reference schema-qualified in the function source itself
-- -- see the Slice G1 security review for why this is the safer choice
-- than relying on `public` staying non-writable by untrusted roles.
select proname, prosecdef,
       (select setting from unnest(proconfig) as setting where setting like 'search_path=%') as search_path_setting
  from pg_proc
 where proname in (
   'check_integration_credential_tenant_match',
   'check_integration_sync_run_tenant_match',
   'check_integration_resource_tenant_match',
   'check_integration_resource_canonical_link_consistency',
   'check_tracking_configuration_resource_link_consistency',
   'check_seo_profile_resource_link_consistency',
   'check_ga4_daily_metric_tenant_match',
   'check_search_console_daily_metric_tenant_match'
 )
 order by proname;
-- expected: 8 rows, prosecdef = true and search_path_setting = 'search_path=' (empty after the equals sign) for all

-- Confirms none of the 8 functions above are directly callable by
-- authenticated/anon (they remain callable ONLY as triggers, which does
-- not go through this grant at all -- see 09's REVOKE comment).
select p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_call,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_can_call
  from pg_proc p
 where p.proname in (
   'check_integration_credential_tenant_match',
   'check_integration_sync_run_tenant_match',
   'check_integration_resource_tenant_match',
   'check_integration_resource_canonical_link_consistency',
   'check_tracking_configuration_resource_link_consistency',
   'check_seo_profile_resource_link_consistency',
   'check_ga4_daily_metric_tenant_match',
   'check_search_console_daily_metric_tenant_match'
 )
 order by p.proname;
-- expected: 8 rows, both columns false for every row

-- Environment assumption this whole hardening pattern's belt-and-braces
-- reasoning depends on being checked, not assumed -- confirms untrusted
-- roles cannot create objects in `public` at all (the classic search_path-
-- hijack precondition). This should be false regardless of the search_path
-- hardening above; the hardening exists specifically so the answer to
-- this query changing later (a future misconfiguration) would not by
-- itself create a vulnerability in these 8 functions.
select has_schema_privilege('authenticated', 'public', 'CREATE') as authenticated_can_create_in_public,
       has_schema_privilege('anon', 'public', 'CREATE')          as anon_can_create_in_public;
-- expected: both false

-- ── 3. INTEGRITY FIXTURE TESTS (transaction-wrapped -- ROLLBACK at the end) ────
-- Not read-only. Creates throwaway fixtures, exercises the generalized
-- triggers, then rolls everything back. Run as its own step.
begin;

do $$
declare
  _agency_a  uuid;
  _agency_b  uuid;
  _client_a1 uuid;
  _client_a2 uuid;
  _client_b1 uuid;
  _conn_x    uuid; -- Agency A, Google identity X, agency-scoped
  _conn_y    uuid; -- Agency A, Google identity Y, agency-scoped (same agency, different identity)
  _conn_b    uuid; -- Agency B, Google identity Z, agency-scoped
  _resource_x uuid; -- ga4-prop-999 discovered under connection X
  _resource_y uuid; -- ga4-prop-999 ALSO discovered under connection Y (same identity, different connection)
  _resource_b uuid; -- ga4-prop-999 discovered under Agency B's connection
  _tracking_a1 uuid;
  _tracking_a2 uuid;
  _tracking_b1 uuid;
  _seo_b1      uuid;
  _caught boolean;
begin
  -- Fixtures -----------------------------------------------------------------
  -- uuid_generate_v4() (uuid-ossp) is used here rather than gen_random_uuid()
  -- purely because it is already the confirmed-working generator every
  -- other table in this schema relies on for its own primary keys.
  insert into agencies (name, slug) values ('G1 Verify Agency A', 'g1-verify-agency-a-' || uuid_generate_v4()) returning id into _agency_a;
  insert into agencies (name, slug) values ('G1 Verify Agency B', 'g1-verify-agency-b-' || uuid_generate_v4()) returning id into _agency_b;
  insert into clients (agency_id, business_name) values (_agency_a, 'G1 Verify Client A1') returning id into _client_a1;
  insert into clients (agency_id, business_name) values (_agency_a, 'G1 Verify Client A2') returning id into _client_a2;
  insert into clients (agency_id, business_name) values (_agency_b, 'G1 Verify Client B1') returning id into _client_b1;

  -- Test: agency-scoped connection (client_id NULL) is structurally valid.
  insert into integration_connections (agency_id, client_id, provider, provider_account_id, status)
    values (_agency_a, null, 'google', 'g1-verify-google-sub-X', 'connected') returning id into _conn_x;
  insert into integration_connections (agency_id, client_id, provider, provider_account_id, status)
    values (_agency_a, null, 'google', 'g1-verify-google-sub-Y', 'connected') returning id into _conn_y;
  insert into integration_connections (agency_id, client_id, provider, provider_account_id, status)
    values (_agency_b, null, 'google', 'g1-verify-google-sub-Z', 'connected') returning id into _conn_b;
  raise notice 'PASS: agency-scoped connections (client_id NULL) inserted successfully -- %, %, %', _conn_x, _conn_y, _conn_b;

  -- Test: unassigned resource (client_id NULL) is structurally valid.
  insert into integration_resources (agency_id, client_id, connection_id, provider, resource_type, external_resource_id)
    values (_agency_a, null, _conn_x, 'google', 'ga4_property', 'g1-verify-ga4-prop-999') returning id into _resource_x;
  raise notice 'PASS: unassigned resource (client_id NULL) inserted successfully -- %', _resource_x;

  -- Same external identity, discovered a second time under a DIFFERENT
  -- connection within the SAME agency (two Google identities, same
  -- underlying GA4 property visible to both) -- allowed at discovery time.
  insert into integration_resources (agency_id, client_id, connection_id, provider, resource_type, external_resource_id)
    values (_agency_a, null, _conn_y, 'google', 'ga4_property', 'g1-verify-ga4-prop-999') returning id into _resource_y;

  -- Cross-agency: Agency B independently discovers the SAME external
  -- identity under its own connection.
  insert into integration_resources (agency_id, client_id, connection_id, provider, resource_type, external_resource_id)
    values (_agency_b, null, _conn_b, 'google', 'ga4_property', 'g1-verify-ga4-prop-999') returning id into _resource_b;

  -- Canonical tracking_configurations rows to link against.
  insert into tracking_configurations (agency_id, client_id, provider, status)
    values (_agency_a, _client_a1, 'ga4', 'manual') returning id into _tracking_a1;
  insert into tracking_configurations (agency_id, client_id, provider, status)
    values (_agency_a, _client_a2, 'ga4', 'manual') returning id into _tracking_a2;
  insert into tracking_configurations (agency_id, client_id, provider, status)
    values (_agency_b, _client_b1, 'ga4', 'manual') returning id into _tracking_b1;

  -- Also needed for the final test below (Search Console resource_type
  -- mismatch): a real, tenant-matching seo_profiles row for Client B1 --
  -- without this, that test would fail for the wrong reason (a missing
  -- seo_profile_id / NOT NULL violation) rather than the intended
  -- resource_type check.
  insert into seo_profiles (agency_id, client_id) values (_agency_b, _client_b1) returning id into _seo_b1;

  -- Assign + link resource_x to Client A1 (both directions, in one
  -- transaction, order does not matter -- the bidirectional consistency
  -- check is DEFERRED to commit/SET CONSTRAINTS IMMEDIATE, not immediate).
  update integration_resources set client_id = _client_a1, linked_tracking_configuration_id = _tracking_a1, link_status = 'linked' where id = _resource_x;
  update tracking_configurations set integration_resource_id = _resource_x where id = _tracking_a1;
  set constraints all immediate; -- force the deferred bidirectional check to run now, without committing
  raise notice 'PASS: resource_x assigned+linked to Client A1 successfully';
  set constraints all deferred; -- restore deferred mode for the rest of this block

  -- Test: linking resource_y (SAME agency, SAME external identity, via a
  -- DIFFERENT connection) to Client A2 must be REJECTED (Direction B).
  _caught := false;
  begin
    update integration_resources set client_id = _client_a2, linked_tracking_configuration_id = _tracking_a2, link_status = 'linked' where id = _resource_y;
    update tracking_configurations set integration_resource_id = _resource_y where id = _tracking_a2;
    set constraints all immediate;
  exception when others then
    _caught := true;
    raise notice 'PASS: same-agency cross-client duplicate link correctly rejected -- %', sqlerrm;
  end;
  set constraints all deferred;
  if not _caught then
    raise exception 'FAIL: same-agency cross-client duplicate link was NOT rejected -- Direction B fix is not working';
  end if;

  -- Test: linking resource_b (DIFFERENT agency, SAME external identity)
  -- to Client B1 must be ALLOWED (no cross-agency conflict).
  update integration_resources set client_id = _client_b1, linked_tracking_configuration_id = _tracking_b1, link_status = 'linked' where id = _resource_b;
  update tracking_configurations set integration_resource_id = _resource_b where id = _tracking_b1;
  set constraints all immediate;
  raise notice 'PASS: cross-agency same-external-identity link correctly allowed';
  set constraints all deferred;

  -- Test: a resource cannot be marked 'linked' while client_id is NULL.
  -- Deliberately targets _tracking_a2 (not _tracking_a1) -- _tracking_a1
  -- is already legitimately claimed by resource_x above, and targeting
  -- it here would trip the cross-destination conflict check instead of
  -- the specific invariant this test means to exercise. _tracking_a2's
  -- earlier link attempt (resource_y) was caught and rolled back by its
  -- own exception handler above, so it is still unclaimed here.
  _caught := false;
  begin
    insert into integration_resources (agency_id, client_id, connection_id, provider, resource_type, external_resource_id, linked_tracking_configuration_id, link_status)
      values (_agency_a, null, _conn_x, 'google', 'ga4_property', 'g1-verify-ga4-prop-should-fail', _tracking_a2, 'linked');
  exception when others then
    _caught := true;
    raise notice 'PASS: linked resource without client_id correctly rejected -- %', sqlerrm;
  end;
  if not _caught then
    raise exception 'FAIL: a linked resource without client_id was NOT rejected';
  end if;

  -- Test: ga4_daily_metrics tenant mismatch is rejected (wrong client_id).
  _caught := false;
  begin
    insert into ga4_daily_metrics (agency_id, client_id, tracking_configuration_id, integration_resource_id, metric_date, active_users)
      values (_agency_a, _client_a2, _tracking_a1, _resource_x, current_date, 10); -- _tracking_a1/_resource_x belong to Client A1, not A2
  exception when others then
    _caught := true;
    raise notice 'PASS: ga4_daily_metrics tenant mismatch correctly rejected -- %', sqlerrm;
  end;
  if not _caught then
    raise exception 'FAIL: a ga4_daily_metrics row with mismatched client_id was NOT rejected';
  end if;

  -- Test: wrong resource_type for the metric table is rejected -- resource_b
  -- is resource_type = 'ga4_property' (it was discovered/linked as a GA4
  -- property above), so inserting it into search_console_daily_metrics
  -- (which requires resource_type = 'search_console_site') must fail.
  _caught := false;
  begin
    insert into search_console_daily_metrics (agency_id, client_id, seo_profile_id, integration_resource_id, metric_date, clicks)
      values (_agency_b, _client_b1, _seo_b1, _resource_b, current_date, 5);
  exception when others then
    _caught := true;
    raise notice 'PASS: wrong resource_type for metric table correctly rejected -- %', sqlerrm;
  end;
  if not _caught then
    raise exception 'FAIL: a search_console_daily_metrics row referencing a ga4_property resource was NOT rejected';
  end if;

  -- Test (Case C-equivalent, the specific bug found during the Slice G1
  -- deferred-trigger review): unlinking resource_x from ONLY the
  -- resource side, without also clearing tracking_configurations(
  -- _tracking_a1).integration_resource_id in the same transaction, must
  -- be rejected -- this is exactly the one-sided-unlink gap the
  -- unconditional reverse-lookup redesign exists to catch.
  _caught := false;
  begin
    update integration_resources set linked_tracking_configuration_id = null, client_id = null, link_status = 'unlinked' where id = _resource_x;
    -- Deliberately NOT updating tracking_configurations here.
    set constraints all immediate;
  exception when others then
    _caught := true;
    raise notice 'PASS: one-sided unlink (resource side only) correctly rejected -- %', sqlerrm;
  end;
  set constraints all deferred;
  if not _caught then
    raise exception 'FAIL: a one-sided unlink was NOT rejected -- the bidirectional consistency fix is not working';
  end if;

  -- Test (Case E): a properly TWO-sided unlink, both sides cleared
  -- together in one transaction, must succeed.
  update integration_resources set linked_tracking_configuration_id = null, client_id = null, link_status = 'unlinked' where id = _resource_x;
  update tracking_configurations set integration_resource_id = null where id = _tracking_a1;
  set constraints all immediate;
  raise notice 'PASS: two-sided unlink (Case E) succeeded correctly';
  set constraints all deferred;

  -- Test (Case F): deleting a canonical record that is STILL linked
  -- (resource_b/_tracking_b1, linked earlier and untouched since) must
  -- be rejected -- the FK's ON DELETE SET NULL action is itself a real
  -- UPDATE on integration_resources, re-validated against integration_
  -- resources_link_status_consistency (client_id/link target required
  -- whenever link_status = 'linked'), so the delete fails outright
  -- rather than ever landing a "linked but no target" row.
  _caught := false;
  begin
    delete from tracking_configurations where id = _tracking_b1;
  exception when others then
    _caught := true;
    raise notice 'PASS: deleting a still-linked tracking configuration correctly rejected (Case F) -- %', sqlerrm;
  end;
  if not _caught then
    raise exception 'FAIL: a still-linked tracking configuration was deleted without being unlinked first -- Case F protection is not working';
  end if;

  raise notice 'ALL G1 INTEGRITY FIXTURE TESTS COMPLETED';
end $$;

rollback;
-- Confirms nothing above was persisted:
-- select count(*) from agencies where slug like 'g1-verify-%'; -> expected: 0
