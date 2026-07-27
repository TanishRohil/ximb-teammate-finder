import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import RequestCard from '../components/RequestCard'

export default function MyDashboard({ profile }) {
  const [myRequests, setMyRequests] = useState([])
  const [myInterests, setMyInterests] = useState([])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('requests')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyRequests(data || []))

    supabase
      .from('interests')
      .select('*, request:requests(*)')
      .eq('applicant_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyInterests(data || []))
  }, [profile])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-display text-[10px] tracking-[0.3em] text-stamp uppercase mb-1">
            Your desk
          </p>
          <h2 className="font-display text-2xl font-bold text-ink">My Desk</h2>
        </div>
        <Link
          to="/onboarding"
          className="text-xs font-display underline text-charcoal/60 hover:text-stamp"
        >
          Edit my dossier
        </Link>
      </div>

      <section>
        <h3 className="font-display text-sm font-bold text-ink mb-3 uppercase tracking-wide">
          Files I've opened ({myRequests.length})
        </h3>
        {myRequests.length === 0 ? (
          <p className="text-sm text-charcoal/50">
            You haven't raised a teammate request yet.{' '}
            <Link to="/new" className="underline text-stamp">Raise one now.</Link>
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {myRequests.map((r) => (
              <RequestCard key={r.id} request={r} viewerProfile={null} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-sm font-bold text-ink mb-3 uppercase tracking-wide">
          Hands I've raised ({myInterests.length})
        </h3>
        {myInterests.length === 0 ? (
          <p className="text-sm text-charcoal/50">
            You haven't expressed interest in any file yet.{' '}
            <Link to="/browse" className="underline text-stamp">Browse open cases.</Link>
          </p>
        ) : (
          <div className="space-y-2">
            {myInterests.map((i) => (
              <Link
                key={i.id}
                to={`/request/${i.request_id}`}
                className="flex justify-between items-center bg-manila-light border border-charcoal/20 px-4 py-3 hover:border-stamp"
              >
                <span className="font-display text-sm text-ink">{i.request?.competition_name}</span>
                <span
                  className={`text-xs font-display uppercase px-2 py-0.5 rounded-sm ${
                    i.status === 'accepted'
                      ? 'bg-sage/20 text-sage'
                      : i.status === 'declined'
                      ? 'bg-charcoal/10 text-charcoal/50'
                      : 'bg-stamp/10 text-stamp'
                  }`}
                >
                  {i.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
