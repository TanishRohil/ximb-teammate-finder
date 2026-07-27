import { useMemo, useRef, useState } from 'react'
import { SKILL_CATEGORIES, ALL_SKILLS } from '../lib/skillPresets'

// Same props/interface as before (label, value, onChange, placeholder)
// so Onboarding.jsx and CreateRequest.jsx needed zero changes to pick
// this up — only the picking experience changed, not the data shape.
export default function SkillInput({ label, value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const closeTimeout = useRef(null)

  const alreadyHas = (skill) => value.some((s) => s.toLowerCase() === skill.toLowerCase())

  const grouped = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return SKILL_CATEGORIES.map((cat) => ({
      label: cat.label,
      skills: cat.skills.filter((s) => !alreadyHas(s) && (q === '' || s.toLowerCase().includes(q))),
    })).filter((cat) => cat.skills.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, value])

  const exactPresetMatch = ALL_SKILLS.find((s) => s.toLowerCase() === draft.trim().toLowerCase())
  const showCustomOption = draft.trim().length > 0 && !exactPresetMatch && !alreadyHas(draft.trim())

  const addSkill = (skill) => {
    const v = skill.trim()
    if (v && !alreadyHas(v)) onChange([...value, v])
    setDraft('')
  }

  const remove = (skill) => onChange(value.filter((s) => s !== skill))

  const handleBlur = () => {
    // Delay so a click/mousedown on a dropdown option registers first —
    // a plain onBlur would close the list before the click lands.
    closeTimeout.current = setTimeout(() => setOpen(false), 150)
  }

  const handleFocus = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    setOpen(true)
  }

  return (
    <div>
      <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          className="w-full bg-manila-light border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
          value={draft}
          placeholder={placeholder || 'Search skills…'}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addSkill(exactPresetMatch || draft)
            }
          }}
        />

        {open && (grouped.length > 0 || showCustomOption) && (
          <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-charcoal/20 rounded-sm shadow-[3px_4px_10px_rgba(0,0,0,0.15)]">
            {grouped.map((cat) => (
              <div key={cat.label}>
                <p className="font-display text-[10px] uppercase tracking-wider text-charcoal/40 px-3 pt-2 pb-1">
                  {cat.label}
                </p>
                {cat.skills.map((skill) => (
                  <button
                    type="button"
                    key={skill}
                    onMouseDown={(e) => {
                      e.preventDefault() // keep focus so the list doesn't close before this fires
                      addSkill(skill)
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-sage/10 text-charcoal"
                  >
                    {skill}
                  </button>
                ))}
              </div>
            ))}

            {showCustomOption && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  addSkill(draft)
                }}
                className="block w-full text-left px-3 py-2 text-sm border-t border-dashed border-charcoal/20 text-stamp hover:bg-stamp/5"
              >
                + Add "{draft.trim()}" as a custom skill
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-2">
        {value.map((skill) => (
          <button
            type="button"
            key={skill}
            onClick={() => remove(skill)}
            className="inline-block border border-sage/40 bg-sage/15 text-sage rounded-sm px-2 py-0.5 text-xs font-medium mr-1 mb-1 hover:line-through"
            title="Click to remove"
          >
            {skill} ✕
          </button>
        ))}
      </div>
    </div>
  )
}
