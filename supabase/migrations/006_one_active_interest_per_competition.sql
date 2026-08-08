-- Prevents an applicant from having more than one pending or accepted
-- interest for the same competition at a time (matched by competition
-- name, normalized — lowercased, punctuation stripped, since different
-- requests for the same real-world competition may be typed slightly
-- differently, e.g. "L'Oreal Brandstorm" vs "L'Oréal Brandstorm").
--
-- Concretely: if you have a PENDING application for "X Competition"
-- via one request, you can't also apply to a different request for
-- "X Competition" until that one is declined. If you have an ACCEPTED
-- spot for "X Competition", you can never apply to another request
-- for it — you're already on a team.
--
-- This is enforced here, at the database level, rather than only in
-- the frontend, so it can't be bypassed by calling the API directly.
--
-- Run in Supabase SQL Editor.

create or replace function prevent_duplicate_competition_interest()
returns trigger
language plpgsql
security definer
as $$
declare
  v_competition_name text;
  v_conflict_count int;
begin
  select lower(trim(regexp_replace(competition_name, '[^a-zA-Z0-9]+', ' ', 'g')))
    into v_competition_name
    from requests
    where id = new.request_id;

  select count(*) into v_conflict_count
    from interests i
    join requests r on r.id = i.request_id
    where i.applicant_id = new.applicant_id
      and i.request_id != new.request_id
      and i.status in ('pending', 'accepted')
      and lower(trim(regexp_replace(r.competition_name, '[^a-zA-Z0-9]+', ' ', 'g'))) = v_competition_name;

  if v_conflict_count > 0 then
    raise exception 'You already have an active application for this competition — wait for it to be resolved, or you''re already accepted elsewhere for it.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_competition_interest on interests;

create trigger trg_prevent_duplicate_competition_interest
  before insert on interests
  for each row execute function prevent_duplicate_competition_interest();
