/* ELIORA OS — WAVE 2 ROLLBACK. DANGER: drops all Wave 2 data. Snapshot first.
   template_type enum values (contract/message/custom) are left in place. */

drop table if exists request_comments cascade;
drop table if exists client_requests cascade;
drop table if exists message_attachments cascade;
drop table if exists messages cascade;
drop table if exists message_threads cascade;
drop table if exists agency_portal_settings cascade;
drop table if exists contract_signatures cascade;
drop table if exists contracts cascade;
drop table if exists contract_templates cascade;
drop table if exists proposal_events cascade;
drop table if exists proposal_versions cascade;
drop table if exists proposal_line_items cascade;
drop table if exists proposal_sections cascade;
drop table if exists proposals cascade;
drop table if exists meetings cascade;
drop table if exists lead_activities cascade;
drop table if exists lead_notes cascade;
drop table if exists leads cascade;
drop table if exists pipeline_stages cascade;
drop table if exists team_invitations cascade;
drop table if exists team_memberships cascade;
drop table if exists permission_sets cascade;
drop table if exists notification_preferences cascade;

drop function if exists public.seed_pipeline_stages(uuid);
drop function if exists public.seed_permission_presets(uuid);
drop function if exists public.ensure_agency_portal_settings(uuid);
drop function if exists public.ensure_message_thread(uuid);
drop function if exists public.bump_thread_last_message();

drop type if exists billing_kind cascade;
drop type if exists meeting_type cascade;
drop type if exists request_status cascade;
drop type if exists request_type cascade;
drop type if exists contract_status cascade;
drop type if exists proposal_status cascade;
drop type if exists lead_status cascade;
drop type if exists team_invite_status cascade;
drop type if exists team_member_status cascade;
