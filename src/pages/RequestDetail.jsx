import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SkillTag from '../components/SkillTag'
import MatchStamp from '../components/MatchStamp'
import { matchScore } from '../lib/matching'

export default function RequestDetail({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [request, setRequest] = useState(null)
  const [author, setAuthor] = useState(null)
  const [interests, setInterests] = useState([])
  const [message, setMessage] = useState('')
  const [myInterest, setMyInterest] = useState(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')

  const isOwner = request && profile && request.user_id === profile.id

  const load = async () => {
    const { data: req } = await supabase.from('requests').select('*').eq('id', id).maybeSingle()
    setRequest(req)
    if (req) {
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.user_id)
        .maybeSingle()
      setAuthor(authorProfile)

      if (req.user_id === profile?.id) {
        const { data: allInterests } = await supabase
          .from('interests')
          .select('*, applicant:profiles!interests_applicant_id_fkey(*)')
          .eq('request_id', id)
          .order('created_at', { ascending: false })
        setInterests(allInterests || [])
      } else if (profile) {
        const { data: mine } = await supabase
          .from('interests')
          .select('*')
          .eq('request_id', id)
          .eq('applicant_id', profile.id)
          .maybeSingle()
        setMyInterest(mine)
      }
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile])

  const expressInterest = async (e) => {
    e.preventDefault()
    setSending(true)
    const { error } = await supabase.from('interests').insert({
      request_id: id,
      applicant_id: profile.id,
      message: message.trim(),
      status: 'pending',
    })
    setSending(false)
    if (!error) {
      setNotice('Your interest has been filed. The requester will follow up.')
      load()
    }
  }

  const respondToInterest = async (interestId, status) => {
    await supabase.from('interests').update({ status }).eq('id', interestId)

    // Accepting a teammate closes the file to further interest.
    // (Owners can still reopen it from the toggle below if the team falls through.)
    if (status === 'accepted') {
      await supabase.from('requests').update({ status: 'closed' }).eq('id', id)
    }

    load()
  }

  const toggleStatus = async () => {
    const next = request.status === 'open' ? 'closed' : 'open'
    await supabase.from('requests').update({ status: next }).eq('id', id)
    load()
  }

  if (!request) return <p className="max-w-3xl mx-auto px-4 py-10 text-sm font-display">Retrieving file…</p>

  const score = profile ? matchScore(profile, request) : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="text-xs font-display text-charcoal/50 hover:text-stamp mb-4">
        ← Back to files
      </button>

      <div className="bg-manila-light border border-charcoal/20 shadow-[4px_4px_0_rgba(43,43,40,0.15)] p-6">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <p className="font-display text-[10px] tracking-widest text-charcoal/50">
              FILE No. {request.id.slice(0, 8).toUpperCase()} — {request.status.toUpperCase()}
            </p>
            <h2 className="font-display text-2xl font-bold text-ink">{request.competition_name}</h2>
            {author && (
              <p className="text-sm text-charcoal/60 mt-1">
                Filed by {author.full_name} · {author.batch}
                {author.gender && ` · ${author.gender}`}
              </p>
            )}
          </div>
          {score !== null && !isOwner && <MatchStamp score={score} />}
        </div>

        {request.description && <p className="text-sm text-charcoal/80 mb-4">{request.description}</p>}

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-display text-[10px] uppercase tracking-wider text-stamp mb-1">Looking for</p>
            {(request.skills_needed || []).map((s) => <SkillTag key={s} tone="stamp">{s}</SkillTag>)}
          </div>
          <div>
            <p className="font-display text-[10px] uppercase tracking-wider text-sage mb-1">Brings to the team</p>
            {(request.skills_offered || []).map((s) => <SkillTag key={s} tone="sage">{s}</SkillTag>)}
          </div>
        </div>

        <div className="text-xs text-charcoal/50 font-display mb-4 flex gap-4">
          <span>Team size needed: {request.team_size_needed}</span>
          {request.deadline && (
            <span>Lock-in: {new Date(request.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          )}
        </div>

        {isOwner ? (
          <div className="border-t border-charcoal/20 pt-4">
            <div className="flex justify-between items-center mb-3">
              <p className="font-display text-sm font-bold text-ink">
                Interest received ({interests.length})
              </p>
              <button onClick={toggleStatus} className="text-xs font-display underline text-charcoal/60 hover:text-stamp">
                Mark as {request.status === 'open' ? 'closed' : 'open'}
              </button>
            </div>
            {interests.length === 0 ? (
              <p className="text-sm text-charcoal/50">No one has raised their hand yet.</p>
            ) : (
              <div className="space-y-3">
                {interests.map((i) => (
                  <div key={i.id} className="border border-charcoal/20 bg-white p-3 rounded-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm text-ink">{i.applicant?.full_name}</p>
                        <p className="text-xs text-charcoal/50">
                          {i.applicant?.batch}
                          {i.applicant?.gender && ` · ${i.applicant.gender}`}
                        </p>
                        {i.applicant?.skills_have?.length > 0 && (
                          <div className="mt-1">
                            {i.applicant.skills_have.map((s) => <SkillTag key={s} tone="ink">{s}</SkillTag>)}
                          </div>
                        )}
                        {i.message && <p className="text-sm text-charcoal/80 mt-2">"{i.message}"</p>}
                      </div>
                      <span className={`text-xs font-display uppercase px-2 py-0.5 rounded-sm ${
                        i.status === 'accepted' ? 'bg-sage/20 text-sage' :
                        i.status === 'declined' ? 'bg-charcoal/10 text-charcoal/50' : 'bg-stamp/10 text-stamp'
                      }`}>
                        {i.status}
                      </span>
                    </div>
                    {i.status === 'pending' && (
                      <div className="mt-2">
                        <div className="flex gap-2">
                          <button onClick={() => respondToInterest(i.id, 'accepted')} className="text-xs px-2 py-1 bg-sage text-white rounded-sm">Accept</button>
                          <button onClick={() => respondToInterest(i.id, 'declined')} className="text-xs px-2 py-1 bg-charcoal/20 text-charcoal rounded-sm">Decline</button>
                        </div>
                        <p className="text-[11px] text-charcoal/40 mt-1">
                          Accepting closes this file and emails you both each other's contact details.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-charcoal/20 pt-4">
            {myInterest ? (
              <p className="text-sm text-charcoal/70">
                You've already raised your hand — status: <strong>{myInterest.status}</strong>
              </p>
            ) : notice ? (
              <p className="text-sm text-sage">{notice}</p>
            ) : request.status !== 'open' ? (
              <p className="text-sm text-charcoal/50">This file is closed to new interest.</p>
            ) : (
              <form onSubmit={expressInterest} className="space-y-2">
                <label className="block font-display text-xs uppercase tracking-wider text-ink/70">
                  Say why you're a fit
                </label>
                <textarea
                  className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="A line or two is enough."
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 bg-stamp text-manila-light font-display text-sm tracking-wide uppercase hover:bg-stamp-light disabled:opacity-60"
                >
                  {sending ? 'Filing…' : 'Raise my hand'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
