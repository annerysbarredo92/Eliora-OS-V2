# Phase 03 — Agency Onboarding & Operations

**Purpose:** The agency operational setup system — onboarding progress, a
readiness score, and real CRUD for services and packages, surfaced through the
Operations Hub.

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

Phases 01 + 02 installed. Phase 03 reuses `agencies`, `profiles`, `clients`,
`current_agency_id()`, `is_agency_admin()`, and `set_updated_at()`.

---

## What phase.sql Installs

1. **Enums** — `onboarding_step_status`, `billing_type`, `billing_frequency`, `template_type`
2. **Tables**
   - `agency_setup_steps` — the 8 onboarding steps per agency
   - `agency_onboarding_progress` — one summary row per agency (%, readiness, skipped)
   - `services` — agency service catalog
   - `packages` — service bundles (one default per agency)
   - `package_services` — package ⇄ service join
   - `templates` — shell for the future template editor
   - `agency_health_scores` — shell for early health metrics
3. **Indexes**, **`updated_at` triggers**
4. **Functions** (SECURITY DEFINER)
   - `recompute_agency_onboarding(agency)` — recomputes % + readiness from steps
   - `seed_agency_setup(agency)` — seeds the 8 steps + progress row (idempotent)
   - `reconcile_agency_setup(agency)` — auto-completes data-derived steps
     (services / packages / first client)
   - progress-recompute trigger on `agency_setup_steps`
5. **RLS** — all agency members read; only admin-tier roles write
6. **Grants**

### How progress works
- The app calls `seed_agency_setup` then `reconcile_agency_setup` on Operations
  Hub load (via `supabase.rpc`). Both are guarded to the caller's own agency.
- Marking a step complete (or creating the first service/package/client) updates
  `agency_setup_steps`; the trigger recomputes `agency_onboarding_progress`.
- **Readiness** = (completed + ½·in-progress) / total. **Completion %** = completed / total.

---

## Permissions

| Role | Read | Write |
|------|------|-------|
| master_admin / agency_owner / admin | yes | yes |
| team_member | yes (view-only) | no |
| client_user | none | none |

---

## Deferred to later phases
- Real branding upload, billing connection, client-portal config (steps are
  toggled manually for now)
- Full template editor (Templates is a styled shell)
- Real health scoring (Agency Health shows setup-derived metrics only)
- Automations / Integrations (locked tabs)
