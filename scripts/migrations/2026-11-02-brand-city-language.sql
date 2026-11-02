-- Brand DNA: where the shop is, and the caption language (Settings › Business / Voice & audience).
-- Run once in Supabase → SQL Editor. Safe to run again (every change is "if not exists").
-- Until this runs, the app hides both fields; after it runs they appear in Settings.

alter table brand_profiles add column if not exists city text;
alter table brand_profiles add column if not exists language text
  check (language is null or language in ('Taglish', 'English', 'Filipino'));
