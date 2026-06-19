/*
==============================================================
ELIORA OS — WAVE 1: CLIENT DELIVERY SYSTEM — VERIFICATION
==============================================================
Run after phase.sql. All queries are read-only.
==============================================================
*/

-- ── Check 1: Tables exist (expected 17) ───────────────────────────────────────
select tablename from pg_tables
where schemaname = 'public' and tablename in (
  'content_items','content_comments','content_approvals','content_approval_history',
  'content_revisions','content_assets','asset_folders','client_assets','file_versions',
  'file_requests','file_request_items','deliverables','reports','report_files',
  'report_sections','report_shares','notifications'
) order by tablename;

-- ── Check 2: RLS enabled on all Wave 1 tables ─────────────────────────────────
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in (
  'content_items','content_comments','content_approvals','content_approval_history',
  'content_revisions','content_assets','asset_folders','client_assets','file_versions',
  'file_requests','file_request_items','deliverables','reports','report_files',
  'report_sections','report_shares','notifications'
) order by tablename;

-- ── Check 3: Storage bucket exists ────────────────────────────────────────────
-- Expected: eliora-files, public = false
select id, name, public from storage.buckets where id = 'eliora-files';

-- ── Check 4: Storage policies exist (expected 4) ──────────────────────────────
select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'eliora_files_%'
order by policyname;

-- ── Check 5: Client-safe views exist (expected 3) ─────────────────────────────
select table_name from information_schema.views
where table_schema = 'public'
  and table_name in ('content_items_client','client_assets_client','reports_client')
order by table_name;

-- ── Check 6: Seeding function exists ──────────────────────────────────────────
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'ensure_client_folders';

-- ── Check 7: Read self-test (no recursion / permission error) ─────────────────
select
  (select count(*) from content_items)  as content,
  (select count(*) from client_assets)  as files,
  (select count(*) from reports)        as reports,
  (select count(*) from asset_folders)  as folders;

-- ── Check 8: Enums exist (expected 7) ─────────────────────────────────────────
select typname from pg_type where typname in (
  'content_type','content_platform','content_status','content_approval_action',
  'file_owner_role','file_request_status','report_status'
) order by typname;
