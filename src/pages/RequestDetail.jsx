import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SkillTag from '../components/SkillTag'
import MatchStamp from '../components/MatchStamp'
import { matchScore } from '../lib/matching'
import { warmEmbeddings, semanticSimilarity } from '../lib/embeddings'
import { logMatchEvent } from '../lib/matchEvents'

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
  const [semanticReady, setSemanticReady] = useState(0)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [competingInterest, setCompetingInterest] = useState(null)
  const [applyError, setApplyError] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const isOwner = request && profile && request.user_id === profile.id

  // Same normalization approach as the matching algorithm — lowercase,
  // punctuation stripped — so "L'Oreal Brandstorm" and "L'Oréal
  // Brandstorm" are recognized as the same competition even if two
  // different requesters typed it slightly differently.
  const normalizeCompetitionName = (name) =>
    (name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()

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

        // Can't apply to two requests for the same competition at once
        // (and can't apply anywhere else once already accepted for it)
        // — see the trigger in 006_one_active_interest_per_competition.sql
        // for the actual enforcement; this is just so the person sees a
        // clear reason instead of only finding out on submit.
        const { data: others } = await supabase
          .from('interests')
          .select('*, request:requests(id, competition_name)')
          .eq('applicant_id', profile.id)
          .in('status', ['pending', 'accepted'])

        const target = normalizeCompetitionName(req.competition_name)
        const conflict = (others || []).find(
          (o) => o.request_id !== id && normalizeCompetitionName(o.request?.competition_name) === target
        )
        setCompetingInterest(conflict || null)
      }
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile])

  useEffect(() => {
    if (!profile || !request) return
    const skills = [
      ...(profile.skills_have || []),
      ...(profile.skills_want || []),
      ...(request.skills_needed || []),
      ...(request.skills_offered || []),
    ]
    let active = true
    warmEmbeddings(skills).then(() => {
      if (active) setSemanticReady((v) => v + 1)
    })
    return () => {
      active = false
    }
  }, [profile, request])

  const expressInterest = async (e) => {
    e.preventDefault()
    setSending(true)
    setApplyError('')
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
    } else {
      // Most likely the database trigger blocking a duplicate
      // competition application — see 006_one_active_interest_per_competition.sql.
      setApplyError(error.message || 'Could not submit your interest — please try again.')
    }
  }

  const acceptedCount = interests.filter((i) => i.status === 'accepted').length
  const teamSize = request?.team_size_needed || 1
  const teamFull = acceptedCount >= teamSize

  const respondToInterest = async (interestId, status) => {
    if (status === 'accepted' && teamFull) return

    const interest = interests.find((i) => i.id === interestId)

    await supabase.from('interests').update({ status }).eq('id', interestId)

    if (interest) {
      logMatchEvent({ interest, request, ownerId: profile.id, outcome: status })
    }

    // Closing the request (here, or via the manual toggle below) is what
    // triggers the notify-unfilled email to everyone else still pending —
    // see supabase/functions/notify-unfilled. Nothing else to do here for
    // that; it's handled server-side off this status change.
    if (status === 'accepted' && acceptedCount + 1 >= teamSize) {
      await supabase.from('requests').update({ status: 'closed' }).eq('id', id)
    }

    load()
  }

  const toggleStatus = async () => {
    const next = request.status === 'open' ? 'closed' : 'open'
    await supabase.from('requests').update({ status: next }).eq('id', id)
    load()
  }

  const deleteRequest = async () => {
    setDeleting(true)
    const { error } = await supabase.from('requests').delete().eq('id', id)
    setDeleting(false)
    if (!error) {
      navigate('/dashboard')
    }
  }

  const withdrawInterest = async () => {
    setWithdrawing(true)
    await supabase.from('interests').update({ status: 'withdrawn' }).eq('id', myInterest.id)
    setWithdrawing(false)
    load()
  }

  // Recomputed on every render, so once semanticReady bumps (embeddings
  // finished warming, see the effect above) this picks up fresh scores
  // automatically — no memoization here to fight with.
  const score = profile ? matchScore(profile, request, null, semanticSimilarity) : null

  if (!request) return <p className="max-w-3xl mx-auto px-4 py-10 text-sm font-display">Retrieving file…</p>

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
                {teamSize > 1 && (
                  <span className="ml-2 font-normal text-charcoal/50">
                    · {acceptedCount}/{teamSize} spots filled
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={toggleStatus} className="text-xs font-display underline text-charcoal/60 hover:text-stamp">
                  Mark as {request.status === 'open' ? 'closed' : 'open'}
                </button>

                {!confirmingDelete ? (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="text-xs font-display underline text-charcoal/60 hover:text-stamp"
                  >
                    Delete this file
                  </button>
                ) : (
                  <span className="text-xs font-display">
                    Delete permanently?{' '}
                    <button
                      onClick={deleteRequest}
                      disabled={deleting}
                      className="text-stamp underline font-bold disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>{' '}
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="text-charcoal/60 underline"
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </div>
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
                        i.status === 'declined' ? 'bg-charcoal/10 text-charcoal/50' :
                        i.status === 'withdrawn' ? 'bg-charcoal/10 text-charcoal/40' : 'bg-stamp/10 text-stamp'
                      }`}>
                        {i.status}
                      </span>
                    </div>
                    {i.status === 'pending' && (
                      request.status === 'open' && !teamFull ? (
                        <div className="mt-2">
                          <div className="flex gap-2">
                            <button onClick={() => respondToInterest(i.id, 'accepted')} className="text-xs px-2 py-1 bg-sage text-white rounded-sm">Accept</button>
                            <button onClick={() => respondToInterest(i.id, 'declined')} className="text-xs px-2 py-1 bg-charcoal/20 text-charcoal rounded-sm">Decline</button>
                          </div>
                          <p className="text-[11px] text-charcoal/40 mt-1">
                            {teamSize > 1
                              ? `Accepting fills ${acceptedCount + 1} of ${teamSize} spots and emails you both each other's contact details.`
                              : "Accepting closes this file and emails you both each other's contact details."}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-charcoal/40 mt-2">
                          {teamFull ? 'Team is filled — this file is no longer taking new acceptances.' : 'This file is closed.'}
                        </p>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-charcoal/20 pt-4">
            {myInterest ? (
              <div className="text-sm text-charcoal/70">
                <p>
                  You've already raised your hand — status: <strong>{myInterest.status}</strong>
                </p>
                {myInterest.status === 'pending' && (() => {
                  // Mirrors the 6-hour hold enforced by the database
                  // policy in 007_allow_withdraw.sql — this is just
                  // what decides whether to show the button at all;
                  // the actual rule lives server-side.
                  const appliedAt = new Date(myInterest.created_at)
                  const unlocksAt = new Date(appliedAt.getTime() + 4 * 60 * 60 * 1000)
                  const canWithdraw = Date.now() >= unlocksAt.getTime()

                  return canWithdraw ? (
                    <button
                      onClick={withdrawInterest}
                      disabled={withdrawing}
                      className="mt-2 text-xs font-display underline text-charcoal/60 hover:text-stamp disabled:opacity-50"
                    >
                      {withdrawing ? 'Withdrawing…' : "Withdraw my application — I'll try elsewhere"}
                    </button>
                  ) : (
                    <p className="mt-2 text-[11px] text-charcoal/40">
                      You can withdraw this after{' '}
                      {unlocksAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      {' '}if you haven't heard back yet.
                    </p>
                  )
                })()}
              </div>
            ) : notice ? (
              <p className="text-sm text-sage">{notice}</p>
            ) : competingInterest ? (
              <p className="text-sm text-charcoal/50">
                {competingInterest.status === 'accepted' ? (
                  <>You're already on a team for <strong>{competingInterest.request?.competition_name}</strong> — can't apply to another request for the same competition.</>
                ) : (
                  <>You already have a pending application for <strong>{competingInterest.request?.competition_name}</strong> — wait to hear back before applying elsewhere for the same competition.</>
                )}
              </p>
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
                {applyError && <p className="text-xs text-stamp">{applyError}</p>}
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
