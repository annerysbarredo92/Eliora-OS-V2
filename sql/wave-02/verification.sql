/* ELIORA OS — WAVE 2 VERIFICATION (read-only) */

-- Check 1: tables exist (expected 23)
select tablename from pg_tables where schemaname='public' and tablename in (
  'permission_sets','team_memberships','team_invitations','pipeline_stages','leads',
  'lead_notes','lead_activities','meetings','proposals','proposal_sections',
  'proposal_line_items','proposal_versions','proposal_events','contract_templates',
  'contracts','contract_signatures','agency_portal_settings','message_threads',
  'messages','message_attachments','client_requests','request_comments','notification_preferences'
) order by tablename;

-- Check 2: RLS enabled everywhere
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in (
  'permission_sets','team_memberships','leads','proposals','contracts','message_threads','client_requests'
) order by tablename;

-- Check 3: seed functions exist
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in
  ('seed_pipeline_stages','seed_permission_presets','ensure_agency_portal_settings','ensure_message_thread')
order by proname;

-- Check 4: template_type extended
select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
where t.typname='template_type' and enumlabel in ('contract','message','custom') order by enumlabel;

-- Check 5: read self-test (no recursion / permission error)
select (select count(*) from leads) as leads, (select count(*) from proposals) as proposals,
       (select count(*) from pipeline_stages) as stages, (select count(*) from permission_sets) as presets;

-- Check 6: after opening Operations Hub once — expect 5 stages + 5 presets per agency
select name, sort_order, probability from pipeline_stages order by sort_order;
select name, is_preset from permission_sets order by name;
