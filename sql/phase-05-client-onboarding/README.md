# Phase 05 — Client Onboarding

**Purpose:** A real, template-driven client onboarding system — sections,
questions, responses, progress, and missing-item tracking, surfaced as a guided
wizard for clients and a read-only view for agencies.

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

Phases 01–04 installed (reuses `current_agency_id`, `current_client_id`,
`caller_agency_id`, `is_agency_admin`, `is_assigned_to_client`, `set_updated_at`).

---

## What phase.sql Installs

1. **Enums** — `client_onboarding_status`, `onboarding_question_type`
2. **Tables** — `onboarding_templates`, `onboarding_sections`,
   `onboarding_questions`, `onboarding_responses`, `onboarding_progress`,
   `onboarding_required_items`, `onboarding_activity`
3. **Indexes + `updated_at` triggers**
4. **Functions** (SECURITY DEFINER)
   - `seed_onboarding_template(agency)` — builds the default template: 8 sections
     (Business Information → Review & Submit) with their questions. Idempotent.
   - `ensure_client_onboarding(client)` — creates the client's progress row and 5
     required asset items (Logo, Brand Photos, Videos, Service Menu, Brand Guide).
     Auto-seeds the template if missing.
5. **RLS**
   - Template / sections / questions: readable by anyone in the agency
     (including that agency's client users); writable by agency admins.
   - Responses / progress / required items / activity: agency admin (or assigned
     team) reads; **agency admin OR the client's own user** writes their own.
6. **Grants**

### Bootstrapping
- The client onboarding wizard calls `ensure_client_onboarding` on load (via
  `supabase.rpc`); the Operations Hub calls `seed_onboarding_template`.
- Both are guarded to the caller's own agency/client.

### Progress logic (computed from real saved data)
- A **section is completed** when every required question in it has an answer and
  the client saves it; the completion flag is stored in `onboarding_progress.sections`.
- **Completion %** = completed sections ÷ total sections (Review excluded).
- **Missing items** = required questions still unanswered + required asset items
  not marked provided.
- **Status** progresses `not_started → in_progress → completed → submitted`.

---

## Deferred to later phases
- Real file uploads (Asset items are tracked as provided/missing only)
- Full drag-and-drop template **builder** (data model already supports it; the
  Operations view is read-only)
- Content approvals, reports, billing, messaging
