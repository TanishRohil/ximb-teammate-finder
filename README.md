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

### Semantic matching (real ML, mostly precomputed)

`src/lib/embeddings.js` adds a fourth tier on top of the heuristic:
skills that are genuinely related but share no words at all — "Growth
Hacking" and "Digital Marketing," say — get partial credit from a small
sentence-embedding model (`Xenova/all-MiniLM-L6-v2`, ~25MB, quantized),
run via [transformers.js](https://huggingface.co/docs/transformers.js).

Since real usage is steered toward the preset skill list in
`skillPresets.js` (see below), the ~40 preset vectors are computed
**once, offline** and shipped as a small static file
(`public/skill-embeddings.json`, ~60-100KB) — loading that is instant,
no model download involved. The full model only loads as a fallback,
lazily, and only for whichever specific skill isn't in that file —
almost always because someone typed a custom skill.

**Run this once, and again any time you edit `skillPresets.js`:**
```bash
npm run precompute-embeddings
```
This needs real internet access to download the model — it computes
the vectors on your machine and writes the JSON file, which then gets
committed like any other file. `public/skill-embeddings.json` starts
as an empty `{}` in this repo; run the script before your first deploy
so the fast path actually has something to load. If it's never run,
nothing breaks — every comparison just falls back to the live model
instead, which is the original (slower, heavier) behavior.

### Preset skills

`src/lib/skillPresets.js` holds ~40 curated skills across six
categories, used by the skill picker in `SkillInput.jsx`. Steering
input toward a controlled vocabulary means most comparisons are exact
matches before any fuzzy or semantic logic even runs — typos and
phrasing drift mostly stop being a problem for anything on the list.
Custom entries are still allowed (there's a fallback in the picker UI)
so nobody's blocked from entering a real skill that isn't listed yet —
they just don't get the instant-embedding fast path for that one skill.

**Two things worth knowing if you keep iterating on this:**

- The similarity threshold for "these are related" (`SEMANTIC_THRESHOLD`
  in `matching.js`) is a starting estimate, not something empirically
  tuned against real skill data — the same way the string-matching
  thresholds needed adjusting after real test cases surfaced (an "Excel"
  vs "Excellent Communication" false positive, notably). Watch for
  matches that feel too generous or too stingy once real students are
  using it, and adjust the constant.
- First-time visitors to Browse or a request page download a real
  chunk of data (~25MB model + WASM runtime) in the background. It's
  lazy and doesn't block the page from rendering, but on a slow
  connection the semantic layer simply won't be "warm" yet for the
  first few seconds — the heuristic score shows immediately and the
  semantic upgrade applies once the model finishes loading, so nothing
  breaks, it just improves after a moment.

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
