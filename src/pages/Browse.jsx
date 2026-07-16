import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RequestCard from '../components/RequestCard'
import { matchScore, buildSkillWeights } from '../lib/matching'

export default function Browse({ profile }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    supabase
      .from('requests')
      .select('*')
      .eq('status', 'open')
      .neq('user_id', profile?.id || '')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setRequests(data || [])
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [profile])

  // Rare, hard-to-find skills should count for more than ones every
  // second request lists — this looks across all open requests to
  // figure out which is which, the same way recommendation systems
  // weight a niche shared interest over a near-universal one.
  const skillWeights = useMemo(() => buildSkillWeights(requests), [requests])

  const sorted = useMemo(() => {
    const filtered = requests.filter((r) =>
      search
        ? (r.competition_name + ' ' + (r.skills_needed || []).join(' '))
            .toLowerCase()
            .includes(search.toLowerCase())
        : true
    )
    if (!profile) return filtered
    return [...filtered].sort(
      (a, b) => matchScore(profile, b, skillWeights) - matchScore(profile, a, skillWeights)
    )
  }, [requests, search, profile, skillWeights])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <h2 className="font-hand text-4xl font-bold text-manila-light -rotate-1 drop-shadow-[1px_1px_2px_rgba(0,0,0,0.3)]">
            Open Cases
          </h2>
          <p className="font-display text-xs text-manila-light/70 mt-1">
            Pinned requests, sorted by how well you fit
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by competition or skill…"
          className="bg-manila-light border border-charcoal/20 shadow-[2px_3px_8px_rgba(0,0,0,0.25)] rounded-sm px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-stamp transition-shadow"
        />
      </div>

      {loading ? (
        <p className="text-sm text-manila-light/80 font-display">Pinning up the files…</p>
      ) : sorted.length === 0 ? (
        <div className="border-2 border-dashed border-manila-light/40 p-8 text-center bg-black/10">
          <p className="font-hand text-2xl text-manila-light">The board's empty.</p>
          <p className="text-sm text-manila-light/70 mt-1">
            Be the first to pin a request for your competition.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
          {sorted.map((r, i) => (
            <RequestCard key={r.id} request={r} viewerProfile={profile} skillWeights={skillWeights} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
