# Eliora OS — Architecture Overview

## Project

Eliora OS is a premium SaaS operating system for marketing agencies.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Routing | React Router v6 |
| Auth + Database | Supabase (PostgreSQL + RLS) |
| Animation | Framer Motion + native Web Animations API |
| Icons | Lucide React |
| Deployment | Netlify / Vercel (TBD) |

## Portal Architecture

Three completely separate portal experiences:

```
/                    → Public website (landing, pricing)
/login               → Shared auth entry
/signup              → Agency registration
/agency/*            → Agency Portal (agency roles only)
/portal/*            → Client Portal (client_user only)
```

Route guards enforce separation:
- `RequireAuth` — must be signed in
- `RequireAgency` — must have an agency role
- `RequireClient` — must be client_user

## Roles

| Role | Portal | Access Level |
|------|--------|-------------|
| master_admin | Agency | Full platform access |
| agency_owner | Agency | Full agency access |
| admin | Agency | Full agency, no billing config |
| content_manager | Agency | Content, clients, tasks |
| strategist | Agency | Content, planning |
| editor | Agency | Content editing |
| client_success | Agency | Clients, communication |
| contractor | Agency | Assigned clients only |
| team_member | Agency | Assigned work only |
| client_user | Client | Client portal only |
| pending | None | Blocked |

## Database Multi-tenancy

Every agency-scoped table has an `agency_id` column.
Every client-scoped table has both `agency_id` and `client_id`.
RLS policies enforce tenant isolation at the database level.

## File Structure

```
src/
  app/
    guards/          Route protection components
    router.tsx       Application routes
    AuthProvider.tsx Auth context
  components/
    brand/           InfinityMark, AppLoader
    ui/              Button, Input, Card, Badge
    layout/          PublicNav, PublicFooter
    forms/           (Phase 02+)
  layouts/           PublicLayout, AuthLayout, AgencyLayout, ClientLayout
  pages/
    auth/            LoginPage, SignupPage, ForgotPage
    public/          LandingPage, PricingPage
  portals/
    agency/
      layouts/       AgencySidebar, AgencyHeader
      pages/         All agency portal pages
    client/
      layouts/       ClientHeader, ClientNav
      pages/         All client portal pages
  lib/               supabase.ts, auth.ts
  hooks/             useAuth.ts
  styles/            tokens.css, global.css
  types/             index.ts
  utils/             cn.ts, format.ts
sql/
  phase-01 through phase-17
docs/
  ARCHITECTURE.md    This file
  BUILD_PHASES.md    Phase strategy
```

## Build Phases

| Phase | Focus |
|-------|-------|
| 01 | Foundation — auth, routing, design system ← **current** |
| 02 | Agency Core — dashboard, client CRUD, activity |
| 03 | Operations Hub — services, packages, onboarding |
| 04 | Client Portal Foundation — invite system, portal auth |
| 05 | Client Onboarding — guided wizard |
| 06 | Content System — studio, workflows, approvals |
| 07 | Calendar & Tasks |
| 08 | Files & Deliverables |
| 09 | Reports & Analytics |
| 10 | Billing & Payments |
| 11 | Pipeline & Proposals |
| 12 | Team & Communication |
| 13 | Notifications & Intelligence |
| 14 | Automation Engine |
| 15 | AI Layer |
| 16 | Hardening & QA |
| 17 | Public Launch |
