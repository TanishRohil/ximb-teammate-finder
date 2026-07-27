export default function SkillTag({ children, tone = 'sage', highlighted = false }) {
  const tones = {
    sage: 'bg-sage/15 text-sage border-sage/40',
    stamp: 'bg-stamp/10 text-stamp border-stamp/40',
    ink: 'bg-ink/10 text-ink border-ink/30',
  }
  return (
    <span
      className={`inline-block border rounded-sm px-2 py-0.5 text-xs font-medium mr-1 mb-1 ${tones[tone]} ${
        highlighted ? 'ring-2 ring-offset-1 ring-stamp font-bold' : ''
      }`}
    >
      {children}
    </span>
  )
}
