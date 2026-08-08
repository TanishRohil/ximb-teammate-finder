-- Adds tracking for the daily interest digest (notify-digest edge
-- function). A pending interest with digest_sent = false hasn't been
-- included in a summary email to the owner yet; the digest function
-- flips this to true once it has.
--
-- Run in Supabase SQL Editor.

alter table interests
  add column if not exists digest_sent boolean not null default false;
