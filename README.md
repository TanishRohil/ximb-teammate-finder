# Case File — XIMB Teammate Finder

A skill-based teammate matchmaker for case competitions. Students post a
**request** ("I'm doing L'Oréal Brandstorm, I have marketing chops, I need
someone strong in finance"), and everyone browsing sees a **complementary
match score** based on skill overlap — not similarity, complementarity.

Stack: React + Vite + Tailwind (frontend), Supabase (Postgres DB + Auth,
free tier). No server to run — Supabase is your entire backend.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (free tier is enough).
2. In **SQL Editor**, paste the contents of `supabase/schema.sql` and run it.
   This creates the `profiles`, `requests`, and `interests` tables with
   row-level security already locked down.
3. In **Project Settings → API**, copy your **Project URL** and **anon public key**.

## 2. Restrict sign-ups to XIMB students

Two layers, both already in the code — you just need to set the real domain:

- **Client-side check**: open `src/lib/supabaseClient.js` and set
  `ALLOWED_EMAIL_DOMAIN` to XIMB's actual student email domain (placeholder
  is `@ximb.edu.in`).
- **Server-side backstop**: in Supabase, go to **Authentication → Hooks →
  "Before User Created"** and point it at the `restrict_to_ximb_domain`
  function from `schema.sql` (also update the domain inside that function
  to match). This stops anyone from bypassing the frontend check directly
  via the API.

Auth itself uses **magic link / OTP** — no passwords to manage. Make sure
**Email** auth is enabled under Authentication → Providers (it is by default).

## 3. Run it locally

```bash
npm install
cp .env.example .env
# edit .env with your Supabase URL + anon key
npm run dev
```

Visit the local URL Vite prints. First sign-in will ask you to fill out a
profile (your dossier) before you can browse or post.

## 4. Deploy for free

Any static host works since this is a pure frontend + Supabase:

- **Vercel** or **Netlify**: connect the repo, set the two `VITE_SUPABASE_*`
  env vars in the project settings, build command `npm run build`, output
  dir `dist`.
- Add your deployed URL to Supabase **Authentication → URL Configuration →
  Redirect URLs** so the magic link works in production.

## How matching works

`src/lib/matching.js` scores every open request against the signed-in
student's profile:

- **70%** — how much of the request's `skills_needed` the viewer's
  `skills_have` covers (do you actually fill their gap?)
- **30%** — how much of the request's `skills_offered` overlaps with what
  the viewer listed under `skills_want` (do they have something to teach you?)

This is a simple, transparent heuristic you can tune — it's plain
JavaScript, not a black box.

## Project structure

```
src/
  lib/            Supabase client, auth hook, matching algorithm
  components/     Navbar, RequestCard, MatchStamp, SkillTag, SkillInput
  pages/          Login, Onboarding, Browse, CreateRequest, RequestDetail, MyDashboard
supabase/
  schema.sql      Tables, RLS policies, domain-restriction function
  migrations/     Incremental SQL changes to run on an existing project
  functions/
    notify-match/    Emails both parties when an interest is accepted
    notify-interest/ Emails the request owner when someone raises their hand
```

## 5. Email both parties when a teammate is accepted

When a request owner accepts someone's interest, both people get an email with
the competition details and each other's name + email — nothing else is shared.

This runs as a **Supabase Edge Function**, triggered by a **Database Webhook**
the instant an `interests` row's status flips to `accepted`. No email keys
touch the browser.

### 5a. Install the Supabase CLI (one-time, on your own machine)

```bash
npm install -g supabase
supabase login
```

### 5b. Link the CLI to your project

From inside the `ximb-teammate-finder` folder:

```bash
supabase link --project-ref YOUR-PROJECT-REF
```

Your project ref is the subdomain in your Supabase URL, e.g. for
`https://abcdefgh.supabase.co` it's `abcdefgh`.

### 5c. Set the function's secrets

Reuse the same Gmail account + App Password you set up for magic-link
emails. Also invent a random string for `WEBHOOK_SECRET` (any long random
string — this just stops strangers from hitting your function directly
and triggering emails).

```bash
supabase secrets set GMAIL_USER=youraddress@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=your16digitapppassword
supabase secrets set WEBHOOK_SECRET=some-long-random-string-you-make-up
```

### 5d. Deploy the function

```bash
supabase functions deploy notify-match --no-verify-jwt
```

This prints a URL like:
```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/notify-match
```
Copy it.

### 5e. Wire up the Database Webhook

In the Supabase dashboard: **Database → Webhooks → Create a new webhook**

- **Name**: `notify-match`
- **Table**: `interests`
- **Events**: `Update` only
- **Type**: `HTTP Request`
- **URL**: the function URL from step 5d
- **HTTP Headers**: add one —
  - Key: `x-webhook-secret`
  - Value: the same `WEBHOOK_SECRET` string you set in 5c
- Save.

### That's it

Accept someone's interest in the app → the file automatically closes to
further interest, and both the request owner and the applicant get an
email within seconds containing the competition name, brief, lock-in
date, and each other's full profile (name, batch, bio, skills) + email
so they can take it from there themselves.

**Note:** this sends through the same Gmail account as your magic-link
emails — no separate provider to manage. If you'd rather use a dedicated
sending domain later, swap the `nodemailer` transport in
`supabase/functions/notify-match/index.ts` for your provider of choice
and redeploy.


- Confirm the real XIMB email domain in the two spots noted above.
- Supabase's free tier pauses projects after a week of inactivity — fine
  for a class project, worth knowing if you want it always-on.
- There's currently no admin view to remove spam/duplicate requests — add
  a `status = 'removed'` filter and an admin allow-list if you need that.
