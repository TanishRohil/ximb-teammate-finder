-- Run this in Supabase SQL Editor if your project was already set up
-- before the gender field was added. Safe to run even if the column
-- already exists.

alter table profiles
  add column if not exists gender text;
