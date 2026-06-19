/*
==============================================================
ELIORA OS — WAVE 1: CLIENT DELIVERY SYSTEM — ROLLBACK
==============================================================
DANGER: Undoes Wave 1 (Phases 06–09). Destroys all content,
files metadata, reports, and notifications. Phases 01–05 are
untouched. Storage objects in the bucket are NOT deleted by
this script — remove them in Supabase → Storage if desired.

Take a Supabase snapshot before running.
==============================================================
*/

-- ── Drop client-safe views ────────────────────────────────────────────────────
drop view if exists content_items_client;
drop view if exists client_assets_client;
drop view if exists reports_client;

-- ── Drop tables (children first) ──────────────────────────────────────────────
drop table if exists notifications            cascade;
drop table if exists report_shares            cascade;
drop table if exists report_sections          cascade;
drop table if exists report_files             cascade;
drop table if exists reports                   cascade;
drop table if exists deliverables             cascade;
drop table if exists file_request_items       cascade;
drop table if exists file_requests            cascade;
drop table if exists file_versions            cascade;
drop table if exists client_assets            cascade;
drop table if exists asset_folders            cascade;
drop table if exists content_assets           cascade;
drop table if exists content_revisions        cascade;
drop table if exists content_approval_history cascade;
drop table if exists content_approvals        cascade;
drop table if exists content_comments         cascade;
drop table if exists content_items            cascade;

-- ── Drop function ─────────────────────────────────────────────────────────────
drop function if exists public.ensure_client_folders(uuid);

-- ── Drop storage policies (bucket left in place) ──────────────────────────────
drop policy if exists "eliora_files_read"   on storage.objects;
drop policy if exists "eliora_files_insert" on storage.objects;
drop policy if exists "eliora_files_update" on storage.objects;
drop policy if exists "eliora_files_delete" on storage.objects;
-- To remove the bucket entirely (only if empty):
-- delete from storage.buckets where id = 'eliora-files';

-- ── Drop enums ────────────────────────────────────────────────────────────────
drop type if exists report_status            cascade;
drop type if exists file_request_status      cascade;
drop type if exists file_owner_role          cascade;
drop type if exists content_approval_action  cascade;
drop type if exists content_status           cascade;
drop type if exists content_platform         cascade;
drop type if exists content_type             cascade;
