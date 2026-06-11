# Phase 04 — Client Portal Foundation

**Purpose:** The client-facing workspace framework — client portal tables, the
client user model, onboarding, settings, and the RLS that fully isolates client
users from agency data.

---

## How to Run

### Step 1 — Paste into Supabase SQL Editor:
```
phase.sql
```

### Step 2 — Verify it worked:
```
verification.sql
```

### Only if you need to undo:
```
rollback.sql
```

`phase.sql` is **idempotent** — safe to paste and re-run.

---

## Prerequisites

Phases 01–03 installed.

---

## What phase.sql Installs

1. **Helper changes (security-critical)**
   - `current_agency_id()` now **excludes `client_user`** → returns NULL for
     client users, so every agency-table policy (Phases 01–03) fails closed for
     them automatically. This is what keeps clients out of agency data.
   - `current_client_id()` — the caller's own client account
   - `caller_agency_id()` — role-agnostic agency id (lets a client read its own
     agency's name/logo)
2. **Tables** — `client_users` (ensured), `client_profiles`,
   `client_portal_settings`, `client_portal_access`, `client_onboarding_progress`
3. **Indexes + `updated_at` triggers**
4. **`ensure_client_portal(client)`** — bootstraps the portal rows and records
   access; callable by the client's own user or an agency admin
5. **RLS** — agency admins (and assigned team) read; agency admins **or the
   client's own user** write (self-service onboarding/settings)
6. **Cross-phase updates** — `activity_logs` policies now allow a client to
   read/write activity for their own client; `agencies` gains a caller-read policy

---

## Client user model

A client user is a `profiles` row with `role = 'client_user'`, an `agency_id`,
and a `client_id`. They route to `/portal/*` and can **never** reach agency
routes (guards + RLS both enforce this).

### Provisioning a test client user
A full email invite flow lands in a later phase. To test the portal now, create
an auth user in Supabase → Authentication, then link it:

```sql
-- after creating auth user 'client@example.com' and finding its id + a client id:
update profiles
set role = 'client_user',
    agency_id = '<AGENCY_UUID>',
    client_id = '<CLIENT_UUID>'
where id = '<NEW_AUTH_USER_UUID>';
```

Log in as that user → you land in the client portal.

---

## Permissions

| Role | Agency data | Own client portal |
|------|-------------|-------------------|
| agency_owner / admin | full | full (manage) |
| team_member | assigned clients | read assigned |
| client_user | **none** | full (own only) |

---

## Deferred to later phases
- Email invite + client account provisioning UI
- Content approvals, reports, billing, messaging, files (placeholders only)
- Brand asset upload
