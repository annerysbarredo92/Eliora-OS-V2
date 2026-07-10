-- ============================================================
-- Rollback: Wave Email Messaging
-- Drops all tables, types, functions, and triggers created
-- by 01-email-tables.sql and 02-agency-email-settings.sql.
-- ============================================================

-- ── agency_email_settings ────────────────────────────────────
drop trigger   if exists trg_provision_agency_email_settings     on agencies;
drop trigger   if exists trg_agency_email_settings_updated_at    on agency_email_settings;
drop function  if exists provision_agency_email_settings()       cascade;
drop function  if exists touch_agency_email_settings_updated_at() cascade;
drop table     if exists agency_email_settings                   cascade;

-- ── email_messages / email_events ────────────────────────────
drop trigger   if exists trg_email_message_updated_at on email_messages;
drop function  if exists touch_email_message_updated_at() cascade;
drop table     if exists email_events    cascade;
drop table     if exists email_messages  cascade;
drop type      if exists email_message_status cascade;
