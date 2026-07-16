import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SkillInput from '../components/SkillInput'

export default function CreateRequest({ profile }) {
  const navigate = useNavigate()
  const [competitionName, setCompetitionName] = useState('')
  const [description, setDescription] = useState('')
  const [teamSizeNeeded, setTeamSizeNeeded] = useState(1)
  const [skillsNeeded, setSkillsNeeded] = useState([])
  const [skillsOffered, setSkillsOffered] = useState(profile?.skills_have || [])
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!competitionName.trim() || skillsNeeded.length === 0) {
      setError('Add a competition name and at least one skill you need.')
      return
    }
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('requests').insert({
      user_id: profile.id,
      competition_name: competitionName.trim(),
      description: description.trim(),
      team_size_needed: Number(teamSizeNeeded) || 1,
      skills_needed: skillsNeeded,
      skills_offered: skillsOffered,
      deadline: deadline || null,
      status: 'open',
    })

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <p className="font-display text-[10px] tracking-[0.3em] text-stamp uppercase mb-1">
        Open a new file
      </p>
      <h2 className="font-display text-2xl font-bold text-ink mb-1">Raise a Request</h2>
      <p className="text-sm text-charcoal/70 mb-6">
        Say what the competition needs and what you already bring — we'll surface it to
        people whose skills fill the gap.
      </p>

      <form onSubmit={handleSubmit} className="bg-manila-light border border-charcoal/20 shadow-[4px_4px_0_rgba(43,43,40,0.15)] p-6 space-y-5">
        <div>
          <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
            Competition name
          </label>
          <input
            className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
            value={competitionName}
            onChange={(e) => setCompetitionName(e.target.value)}
            placeholder="e.g. L'Oréal Brandstorm"
          />
        </div>

        <div>
          <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
            Brief
          </label>
          <textarea
            className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Round, theme, what the team still needs to figure out."
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
              Teammates needed
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
              value={teamSizeNeeded}
              onChange={(e) => setTeamSizeNeeded(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-ink/70 mb-1">
              Team lock-in date
            </label>
            <input
              type="date"
              className="w-full bg-white border border-charcoal/30 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <SkillInput
          label="Skills / roles you still need"
          value={skillsNeeded}
          onChange={setSkillsNeeded}
          placeholder="e.g. Financial modelling — press Enter"
        />
        <SkillInput
          label="What you already bring to the team"
          value={skillsOffered}
          onChange={setSkillsOffered}
          placeholder="Pre-filled from your profile — edit as needed"
        />

        {error && <p className="text-xs text-stamp">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-stamp text-manila-light font-display text-sm tracking-wide uppercase hover:bg-stamp-light disabled:opacity-60"
        >
          {saving ? 'Filing…' : 'Post request'}
        </button>
      </form>
    </div>
  )
}
