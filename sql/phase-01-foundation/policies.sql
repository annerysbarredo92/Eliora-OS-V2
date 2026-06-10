/*
--------------------------------------------------
FILE:    policies.sql
PHASE:   phase-01-foundation
PURPOSE: RLS policies for agencies and profiles
STATUS:  Ready — run after schema.sql
--------------------------------------------------
*/

-- ── agencies policies ────────────────────────────────────────────────────────

-- Agency members can read their own agency
create policy "Agency members can read own agency"
  on agencies for select
  using (
    id in (
      select agency_id from profiles where id = auth.uid()
    )
  );

-- Agency owners can update their agency
create policy "Agency owner can update agency"
  on agencies for update
  using (owner_id = auth.uid());

-- ── profiles policies ─────────────────────────────────────────────────────────

-- Users can read their own profile
create policy "User can read own profile"
  on profiles for select
  using (id = auth.uid());

-- Agency members can read profiles in their agency
create policy "Agency members can read team profiles"
  on profiles for select
  using (
    agency_id is not null
    and agency_id in (
      select agency_id from profiles where id = auth.uid()
    )
  );

-- Users can update their own profile
create policy "User can update own profile"
  on profiles for update
  using (id = auth.uid());

-- Service role bypass (for server-side operations)
create policy "Service role has full access to profiles"
  on profiles for all
  using (auth.jwt() ->> 'role' = 'service_role');

create policy "Service role has full access to agencies"
  on agencies for all
  using (auth.jwt() ->> 'role' = 'service_role');
