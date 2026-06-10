# Phase 01 — Foundation

**Purpose:** Core auth, profiles, multi-tenancy, and base configuration.

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

---

## What phase.sql Installs

1. Extensions — `uuid-ossp`
2. Enums — `user_role`, `plan_type`
3. Shared functions — `set_updated_at()`
4. Table — `agencies` (one row per tenant)
5. Table — `profiles` (one row per auth user)
6. Table — `agency_settings` (key/value config per agency)
7. Indexes — on agency_id, role, email
8. RLS — enabled on all 3 tables
9. RLS Policies — read/write isolation per agency and user
10. Signup trigger — `on_auth_user_created` auto-creates profile + agency on new signup
11. Grants — authenticated role gets select/insert/update

---

## Prerequisites

- Fresh Supabase project (no existing conflicting tables)
- No prior phases run

## What Phases Come After

Phase 02 adds `clients` and `activity_logs`, which reference `agencies` and `profiles` from this phase.

## Status

- [ ] Run on staging
- [ ] Verified with verification.sql
- [ ] Run on production
