// Supabase Edge Function: notify-match
//
// Fired by a Database Webhook whenever a row in `interests` is updated.
// If the update just changed status -> 'accepted', it emails both the
// request owner and the applicant with the competition details and
// each other's profile (name, batch, bio, skills) + email, so they can
// take the conversation forward themselves.
//
// Sends via Gmail SMTP — the same account already used for magic-link
// sign-in emails, so there's only one email setup to maintain.
//
// Deploy:   supabase functions deploy notify-match --no-verify-jwt
// Secrets:  supabase secrets set GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD=xxxx WEBHOOK_SECRET=...
//           (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
//           automatically by the Supabase runtime.)

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
  secure: false, // STARTTLS on 587
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
})

function formatDeadline(deadline: string | null) {
  if (!deadline) return null
  return new Date(deadline).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: `"Case File" <${GMAIL_USER}>`,
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('Email send failed', to, err)
  }
}

Deno.serve(async (req) => {
  // Simple shared-secret check so random internet traffic can't trigger emails.
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await req.json()
  const record = payload.record
  const oldRecord = payload.old_record

  // Only fire the moment status flips TO accepted, not on every update.
  if (record?.status !== 'accepted' || oldRecord?.status === 'accepted') {
    return new Response('Ignored — not a new acceptance', { status: 200 })
  }

  const { data: request } = await supabase
    .from('requests')
    .select('competition_name, description, deadline, user_id')
    .eq('id', record.request_id)
    .maybeSingle()

  if (!request) return new Response('Request not found', { status: 404 })

  const profileFields = 'full_name, email, batch, bio, skills_have'

  const { data: owner } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('id', request.user_id)
    .maybeSingle()

  const { data: applicant } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('id', record.applicant_id)
    .maybeSingle()

  if (!owner || !applicant) return new Response('Profile missing', { status: 404 })

  const deadline = formatDeadline(request.deadline)
  const subject = `You're teamed up — ${request.competition_name}`

  const profileBlock = (p: typeof owner) => `
    <p style="color: #14213D; font-size: 16px; margin-bottom: 4px;"><strong>${p.full_name}</strong></p>
    <p style="color: #2B2B28; font-size: 14px; margin: 0 0 4px;">${p.email}</p>
    ${p.batch ? `<p style="color: #666; font-size: 13px; margin: 0 0 8px;">${p.batch}</p>` : ''}
    ${p.bio ? `<p style="color: #2B2B28; font-size: 14px; margin: 0 0 8px;">${p.bio}</p>` : ''}
    ${
      p.skills_have?.length
        ? `<p style="font-size: 13px; color: #6E7C5A;">${p.skills_have.join(' · ')}</p>`
        : ''
    }
  `

  const emailBody = (them: typeof owner) => `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="font-size: 12px; letter-spacing: 0.1em; color: #B23A2F; text-transform: uppercase;">Case File — Match Confirmed</p>
      <h2 style="color: #14213D; margin: 4px 0 16px;">${request.competition_name}</h2>
      ${request.description ? `<p style="color: #2B2B28;">${request.description}</p>` : ''}
      ${deadline ? `<p style="color: #2B2B28;"><strong>Team lock-in:</strong> ${deadline}</p>` : ''}
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="color: #2B2B28;">Your teammate for this one — reach out directly to take it forward:</p>
      ${profileBlock(them)}
      <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent automatically by Case File — XIMB Teammate Finder.</p>
    </div>
  `

  await Promise.all([
    sendEmail(owner.email, subject, emailBody(applicant)),
    sendEmail(applicant.email, subject, emailBody(owner)),
  ])

  return new Response('OK', { status: 200 })
})
