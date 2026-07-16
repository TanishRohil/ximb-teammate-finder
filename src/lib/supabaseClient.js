import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + anon key.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Only students with this email domain can sign in.
// TEMPORARY: set to gmail.com for testing. Switch back to the real
// XIMB student domain (e.g. '@stu.xim.edu.in') before rolling out.
export const ALLOWED_EMAIL_DOMAIN = '@stu.xim.edu.in'
