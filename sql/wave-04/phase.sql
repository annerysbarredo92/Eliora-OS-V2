/*
==============================================================
ELIORA OS — WAVE 4: AI, AUTOMATION & LAUNCH HARDENING
==============================================================
Purpose:      AI generations + prompt templates + saved outputs (AI Studio),
              automation engine (triggers, runs, logs).
Dependencies: Phases 01-05 + Waves 1-3.
Execution:    Paste AFTER wave-03. Idempotent.
Security:     AI provider key lives in a Supabase Edge Function secret
              (supabase/functions/ai-generate) — NEVER in the DB or client.
Rollback:     see rollback.sql.
==============================================================
*/

-- ── 1. ENUMS ──────────────────────────────────────────────────────────────────
do $$ begin create type ai_generation_kind as enum ('content','batch','analysis','brief'); exception when duplicate_object then null; end $$;
do $$ begin create type automation_trigger as enum ('date','status','manual'); exception when duplicate_object then null; end $$;
do $$ begin create type automation_run_status as enum ('success','failed','retrying'); exception when duplicate_object then null; end $$;

-- ── 2. TABLES ─────────────────────────────────────────────────────────────────
create table if not exists ai_generations (
  id          uuid               primary key default uuid_generate_v4(),
  agency_id   uuid               not null references agencies(id) on delete cascade,
  client_id   uuid               references clients(id) on delete set null,
  actor_id    uuid               references profiles(id) on delete set null,
  kind        ai_generation_kind not null default 'content',
  model       text,
  brief       jsonb              not null default '{}',
  prompt      text,
  result      jsonb              not null default '{}',
  created_at  timestamptz        not null default now()
);
create table if not exists ai_prompt_templates (
  id          uuid               primary key default uuid_generate_v4(),
  agency_id   uuid               not null references agencies(id) on delete cascade,
  name        text               not null,
  kind        ai_generation_kind not null default 'content',
  template    text               not null,
  created_by  uuid               references profiles(id) on delete set null,
  created_at  timestamptz        not null default now(),
  updated_at  timestamptz        not null default now()
);
create table if not exists ai_saved_outputs (
  id            uuid        primary key default uuid_generate_v4(),
  agency_id     uuid        not null references agencies(id) on delete cascade,
  client_id     uuid        references clients(id) on delete set null,
  generation_id uuid        references ai_generations(id) on delete set null,
  title         text        not null,
  content       jsonb       not null default '{}',
  created_by    uuid        references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists automations (
  id             uuid               primary key default uuid_generate_v4(),
  agency_id      uuid               not null references agencies(id) on delete cascade,
  name           text               not null,
  description    text,
  trigger_type   automation_trigger not null default 'manual',
  trigger_config jsonb              not null default '{}',
  action_type    text               not null,
  action_config  jsonb              not null default '{}',
  is_active      boolean            not null default true,
  created_by     uuid               references profiles(id) on delete set null,
  updated_by     uuid               references profiles(id) on delete set null,
  created_at     timestamptz        not null default now(),
  updated_at     timestamptz        not null default now()
);
create table if not exists automation_runs (
  id            uuid                  primary key default uuid_generate_v4(),
  agency_id     uuid                  not null references agencies(id) on delete cascade,
  automation_id uuid                  not null references automations(id) on delete cascade,
  status        automation_run_status not null default 'success',
  attempt       smallint              not null default 1,
  result        jsonb                 not null default '{}',
  error         text,
  created_at    timestamptz           not null default now()
);
create table if not exists automation_logs (
  id            uuid        primary key default uuid_generate_v4(),
  agency_id     uuid        not null references agencies(id) on delete cascade,
  automation_id uuid        references automations(id) on delete set null,
  level         text        not null default 'info',
  message       text        not null,
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now()
);

-- ── 3. INDEXES ────────────────────────────────────────────────────────────────
create index if not exists ai_generations_agency_idx on ai_generations(agency_id, created_at desc);
create index if not exists ai_saved_agency_idx on ai_saved_outputs(agency_id, created_at desc);
create index if not exists automations_agency_idx on automations(agency_id, is_active);
create index if not exists automation_runs_idx on automation_runs(automation_id, created_at desc);
create index if not exists automation_logs_idx on automation_logs(agency_id, created_at desc);

-- ── 4. updated_at TRIGGERS ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ai_prompt_templates','automations'] loop
    execute format('drop trigger if exists %I on %I', t||'_set_updated_at', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t||'_set_updated_at', t);
  end loop;
end $$;

-- ── 5. ENABLE RLS ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ai_generations','ai_prompt_templates','ai_saved_outputs','automations','automation_runs','automation_logs'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ── 6. RLS POLICIES ───────────────────────────────────────────────────────────
-- All AI + automation tables are AGENCY-ONLY (clients never get AI access).
-- Members read; admins write. ai_generations also writable by the acting member
-- (so any permitted agency user can generate + log).
do $$
declare t text;
begin
  foreach t in array array['ai_prompt_templates','ai_saved_outputs','automations','automation_runs','automation_logs'] loop
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('create policy %I on %I for select using (agency_id = public.current_agency_id())', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format($f$create policy %I on %I for all
      using (agency_id = public.current_agency_id() and public.is_agency_admin())
      with check (agency_id = public.current_agency_id() and public.is_agency_admin())$f$, t||'_write', t);
  end loop;
end $$;

-- ai_generations: agency members read + insert their own (actor logging).
drop policy if exists "ai_generations_select" on ai_generations;
create policy "ai_generations_select" on ai_generations for select using (agency_id = public.current_agency_id());
drop policy if exists "ai_generations_insert" on ai_generations;
create policy "ai_generations_insert" on ai_generations for insert
  with check (agency_id = public.current_agency_id() and actor_id = auth.uid());

-- ── 7. GRANTS ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ai_generations','ai_prompt_templates','ai_saved_outputs','automations','automation_runs','automation_logs'] loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
