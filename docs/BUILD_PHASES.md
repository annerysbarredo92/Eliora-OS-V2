# Eliora OS — Build Phase Strategy

## Phase 01 — Foundation ✅

**Goal:** Solid base to build every future phase on top of.

Deliverables:
- [x] Vite + React + TypeScript + Tailwind project
- [x] Design token system (CSS custom properties)
- [x] Brand components: InfinityMark, AppLoader
- [x] UI components: Button, Input, Card, Badge
- [x] Route architecture: Public / Agency / Client
- [x] Route guards: RequireAuth, RequireAgency, RequireClient
- [x] Auth layout with brand panel
- [x] Public layout: nav + footer
- [x] Agency layout: sidebar + header
- [x] Client layout: header + tab nav
- [x] All portal pages created as shells
- [x] Landing page (full)
- [x] Pricing page (full)
- [x] Login, Signup, Forgot Password pages (full, Supabase-wired)
- [x] Agency Dashboard (enhanced shell with onboarding banner)
- [x] Operations Hub (tab shell with onboarding steps)
- [x] Supabase client setup
- [x] SQL phase folder structure (17 phases)
- [x] Phase 01 SQL: schema + policies + verification
- [x] Documentation

## Phase 02 — Agency Core

**Goal:** A working agency workspace with real data.

Planned:
- [ ] Agency dashboard with live metrics
- [ ] Client list, search, filter, create
- [ ] Client profile drawer/page
- [ ] Activity log
- [ ] Phase 02 SQL: clients, activity_logs tables + RLS

## Phase 03 — Operations Hub

**Goal:** Full Operations Hub with real CRUD.

Planned:
- [ ] Agency onboarding wizard (full)
- [ ] Services CRUD
- [ ] Packages CRUD
- [ ] Templates management
- [ ] Team management
- [ ] Phase 03 SQL

## Phase 04 — Client Portal Foundation

**Goal:** Clients can log in and see their portal.

Planned:
- [ ] Client portal invite system
- [ ] Client portal authentication
- [ ] Client dashboard (live data)
- [ ] Phase 04 SQL: client_portal_users, invitations

...and so on through Phase 17.
