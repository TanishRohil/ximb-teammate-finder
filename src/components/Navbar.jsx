import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const tabs = [
  { to: '/browse', label: 'Browse Cases' },
  { to: '/new', label: 'Raise a Request' },
  { to: '/dashboard', label: 'My Desk' },
]

export default function Navbar({ profile }) {
  return (
    <header className="bg-ink text-manila-light shadow-[0_3px_10px_rgba(0,0,0,0.25)] relative z-10">
      <div className="max-w-5xl mx-auto px-4 pt-4 flex items-end justify-between">
        <div className="pb-3">
          <p className="font-display text-xs tracking-[0.3em] text-manila-light/50 uppercase">
            XIMB · Confidential
          </p>
          <h1 className="font-hand text-3xl font-bold tracking-tight -rotate-1 -mb-1">
            The Board
            <span className="text-stamp">.</span>
          </h1>
        </div>
        <nav className="flex gap-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `relative font-display px-4 py-2 text-xs uppercase tracking-wide transition-all duration-200 hover:-translate-y-0.5 ${
                  isActive
                    ? 'bg-manila-light text-ink -translate-y-1 shadow-[2px_4px_8px_rgba(0,0,0,0.3)]'
                    : 'bg-ink-light text-manila-light/60 hover:text-manila-light'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="pin absolute -top-2 left-1/2 -translate-x-1/2" />
                  )}
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="border-b-2 border-manila-dark" />
      {profile && (
        <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs text-manila-light/50">
          <span>
            Signed in as <strong className="text-manila-light">{profile.full_name || profile.email}</strong>
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="underline decoration-dotted underline-offset-2 hover:text-stamp transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
