# Wave 1 — Client Delivery System

**Covers:** Phase 06 Content, Phase 07 Files & Deliverables, Phase 08 Reports,
Phase 09 Client Approvals. (Phase 05 Client Onboarding ships separately in
`sql/phase-05-client-onboarding/phase.sql`.)

---

## Run order (each once, idempotent)

```
phase-01 → phase-02 → phase-03 → phase-04 → phase-05 → wave-01
```

### Paste into Supabase SQL Editor:
```
sql/wave-01-client-delivery-system/phase.sql
```
Then verify with `verification.sql`. Undo with `rollback.sql`.

---

## Storage setup

`phase.sql` creates a **private** Storage bucket `eliora-files` and its RLS
policies automatically — no manual dashboard steps required. Objects are stored
under `<agency_id>/clients/<client_id>/<area>/<uuid>-<filename>`; storage RLS
isolates objects by agency, and the table RLS + client views below enforce
per-client visibility.

If your project has Storage disabled, enable it (Supabase → Storage) before
pasting, or the `storage.buckets` insert is a no-op and uploads will fail.

Supported file types are whatever the bucket accepts (no MIME restriction set) —
PDF, CSV, XLSX, DOCX, and images all work.

---

## What phase.sql Installs

1. **Enums** — content_type, content_platform, content_status,
   content_approval_action, file_owner_role, file_request_status, report_status
2. **Tables**
   - Content: `content_items`, `content_comments`, `content_approvals`,
     `content_approval_history`, `content_revisions`, `content_assets`
   - Files: `asset_folders`, `client_assets`, `file_versions`, `file_requests`,
     `file_request_items`, `deliverables`
   - Reports: `reports`, `report_files`, `report_sections`, `report_shares`
   - `notifications`
   - (Reuses `activity_logs` from Phase 02 — not duplicated.)
3. **Indexes + `updated_at` triggers**
4. **Storage** bucket + RLS
5. **`ensure_client_folders(client)`** — seeds the 6 default folders (Brand
   Assets, Photos, Videos, Logos, Documents, Other)
6. **RLS** — two patterns: agency-manages/client-reads, and
   agency-manages/client-also-writes (comments, approvals, uploads, request
   fulfillment); notifications scoped to the recipient
7. **Client-safe views** — `content_items_client`, `client_assets_client`,
   `reports_client` hide internal columns and non-visible rows from clients at
   the DB layer (clients query these, never the base tables)
8. **Grants**

---

## Permissions summary

| Role | Content / Files / Reports |
|------|---------------------------|
| agency_owner / admin | full within their agency |
| team_member | assigned clients only |
| client_user | own client only; reads via client-safe views; can comment, approve/request-changes/reject, and upload requested assets |

Clients never see internal notes, draft/internal-review content, archived or
agency-only files, or other clients' data.

---

## Deferred to Wave 2
- Drag-and-drop folder nesting, file move-history UI (tables exist:
  `file_versions`, `deliverables`, `report_sections`)
- Notification delivery (rows are created; in-app/email delivery is later)
- Social publishing, analytics dashboards, billing
