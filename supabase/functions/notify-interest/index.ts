// Supabase Edge Function: notify-interest
//
// Fired by a Database Webhook whenever a new row is INSERTed into
// `interests` — i.e. the moment someone raises their hand on a request.
// Emails the request owner with the applicant's profile and their note,
// so they know to come check the file without needing to reload the app.
//
// Deploy: create via Supabase Dashboard > Edge Functions > Deploy a new
// function > Via Editor, name it "notify-interest", paste this file,
// turn OFF "Verify JWT with legacy secret" in its Settings tab.
//
// Secrets (Edge Functions > Secrets — same ones used by notify-match):
//   GMAIL_USER, GMAIL_APP_PASSWORD, WEBHOOK_SECRET
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

  // Only care about brand-new interests, not updates (that's notify-match's job).
  if (payload.type !== 'INSERT') {
    return new Response('Ignored — not a new interest', { status: 200 })
  }

  const record = payload.record

  const { data: request } = await supabase
    .from('requests')
    .select('competition_name, user_id')
    .eq('id', record.request_id)
    .maybeSingle()

  if (!request) return new Response('Request not found', { status: 404 })

  const { data: owner } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', request.user_id)
    .maybeSingle()

  const { data: applicant } = await supabase
    .from('profiles')
    .select('full_name, email, batch, bio, skills_have')
    .eq('id', record.applicant_id)
    .maybeSingle()

  if (!owner || !applicant) return new Response('Profile missing', { status: 404 })

  const subject = `${applicant.full_name} raised their hand — ${request.competition_name}`

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="font-size: 12px; letter-spacing: 0.1em; color: #B23A2F; text-transform: uppercase;">Case File — New Interest</p>
      <h2 style="color: #14213D; margin: 4px 0 16px;">${request.competition_name}</h2>
      <p style="color: #2B2B28;">Someone wants in:</p>
      <p style="color: #14213D; font-size: 16px; margin-bottom: 4px;"><strong>${applicant.full_name}</strong></p>
      <p style="color: #2B2B28; font-size: 14px; margin: 0 0 4px;">${applicant.email}</p>
      ${applicant.batch ? `<p style="color: #666; font-size: 13px; margin: 0 0 8px;">${applicant.batch}</p>` : ''}
      ${applicant.bio ? `<p style="color: #2B2B28; font-size: 14px; margin: 0 0 8px;">${applicant.bio}</p>` : ''}
      ${
        applicant.skills_have?.length
          ? `<p style="font-size: 13px; color: #6E7C5A; margin: 0 0 8px;">${applicant.skills_have.join(' · ')}</p>`
          : ''
      }
      ${
        record.message
          ? `<p style="color: #2B2B28; font-size: 14px; font-style: italic; margin-top: 12px;">"${record.message}"</p>`
          : ''
      }
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="color: #2B2B28; font-size: 14px;">Head to Case File to accept or decline.</p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent automatically by Case File — XIMB Teammate Finder.</p>
    </div>
  `

  await sendEmail(owner.email, subject, html)

  return new Response('OK', { status: 200 })
})
