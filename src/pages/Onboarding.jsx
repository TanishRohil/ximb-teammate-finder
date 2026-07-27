import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SkillInput from '../components/SkillInput'

export default function Onboarding({ user, existingProfile, onSaved }) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(existingProfile?.full_name || '')
  const [batch, setBatch] = useState(existingProfile?.batch || '')
  const [gender, setGender] = useState(existingProfile?.gender || '')
  const [bio, setBio] = useState(existingProfile?.bio || '')
  const [skillsHave, setSkillsHave] = useState(existingProfile?.skills_have || [])
  const [skillsWant, setSkillsWant] = useState(existingProfile?.skills_want || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || skillsHave.length === 0) {
      setError('Add your name and at least one skill you bring.')
      return
    }
    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName.trim(),
      batch: batch.trim(),
      gender: gender || null,
      bio: bio.trim(),
      skills_have: skillsHave,
      skills_want: skillsWant,
    })

    setSaving(false)
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    await onSaved()
    navigate('/browse')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <p className="font-display text-[10px] tracking-[0.3em] text-stamp uppercase mb-1">
        {existingProfile ? 'Amend file' : 'New file'}
      </p>
      <h2 className="font-display text-2xl font-bold text-ink mb-1">Your Dossier</h2>
      <p className="text-sm text-charcoal/70 mb-6">
        This is what teammates will see when your file crosses their desk.
      </p>

      <form onSubmit={handleSubmit} className="bg-manila-light border border-charcoal/20 shadow-[4px_4px_0_rgba(43,43,40,0.15)] p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
              Full name
            </label>
            <input
              className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tanish Rohil Gali"
            />
          </div>
          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
              Batch
            </label>
            <input
              className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="MBA-BM 2026–28"
            />
          </div>
        </div>

        <div>
          <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
            Gender <span className="normal-case text-charcoal/40">(optional)</span>
          </label>
          <select
            className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="Woman">Woman</option>
            <option value="Man">Man</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Self-describe">Self-describe</option>
          </select>
          <p className="text-xs text-charcoal/50 mt-1">
            Shown on your dossier for context. It isn't used to rank or filter matches.
          </p>
        </div>

        <div>
          <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
            Short bio
          </label>
          <textarea
            className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="One or two lines on what you're about."
          />
        </div>

        <SkillInput
          label="Skills you bring"
          value={skillsHave}
          onChange={setSkillsHave}
          placeholder="e.g. Financial modelling — press Enter"
        />
        <SkillInput
          label="Skills you're hoping to learn from teammates"
          value={skillsWant}
          onChange={setSkillsWant}
          placeholder="e.g. Market sizing — press Enter"
        />

        {error && <p className="text-xs text-stamp">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-ink text-manila-light font-display text-sm tracking-wide uppercase hover:bg-ink-light disabled:opacity-60"
        >
          {saving ? 'Filing…' : 'Save my file'}
        </button>
      </form>
    </div>
  )
}
