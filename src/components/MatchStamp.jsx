import { matchLabel } from '../lib/matching'

export default function MatchStamp({ score }) {
  const label = matchLabel(score)
  const color =
    score >= 75 ? 'text-stamp' : score >= 45 ? 'text-sage' : 'text-charcoal/50'

  return (
    <div
      className={`stamp ${color} inline-flex flex-col items-center justify-center px-3 py-1.5 font-display uppercase text-xs leading-tight select-none`}
      aria-label={`Match score ${score} percent, ${label}`}
    >
      <span className="text-lg font-bold leading-none">{score}%</span>
      <span className="tracking-wider">{label}</span>
    </div>
  )
}
