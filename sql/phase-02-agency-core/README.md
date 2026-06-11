# Phase 02 — Agency Core

**Purpose:** Real, database-backed client management — the agency workspace
(clients, contacts, activity logging, and the dashboard metrics that read them).

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

`phase.sql` is **idempotent** — safe to paste and re-run. Re-running repairs an
existing install without erroring.

---

## Prerequisites

Phase 01 must be installed. Phase 02 reuses:
- `agencies`, `profiles` tables
- `set_updated_at()`
- `current_agency_id()`, `current_user_role()` (SECURITY DEFINER helpers)

---

## What phase.sql Installs

1. **Enums** — `client_status`, `client_health`, `invitation_status`
2. **Tables**
   - `clients` — one row per client business (agency-scoped)
   - `client_contacts` — contacts per client (one flagged `is_primary`)
   - `client_users` — links portal auth users to a client (Phase 04 expands)
   - `client_invitations` — portal invite placeholder
   - `activity_logs` — append-only audit feed
   - `team_assignments` — which team members can access which clients
3. **Indexes** — agency_id / client_id / status / activity ordering
4. **Triggers** — `updated_at` on every table + `last_activity_at` auto-bump when
   an activity row is inserted for a client
5. **Access helpers** (SECURITY DEFINER, no RLS recursion)
   - `is_agency_admin()` — true for `master_admin` / `agency_owner` / `admin`
   - `is_assigned_to_client(uuid)` — true when caller is assigned to that client
6. **RLS** — enabled on all 6 tables
7. **RLS policies**
   - Everything hard-scoped to `current_agency_id()`
   - Admin-tier roles: full agency access
   - `team_member`: only assigned clients
   - Writes (Phase 02): admin-tier only
   - `client_user` has no `agency_id` → every policy fails closed (no Client Center access)
8. **Grants** — `authenticated` gets select/insert/update; activity_logs is insert-only

---

## Permissions Summary

| Role | Clients | Activity | Writes |
|------|---------|----------|--------|
| master_admin / agency_owner / admin | all agency clients | all agency activity | yes |
| team_member | assigned clients only | assigned + agency-level | no (Phase 02) |
| client_user | none | none | no |

---

## Deferred to later phases
- Client `health` scoring (Phase 03+)
- `package_name` / billing values (Phase 10)
- Portal invitations actually sending + `client_users` provisioning (Phase 04)
- Team-member write permissions and assignment management UI
