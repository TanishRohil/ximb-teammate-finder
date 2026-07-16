import { useState } from 'react'

export default function SkillInput({ label, value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (v && !value.some((s) => s.toLowerCase() === v.toLowerCase())) {
      onChange([...value, v])
    }
    setDraft('')
  }

  const remove = (skill) => onChange(value.filter((s) => s !== skill))

  return (
    <div>
      <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
        {label}
      </label>
      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 bg-manila-light border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 bg-ink text-manila-light text-sm rounded-sm hover:bg-ink-light"
        >
          Add
        </button>
      </div>
      <div>
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
