/* ELIORA OS — WAVE 4 ROLLBACK. DANGER: drops Wave 4 data. Snapshot first. */
drop table if exists automation_logs cascade;
drop table if exists automation_runs cascade;
drop table if exists automations cascade;
drop table if exists ai_saved_outputs cascade;
drop table if exists ai_prompt_templates cascade;
drop table if exists ai_generations cascade;
drop type if exists automation_run_status cascade;
drop type if exists automation_trigger cascade;
drop type if exists ai_generation_kind cascade;
