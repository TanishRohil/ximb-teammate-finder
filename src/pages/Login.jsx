import { useState } from 'react'
import { supabase, ALLOWED_EMAIL_DOMAIN } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
      setError(`Use your XIMB email address.`)
      return
    }

    setStatus('sending')
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (authError) {
      setError(authError.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-manila-light border border-charcoal/20 shadow-[4px_4px_0_rgba(43,43,40,0.15)] p-6">
        <p className="font-display text-[10px] tracking-[0.3em] text-stamp uppercase mb-1">
          Restricted access
        </p>
        <h1 className="font-display text-2xl font-bold text-ink mb-1">CASE FILE.</h1>
        <p className="text-sm text-charcoal/70 mb-6">
          Find a teammate whose skills complete yours. XIMB students only.
        </p>

        {status === 'sent' ? (
          <div className="text-sm bg-sage/10 border border-sage/40 text-sage p-3 rounded-sm">
            Check <strong>{email}</strong> for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
                XIMB email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`you${ALLOWED_EMAIL_DOMAIN}`}
                className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
              />
            </div>
            {error && <p className="text-xs text-stamp">{error}</p>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-2 bg-stamp text-manila-light font-display text-sm tracking-wide uppercase hover:bg-stamp-light disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending link…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
