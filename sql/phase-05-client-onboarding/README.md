# phase-05-client-onboarding

**Purpose:** Client onboarding wizard data and progress tracking

## Files

| File | Purpose |
|------|---------|
| schema.sql | Table definitions, types, constraints |
| policies.sql | Row-level security policies |
| triggers.sql | Database triggers and functions |
| verification.sql | Queries to confirm migrations ran correctly |
| rollback.sql | Undo instructions for this phase |

## Run Order

1. `schema.sql` → `policies.sql` → `triggers.sql` → `verification.sql`

## Status

- [ ] Schema designed
- [ ] Policies written  
- [ ] Tested on staging
- [ ] Run on production
