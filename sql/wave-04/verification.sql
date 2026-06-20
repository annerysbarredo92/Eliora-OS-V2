/* ELIORA OS — WAVE 4 VERIFICATION (read-only) */
select tablename from pg_tables where schemaname='public' and tablename in
('ai_generations','ai_prompt_templates','ai_saved_outputs','automations','automation_runs','automation_logs') order by tablename;
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('ai_generations','automations') order by tablename;
select (select count(*) from ai_generations) gens, (select count(*) from automations) autos;
