/*
==============================================================
ELIORA OS V2 — QA TEST DATA
==============================================================
Creates 2 test clients + 3 test user accounts for QA.
Idempotent — safe to run multiple times.

REQUIRES: Phases 01-05 + Wave-01 applied.
          Wave-02 tables should also exist (team_memberships).

LOGIN CREDENTIALS (share these with the QA tester):
  Client 1 : client1@qatest.com  / QAtest123!
  Client 2 : client2@qatest.com  / QAtest123!
  Team Mbr : team@qatest.com     / QAtest123!
==============================================================
*/

do $$
declare
  -- ── IDs ────────────────────────────────────────────────────────────────────
  _agency_id        uuid;

  _client1_id       uuid;
  _client2_id       uuid;

  _client1_auth_id  uuid;
  _client2_auth_id  uuid;
  _team_auth_id     uuid;

  -- ── Test credentials ───────────────────────────────────────────────────────
  _client1_email    text := 'client1@qatest.com';
  _client2_email    text := 'client2@qatest.com';
  _team_email       text := 'team@qatest.com';
  _password         text := 'QAtest123!';

begin

  -- ──────────────────────────────────────────────────────────────────────────
  -- 0. Resolve the existing agency (first one created — your real agency).
  --    NEVER create a duplicate agency.
  -- ──────────────────────────────────────────────────────────────────────────
  select a.id
  into   _agency_id
  from   agencies a
  order  by a.created_at
  limit  1;

  if _agency_id is null then
    raise exception 'No agency found. Paste phase-01 SQL first.';
  end if;

  raise notice 'Using agency_id: %', _agency_id;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 1. TEST CLIENT 1 — Bloom & Co Studio
  -- ──────────────────────────────────────────────────────────────────────────
  select id into _client1_id
  from   clients
  where  agency_id = _agency_id and business_name = 'Bloom & Co Studio'
  limit  1;

  if _client1_id is null then
    insert into clients (agency_id, business_name, industry, status, health, portal_enabled)
    values (_agency_id, 'Bloom & Co Studio', 'Beauty & Wellness', 'active', 'healthy', true)
    returning id into _client1_id;
    raise notice 'Created Client 1: %', _client1_id;
  else
    -- ensure portal_enabled = true for QA
    update clients set portal_enabled = true where id = _client1_id;
    raise notice 'Client 1 already exists: %', _client1_id;
  end if;

  -- Primary contact for Client 1
  insert into client_contacts (agency_id, client_id, first_name, last_name, email, is_primary)
  values (_agency_id, _client1_id, 'Sofia', 'Bloom', _client1_email, true)
  on conflict do nothing;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. TEST CLIENT 2 — Nova Skin Lab
  -- ──────────────────────────────────────────────────────────────────────────
  select id into _client2_id
  from   clients
  where  agency_id = _agency_id and business_name = 'Nova Skin Lab'
  limit  1;

  if _client2_id is null then
    insert into clients (agency_id, business_name, industry, status, health, portal_enabled)
    values (_agency_id, 'Nova Skin Lab', 'Skincare & Medical', 'active', 'healthy', true)
    returning id into _client2_id;
    raise notice 'Created Client 2: %', _client2_id;
  else
    update clients set portal_enabled = true where id = _client2_id;
    raise notice 'Client 2 already exists: %', _client2_id;
  end if;

  -- Primary contact for Client 2
  insert into client_contacts (agency_id, client_id, first_name, last_name, email, is_primary)
  values (_agency_id, _client2_id, 'Maya', 'Reed', _client2_email, true)
  on conflict do nothing;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 3. AUTH USER: Client 1
  --    handle_new_user trigger fires → creates profile (agency_id=null).
  --    We then UPDATE profile to wire agency_id + client_id.
  -- ──────────────────────────────────────────────────────────────────────────
  select id into _client1_auth_id from auth.users where email = _client1_email;

  if _client1_auth_id is null then
    _client1_auth_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      _client1_auth_id,
      'authenticated', 'authenticated',
      _client1_email,
      crypt(_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('role', 'client_user', 'display_name', 'Sofia Bloom'),
      false, now(), now()
    );
    raise notice 'Created auth user Client 1: %', _client1_auth_id;
  else
    raise notice 'Auth user Client 1 already exists: %', _client1_auth_id;
  end if;

  -- Wire profile (trigger may have left agency_id / client_id null)
  update profiles
  set    role      = 'client_user',
         agency_id = _agency_id,
         client_id = _client1_id
  where  id = _client1_auth_id;

  -- Register in client_users
  insert into client_users (agency_id, client_id, profile_id, email, status)
  values (_agency_id, _client1_id, _client1_auth_id, _client1_email, 'active')
  on conflict (client_id, email)
    do update set profile_id = excluded.profile_id, status = 'active';

  -- ──────────────────────────────────────────────────────────────────────────
  -- 4. AUTH USER: Client 2
  -- ──────────────────────────────────────────────────────────────────────────
  select id into _client2_auth_id from auth.users where email = _client2_email;

  if _client2_auth_id is null then
    _client2_auth_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      _client2_auth_id,
      'authenticated', 'authenticated',
      _client2_email,
      crypt(_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('role', 'client_user', 'display_name', 'Maya Reed'),
      false, now(), now()
    );
    raise notice 'Created auth user Client 2: %', _client2_auth_id;
  else
    raise notice 'Auth user Client 2 already exists: %', _client2_auth_id;
  end if;

  update profiles
  set    role      = 'client_user',
         agency_id = _agency_id,
         client_id = _client2_id
  where  id = _client2_auth_id;

  insert into client_users (agency_id, client_id, profile_id, email, status)
  values (_agency_id, _client2_id, _client2_auth_id, _client2_email, 'active')
  on conflict (client_id, email)
    do update set profile_id = excluded.profile_id, status = 'active';

  -- ──────────────────────────────────────────────────────────────────────────
  -- 5. AUTH USER: Team Member
  -- ──────────────────────────────────────────────────────────────────────────
  select id into _team_auth_id from auth.users where email = _team_email;

  if _team_auth_id is null then
    _team_auth_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      _team_auth_id,
      'authenticated', 'authenticated',
      _team_email,
      crypt(_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('role', 'team_member', 'display_name', 'Alex Rivera'),
      false, now(), now()
    );
    raise notice 'Created auth user Team Member: %', _team_auth_id;
  else
    raise notice 'Auth user Team Member already exists: %', _team_auth_id;
  end if;

  update profiles
  set    role      = 'team_member',
         agency_id = _agency_id,
         client_id = null        -- team members never have client_id
  where  id = _team_auth_id;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 6. TEAM MEMBERSHIP (wave-02 table — skip if not yet applied)
  -- ──────────────────────────────────────────────────────────────────────────
  if exists (
    select 1 from information_schema.tables
    where  table_schema = 'public' and table_name = 'team_memberships'
  ) then
    insert into team_memberships (agency_id, profile_id, title, status)
    values (_agency_id, _team_auth_id, 'Content Manager', 'active')
    on conflict (agency_id, profile_id)
      do update set status = 'active', title = 'Content Manager';
    raise notice 'Team membership created/updated for: %', _team_auth_id;
  else
    raise notice 'SKIP team_memberships — wave-02 not yet applied.';
  end if;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 7. CLIENT PORTAL BOOTSTRAP (phase-04 rows)
  --    ensure_client_portal() seeds client_profiles + client_portal_settings.
  --    Callable by postgres superuser directly.
  -- ──────────────────────────────────────────────────────────────────────────
  if exists (
    select 1 from information_schema.routines
    where  routine_schema = 'public' and routine_name = 'ensure_client_portal'
  ) then
    perform ensure_client_portal(_client1_id);
    perform ensure_client_portal(_client2_id);
    raise notice 'Client portal rows bootstrapped for both clients.';
  else
    raise notice 'SKIP ensure_client_portal — phase-04 not yet applied.';
  end if;

  raise notice '';
  raise notice '✓ QA test data complete.';
  raise notice '  Client 1 (%): client1@qatest.com / QAtest123!', _client1_id;
  raise notice '  Client 2 (%): client2@qatest.com / QAtest123!', _client2_id;
  raise notice '  Team Mbr (%): team@qatest.com    / QAtest123!', _team_auth_id;

end $$;
