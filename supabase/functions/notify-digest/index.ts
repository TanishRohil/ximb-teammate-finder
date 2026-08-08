// Supabase Edge Function: notify-digest
//
// NOT triggered by a database webhook — triggered on a schedule by a
// Supabase Cron Job (Database > Cron Jobs), once a day. Replaces the
// old notify-interest function, which emailed the owner on every
// single new interest; this batches them instead, so an owner with
// five new applicants in one day gets one email, not five.
//
// Logic: every pending interest with digest_sent = false is "new
// since the last run." Groups those by request owner, then by
// competition within that owner, sends one summary email per owner,
// then marks everything it just included as digest_sent = true so
// the next run doesn't re-include it.
//
// Deploy via Supabase Dashboard > Edge Functions > Deploy a new
// function > Via Editor, name it "notify-digest", paste this file,
// turn OFF "Verify JWT with legacy secret" in its Settings tab.
//
// Secrets: same three as the other notify-* functions (GMAIL_USER,
// GMAIL_APP_PASSWORD, WEBHOOK_SECRET) — no new secrets needed.
//
// Requires: the `digest_sent` column on `interests` — see
// supabase/migrations/005_interest_digest.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import nodemailer from 'npm:nodemailer@6.9.9'

const GMAIL_USER = Deno.env.get('GMAIL_USER')!
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
})

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({ from: `"Case File" <${GMAIL_USER}>`, to, subject, html })
  } catch (err) {
    console.error('Email send failed', to, err)
  }
}

Deno.serve(async (req) => {
  // Cron-triggered rather than webhook-triggered, but still gated
  // behind the same shared secret so nobody else can trigger a
  // mass-email run by hitting this URL directly. Set this as a custom
  // header on the Cron Job's HTTP request config.
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: undigested } = await supabase
    .from('interests')
    .select(
      'id, request:requests(competition_name, owner:profiles!requests_user_id_fkey(full_name, email))'
    )
    .eq('status', 'pending')
    .eq('digest_sent', false)

  if (!undigested || undigested.length === 0) {
    return new Response('Nothing new to digest', { status: 200 })
  }

  // owner email -> { name, perCompetition: Map(competition_name -> count) }
  const byOwner = new Map<string, { name: string; perCompetition: Map<string, number> }>()

  for (const row of undigested) {
    const owner = row.request?.owner
    const competition = row.request?.competition_name
    if (!owner?.email || !competition) continue

    if (!byOwner.has(owner.email)) {
      byOwner.set(owner.email, { name: owner.full_name || 'there', perCompetition: new Map() })
    }
    const entry = byOwner.get(owner.email)!
    entry.perCompetition.set(competition, (entry.perCompetition.get(competition) || 0) + 1)
  }

  for (const [email, { name, perCompetition }] of byOwner) {
    const rows = [...perCompetition.entries()]
      .map(
        ([competition, count]) =>
          `<li style="margin-bottom:6px;">${count} new ${count === 1 ? 'person' : 'people'} interested in <strong>${competition}</strong></li>`
      )
      .join('')

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p style="font-size: 12px; letter-spacing: 0.1em; color: #B23A2F; text-transform: uppercase;">Case File — Interest Digest</p>
        <h2 style="color: #14213D; margin: 4px 0 16px;">Hi ${name}, here's what's new</h2>
        <ul style="color: #2B2B28; padding-left: 20px;">${rows}</ul>
        <p style="color: #2B2B28; font-size: 14px; margin-top: 16px;">Head to Case File to review and accept.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent automatically by Case File — XIMB Teammate Finder.</p>
      </div>
    `
    await sendEmail(email, 'New interest in your open cases', html)
  }

  const ids = undigested.map((row) => row.id)
  await supabase.from('interests').update({ digest_sent: true }).in('id', ids)

  return new Response(
    `OK — sent ${byOwner.size} digest email(s) covering ${undigested.length} interest(s)`,
    { status: 200 }
  )
})
