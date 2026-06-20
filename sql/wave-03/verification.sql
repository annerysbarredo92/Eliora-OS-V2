/* ELIORA OS — WAVE 3 VERIFICATION (read-only) */
-- tables (expected 11)
select tablename from pg_tables where schemaname='public' and tablename in
('invoices','invoice_items','payments','payment_plans','payment_plan_installments','refunds','content_metrics','kpis','goals','calendar_events','tasks') order by tablename;
-- RLS on
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('invoices','payments','tasks','calendar_events') order by tablename;
-- views
select table_name from information_schema.views where table_schema='public' and table_name in ('invoices_client','calendar_client') order by table_name;
-- payment recompute trigger
select trigger_name from information_schema.triggers where trigger_name='payments_recompute';
-- read self-test
select (select count(*) from invoices) inv, (select count(*) from tasks) tasks, (select count(*) from calendar_events) events;
