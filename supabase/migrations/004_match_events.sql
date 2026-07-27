-- Logs every accept/decline decision along with the scores and skills
-- the algorithm saw at that exact moment. This isn't read anywhere in
-- the app yet — it exists purely so that once enough real decisions
-- pile up, there's real labeled data (features -> human decision) to
-- train something on, instead of hand-picked constants like the 70/30
-- weighting in matching.js.
--
-- Run in Supabase SQL Editor.

create table if not exists match_events (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null references interests (id) on delete cascade,
  request_id uuid not null references requests (id) on delete cascade,
  applicant_id uuid not null references profiles (id) on delete cascade,
  owner_id uuid not null references profiles (id) on delete cascade,

  outcome text not null check (outcome in ('accepted', 'declined')),

  -- The two scores as matching.js computed them at decision time —
  -- heuristic_score is tiers 1-3 only (exact/synonym/typo/stem word),
  -- semantic_score additionally includes the ML embedding tier. Having
  -- both, not just the final blended number, lets a future model see
  -- whether the semantic layer actually helped or hurt real decisions.
  heuristic_score int,
  semantic_score int,

  -- Snapshots, not live references — request and profile text can be
  -- edited later, and the whole point is preserving exactly what the
  -- algorithm saw when the human made their call.
  skills_needed text[],
  skills_offered text[],
  applicant_skills_have text[],
  applicant_skills_want text[],
  team_size_needed int,

  decided_at timestamptz not null default now()
);

alter table match_events enable row level security;

-- Only the request owner can write a row, and only as themselves —
-- mirrors who's actually allowed to call respondToInterest in the app.
create policy "Owners can log their own accept/decline decisions"
  on match_events for insert
  with check (auth.uid() = owner_id);

-- Deliberately no select policy yet. This data isn't surfaced in the
-- app anywhere — for now it's only readable via the Supabase
-- dashboard or a service-role key, which is the appropriate level of
-- access for something that exists purely for future analysis.
