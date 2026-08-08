-- Lets an applicant withdraw their own PENDING interest, rather than
-- being stuck waiting indefinitely if the request owner never
-- responds. Without this, the "one active application per
-- competition" rule (006) has no escape hatch if an owner goes silent.
--
-- A 6-hour hold applies before withdrawal is allowed — gives the
-- owner a fair window to actually respond before the applicant can
-- bail, and stops someone from gaming the one-application-per-
-- competition rule by rapid-fire applying and withdrawing to probe
-- multiple teams in quick succession.
--
-- 'withdrawn' is a distinct status from 'declined' on purpose — "the
-- owner rejected me" and "I changed my mind" are different signals,
-- and match_events (built for future model training) would be
-- corrupted if these got conflated into the same label.
--
-- Run in Supabase SQL Editor.

-- Widen the status check to allow 'withdrawn'. The exact constraint
-- name may differ if you didn't use the original schema.sql verbatim
-- — if this DROP fails with "constraint does not exist", check
-- \d interests in the SQL Editor for the real name and swap it in.
alter table interests drop constraint if exists interests_status_check;
alter table interests add constraint interests_status_check
  check (status in ('pending', 'accepted', 'declined', 'withdrawn'));

-- Applicants can only touch their OWN interest, only while it's still
-- pending, only once 6 hours have passed since they applied, and only
-- to move it to 'withdrawn' — they can't accept themselves, can't
-- touch someone else's row, can't un-withdraw, and can't withdraw
-- early.
create policy "Applicants can withdraw their own pending interest after 6 hours"
  on interests for update
  using (
    auth.uid() = applicant_id
    and status = 'pending'
    and created_at <= now() - interval '4 hours'
  )
  with check (auth.uid() = applicant_id and status = 'withdrawn');
