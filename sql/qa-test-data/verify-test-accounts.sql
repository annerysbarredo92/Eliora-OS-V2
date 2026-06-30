/*
==============================================================
ELIORA OS V2 — QA TEST DATA VERIFICATION
==============================================================
Run AFTER create-test-accounts.sql.
Checks every relationship that matters for route guards.
==============================================================
*/

-- ── 1. Auth users exist ────────────────────────────────────────────────────
select
  id,
  email,
  email_confirmed_at is not null as confirmed,
  raw_user_meta_data->>'role'   as meta_role,
  created_at::date              as created
from auth.users
where email in ('client1@qatest.com','client2@qatest.com','team@qatest.com')
order by email;

-- ── 2. Profiles: role, agency_id, client_id ───────────────────────────────
select
  p.id,
  p.email,
  p.role,
  p.agency_id is not null          as has_agency,
  p.client_id is not null          as has_client,
  a.name                           as agency_name
from profiles p
left join agencies a on a.id = p.agency_id
where p.email in ('client1@qatest.com','client2@qatest.com','team@qatest.com')
order by p.email;

-- ── 3. Clients created ────────────────────────────────────────────────────
select
  c.id,
  c.business_name,
  c.status,
  c.portal_enabled,
  c.agency_id
from clients c
where c.business_name in ('Bloom & Co Studio', 'Nova Skin Lab')
order by c.business_name;

-- ── 4. Client users linked ────────────────────────────────────────────────
select
  cu.email,
  cu.status,
  cl.business_name  as client,
  cu.client_id,
  cu.agency_id,
  cu.profile_id is not null as profile_linked
from client_users cu
join clients cl on cl.id = cu.client_id
where cu.email in ('client1@qatest.com','client2@qatest.com')
order by cu.email;

-- ── 5. Profile ↔ client cross-check (client_id must match) ───────────────
select
  p.email,
  p.role,
  p.client_id            as profile_client_id,
  cu.client_id           as client_users_client_id,
  p.client_id = cu.client_id as ids_match
from profiles p
join client_users cu on cu.email = p.email
where p.email in ('client1@qatest.com','client2@qatest.com');

-- ── 6. Team membership (wave-02) ─────────────────────────────────────────
select
  tm.id,
  p.email,
  p.role,
  tm.title,
  tm.status,
  tm.agency_id
from team_memberships tm
join profiles p on p.id = tm.profile_id
where p.email = 'team@qatest.com';

-- ── 7. Role routing sanity ────────────────────────────────────────────────
-- Expected:
--   client1@qatest.com → role=client_user  → /portal/*  ✓  /agency/* ✗
--   client2@qatest.com → role=client_user  → /portal/*  ✓  /agency/* ✗
--   team@qatest.com    → role=team_member  → /agency/*  ✓  /portal/* ✗
select
  email,
  role,
  case
    when role = 'client_user'  then '→ /portal/* only'
    when role in ('team_member','admin','agency_owner') then '→ /agency/* only'
    else '→ UNKNOWN ROLE — check this'
  end as expected_route,
  agency_id is not null as agency_wired,
  client_id is not null as client_wired
from profiles
where email in ('client1@qatest.com','client2@qatest.com','team@qatest.com')
order by role, email;
