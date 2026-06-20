# Wave 2 — Operations Hub + Sales Engine

**Purpose:** Team & permissions, sales pipeline/leads, proposals, contracts,
agency portal settings, agency↔client messaging, and client requests.

## Run order
`phase-01 → 02 → 03 → 04 → 05 → wave-01 → wave-02`. Paste
`sql/wave-02/phase.sql` into Supabase, then `verification.sql`. Idempotent.

## Dependencies
Phases 01–05 + Wave 1 (agencies, profiles, clients, services, packages,
templates, and the SECURITY DEFINER helpers `current_agency_id`,
`current_client_id`, `caller_agency_id`, `is_agency_admin`,
`is_assigned_to_client`, `set_updated_at`).

## Installs
- **Enums:** team_member_status, team_invite_status, lead_status,
  proposal_status, contract_status, request_type, request_status,
  meeting_type, billing_kind. Extends `template_type` with contract/message/custom.
- **Team/permissions:** `permission_sets` (editable presets), `team_memberships`
  (membership layer over `profiles`), `team_invitations` (Pending/Accepted/
  Expired/Revoked; email-send deferred, architecture supports it).
- **Pipeline:** `pipeline_stages` (default: Lead → Discovery Call → Proposal +
  Contract → Paid → Client, with probability %), `leads`, `lead_notes`,
  `lead_activities`, `meetings`. `leads.converted_client_id` is forward-compat
  only — no conversion logic (per blueprint, conversion is automatic/Wave-later).
- **Proposals:** `proposals` (+share_token, viewed/declined tracking, version),
  `proposal_sections`, `proposal_line_items` (from Services/Packages),
  `proposal_versions`, `proposal_events`.
- **Contracts:** `contract_templates`, `contracts`, `contract_signatures`
  (simple in-app typed signature, stored).
- **Agency portal settings:** `agency_portal_settings` (enable/disable toggles).
- **Messaging:** `message_threads`, `messages`, `message_attachments`.
- **Client requests:** `client_requests`, `request_comments`.
- **Notification prefs:** `notification_preferences`.
- Seed functions: `seed_pipeline_stages`, `seed_permission_presets`,
  `ensure_agency_portal_settings`, `ensure_message_thread`.

## RLS
- Internal agency tables: agency members read, admins write (sales records also
  writable by the record owner/creator).
- Messaging + requests: agency admin OR the client's own user.
- Invitations + notification prefs: restricted (admins / self).
- Client users never reach team/pipeline/proposals/contracts (no agency_id via
  `current_agency_id()`).

## Rollback
`rollback.sql` drops Wave 2 tables/functions/enums. The `template_type` enum
values added (contract/message/custom) are left in place (enum values can't be
dropped safely).
