// Supabase Edge Function: notify-unfilled
//
// Fired by a Database Webhook whenever a row in `requests` is updated.
// If the update is the moment a request transitions from 'open' to
// 'closed' — whether because the team just filled up (see
// respondToInterest in RequestDetail.jsx) or the owner closed it
// manually — this emails everyone whose interest was still 'pending'
// to let them know, and marks those interests 'declined' so the data
// stays consistent with what actually happened.
//
// Deploy via Supabase Dashboard > Edge Functions > Deploy a new
// function > Via Editor, name it "notify-unfilled", paste this file,
// turn OFF "Verify JWT with legacy secret" in its Settings tab.
//
// Secrets (Edge Functions > Secrets — same ones used by the other
// notify-* functions): GMAIL_USER, GMAIL_APP_PASSWORD, WEBHOOK_SECRET
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

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
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await req.json()
  const record = payload.record
  const oldRecord = payload.old_record

  // Only fire on a fresh open -> closed transition, not on every update
  // to a request (e.g. editing the description shouldn't trigger this).
  if (record?.status !== 'closed' || oldRecord?.status !== 'open') {
    return new Response('Ignored — not a fresh close', { status: 200 })
  }

  const { data: pending } = await supabase
    .from('interests')
    .select('id, applicant:profiles!interests_applicant_id_fkey(full_name, email)')
    .eq('request_id', record.id)
    .eq('status', 'pending')

  if (!pending || pending.length === 0) {
    return new Response('No pending applicants to notify', { status: 200 })
  }

  const subject = `Position filled — ${record.competition_name}`

  const emailBody = (name: string) => `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="font-size: 12px; letter-spacing: 0.1em; color: #B23A2F; text-transform: uppercase;">Case File</p>
      <h2 style="color: #14213D; margin: 4px 0 16px;">${record.competition_name}</h2>
      <p style="color: #2B2B28;">Hi ${name}, the team for this one has been filled. Thanks for raising your hand — try another open case, there's likely a better fit waiting.</p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent automatically by Case File — XIMB Teammate Finder.</p>
    </div>
  `

  await Promise.all(
    pending
      .filter((p) => p.applicant?.email)
      .map((p) => sendEmail(p.applicant.email, subject, emailBody(p.applicant.full_name || 'there')))
  )

  const ids = pending.map((p) => p.id)
  await supabase.from('interests').update({ status: 'declined' }).in('id', ids)

  return new Response(`OK — notified and declined ${ids.length} pending applicant(s)`, { status: 200 })
})
