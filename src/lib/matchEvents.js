// Logs every accept/decline decision to `match_events`, capturing the
// exact scores and skills the algorithm saw at that moment. This is
// the data-collection half of the "train a model later" plan — see
// supabase/migrations/004_match_events.sql for the schema and the
// reasoning behind it.
//
// Deliberately fire-and-forget: a logging failure should never block
// or visibly break the actual accept/decline the person is trying to
// do. If this table's RLS or schema drifts out of sync, the app
// degrades to "not collecting training data" rather than "broken."

import { supabase } from './supabaseClient'
import { matchScore } from './matching'
import { semanticSimilarity } from './embeddings'

export async function logMatchEvent({ interest, request, ownerId, outcome }) {
  if (!interest?.applicant) return // no applicant profile loaded — nothing useful to log

  try {
    const heuristicScore = matchScore(interest.applicant, request, null)
    const semanticScore = matchScore(interest.applicant, request, null, semanticSimilarity)

    const { error } = await supabase.from('match_events').insert({
      interest_id: interest.id,
      request_id: request.id,
      applicant_id: interest.applicant_id,
      owner_id: ownerId,
      outcome,
      heuristic_score: heuristicScore,
      semantic_score: semanticScore,
      skills_needed: request.skills_needed || [],
      skills_offered: request.skills_offered || [],
      applicant_skills_have: interest.applicant.skills_have || [],
      applicant_skills_want: interest.applicant.skills_want || [],
      team_size_needed: request.team_size_needed || 1,
    })

    if (error) console.error('match_events logging failed (non-fatal):', error)
  } catch (err) {
    console.error('match_events logging threw (non-fatal):', err)
  }
}
