/* ELIORA OS — WAVE 3 ROLLBACK. DANGER: drops Wave 3 data. Snapshot first. */
drop view if exists invoices_client; drop view if exists calendar_client;
drop table if exists tasks cascade;
drop table if exists calendar_events cascade;
drop table if exists goals cascade;
drop table if exists kpis cascade;
drop table if exists content_metrics cascade;
drop table if exists refunds cascade;
drop table if exists payment_plan_installments cascade;
drop table if exists payment_plans cascade;
drop table if exists payments cascade;
drop table if exists invoice_items cascade;
drop table if exists invoices cascade;
drop function if exists public.recompute_invoice_paid();
drop type if exists goal_status cascade; drop type if exists calendar_event_type cascade;
drop type if exists task_priority cascade; drop type if exists task_status cascade;
drop type if exists plan_status cascade; drop type if exists payment_method cascade;
drop type if exists invoice_status cascade;
