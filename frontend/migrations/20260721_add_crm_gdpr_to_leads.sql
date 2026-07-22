-- Adds CRM linkage + GDPR consent tracking to the leads table.
-- Run this in the Supabase SQL editor (or via `supabase db push`) before deploying
-- the "verbindliche Zusage" status, CRM link and GDPR consent column.

alter table public.leads
  add column if not exists crm_id       text,
  add column if not exists gdpr_consent boolean not null default false;
