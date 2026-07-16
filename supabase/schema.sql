-- CASE FILE — XIMB Teammate Finder
-- Run this whole file once in Supabase: Project > SQL Editor > New query.

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  batch text,
  gender text,
  bio text,
  skills_have text[] not null default '{}',
  skills_want text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by any signed-in student"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- 2. REQUESTS  (a student raising a request to find teammates)
-- ────────────────────────────────────────────────────────────
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  competition_name text not null,
  description text,
  team_size_needed int not null default 1,
  skills_needed text[] not null default '{}',
  skills_offered text[] not null default '{}',
  deadline date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

alter table requests enable row level security;

create policy "Requests are viewable by any signed-in student"
  on requests for select
  using (auth.role() = 'authenticated');

create policy "Users can create their own requests"
  on requests for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own requests"
  on requests for update
  using (auth.uid() = user_id);

create policy "Users can delete their own requests"
  on requests for delete
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. INTERESTS  ("raising a hand" on someone else's request)
-- ────────────────────────────────────────────────────────────
create table if not exists interests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  applicant_id uuid not null references profiles (id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (request_id, applicant_id)
);

alter table interests enable row level security;

-- Applicant sees their own interest; request owner sees interest in their file.
create policy "Visible to the applicant or the request owner"
  on interests for select
  using (
    auth.uid() = applicant_id
    or auth.uid() in (select user_id from requests where requests.id = request_id)
  );

create policy "Students can express interest as themselves"
  on interests for insert
  with check (auth.uid() = applicant_id);

-- Only the request owner can accept/decline; the applicant cannot self-approve.
create policy "Only the request owner can update interest status"
  on interests for update
  using (auth.uid() in (select user_id from requests where requests.id = request_id));

-- ────────────────────────────────────────────────────────────
-- 4. RESTRICT SIGN-UPS TO THE XIMB EMAIL DOMAIN
-- ────────────────────────────────────────────────────────────
-- Supabase Auth supports a "Before User Created" hook that runs this
-- function and can reject sign-ups outright. Wire it up in:
-- Dashboard > Authentication > Hooks > "Before User Created" > select this function.
--
-- Change '@ximb.edu.in' below to XIMB's real student email domain.
create or replace function public.restrict_to_ximb_domain()
returns jsonb
language plpgsql
security definer
as $$
begin
  if (event->>'email') not ilike '%@ximb.edu.in' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Sign-up is restricted to XIMB email addresses.'
      )
    );
  end if;
  return jsonb_build_object();
end;
$$;

-- Note: the client (src/lib/supabaseClient.js) also checks the domain
-- before sending the magic link, so most non-XIMB emails never reach
-- this hook — this is the server-side backstop.
