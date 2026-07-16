import { Link } from 'react-router-dom'
import MatchStamp from './MatchStamp'
import SkillTag from './SkillTag'
import { matchScore, matchReasons } from '../lib/matching'
import { semanticSimilarity } from '../lib/embeddings'

// Deterministic per-card tilt so it doesn't jitter between renders —
// derived from the request id, not random, so the same card always
// tilts the same way.
function tiltFor(id) {
  if (!id) return -2
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const options = [-3, -2, -1.5, 1, 1.5, 2, 2.5]
  return options[hash % options.length]
}

export default function RequestCard({ request, viewerProfile, skillWeights, index = 0, semanticReady = 0 }) {
  // semanticReady is otherwise unused here — it's a dependency purely to
  // force this component to recompute once the embedding model finishes
  // warming up (see Browse.jsx), since semanticSimilarity's own cache
  // fills in after this component may have already rendered once.
  const score = viewerProfile ? matchScore(viewerProfile, request, skillWeights, semanticSimilarity) : null
  const reasons = viewerProfile
    ? matchReasons(viewerProfile, request, semanticSimilarity)
    : { filling: [], teaching: [] }
  const fileNumber = request.id ? request.id.slice(0, 8).toUpperCase() : '—'
  const tilt = tiltFor(request.id)
  const showTape = index % 3 === 0

  return (
    <Link
      to={`/request/${request.id}`}
      style={{ '--r': `${tilt}deg`, animationDelay: `${index * 70}ms` }}
      className="board-card card-enter group relative block bg-manila-light border border-charcoal/10 p-4 pt-6 shadow-[3px_6px_14px_rgba(0,0,0,0.35)] focus:outline-none"
    >
      <span className="pin absolute -top-2 left-1/2 -translate-x-1/2" />
      {showTape && (
        <span className="tape absolute -top-2 right-6 w-11 h-5 rotate-6" />
      )}

      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="font-display text-[10px] tracking-widest text-charcoal/50">
            FILE {fileNumber} · {request.status === 'open' ? 'OPEN' : 'CLOSED'}
          </p>
          <h3 className="font-display font-bold text-lg text-ink leading-snug">
            {request.competition_name}
          </h3>
        </div>
      </div>

      <p className="text-sm text-charcoal/80 mt-2 line-clamp-2">{request.description}</p>

      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <div>
          <p className="font-display text-[10px] uppercase tracking-wider text-stamp mb-1">
            Looking for
          </p>
          {(request.skills_needed || []).map((s) => (
            <SkillTag key={s} tone="stamp" highlighted={reasons.filling.includes(s)}>
              {s}
            </SkillTag>
          ))}
        </div>
        <div>
          <p className="font-display text-[10px] uppercase tracking-wider text-sage mb-1">
            Brings to the team
          </p>
          {(request.skills_offered || []).map((s) => (
            <SkillTag key={s} tone="sage" highlighted={reasons.teaching.includes(s)}>
              {s}
            </SkillTag>
          ))}
        </div>
      </div>

      {(reasons.filling.length > 0 || reasons.teaching.length > 0) && (
        <p className="mt-2 text-xs text-charcoal/50">
          Matched on: <span className="text-ink font-medium">{[...reasons.filling, ...reasons.teaching].join(', ')}</span>
        </p>
      )}

      {request.deadline && (
        <p className="mt-3 text-xs text-charcoal/50 font-display">
          Team lock-in by {new Date(request.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
      )}

      {score !== null && (
        <div className="absolute bottom-3 right-3 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-2">
          <MatchStamp score={score} />
        </div>
      )}
    </Link>
  )
}
