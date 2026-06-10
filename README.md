# Eliora OS

The operating system for premium marketing agencies.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Run Phase 01 SQL
# Go to your Supabase project → SQL Editor
# Run: sql/phase-01-foundation/schema.sql
# Then: sql/phase-01-foundation/policies.sql
# Verify: sql/phase-01-foundation/verification.sql

# 4. Start dev server
npm run dev
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Build Phases

See [docs/BUILD_PHASES.md](docs/BUILD_PHASES.md)

## Portal URLs

| Portal | URL |
|--------|-----|
| Public Website | `/` |
| Login | `/login` |
| Sign Up | `/signup` |
| Agency Portal | `/agency` |
| Client Portal | `/portal` |

## Phase Status

- [x] **Phase 01** — Foundation (current)
- [ ] Phase 02 — Agency Core
- [ ] Phase 03 — Operations Hub
- [ ] Phase 04 — Client Portal Foundation
- [ ] Phases 05–17 — See BUILD_PHASES.md
