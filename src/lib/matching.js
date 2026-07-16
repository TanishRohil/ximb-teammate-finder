// Complementary-skill match scoring.
//
// A request is looking for teammates who cover `skills_needed`.
// A viewer is a strong match if the skills they HAVE cover the gaps the
// request is trying to fill, and if what the request's author already
// brings (`skills_offered`) lines up with what the viewer is hoping to
// learn/get from teammates (`skills_want`). This rewards genuine
// complementarity rather than two people with identical skill sets.
//
// Matching is fuzzy on purpose: two people describing the same skill
// rarely type it identically ("Financial Modelling" vs "Fin. Modeling"
// vs "financial modelling"), so exact string equality alone misses a
// lot of real overlap. This file normalizes, expands known synonyms,
// and falls back to typo-tolerant fuzzy matching before giving up.

// Common ways the same case-competition skill gets phrased. Keys are
// canonical forms; values are variants that should map to that key.
// Add to this list as you notice near-misses in real use.
const SYNONYM_GROUPS = [
  ['financial modelling', 'financial modeling', 'fin modelling', 'fin modeling', 'excel modelling'],
  ['market sizing', 'tam sam som', 'market sizing tam sam som'],
  ['problem solving', 'analytical thinking', 'analytical skills', 'critical thinking'],
  ['market research', 'primary research', 'secondary research'],
  ['presentation design', 'ppt design', 'slide design', 'deck design'],
  ['public speaking', 'presenting', 'presentation skills'],
  ['data analysis', 'data analytics', 'analytics'],
  ['financial analysis', 'finance', 'valuation'],
  ['marketing', 'brand strategy', 'branding'],
  ['operations', 'ops', 'operations strategy'],
  ['web development', 'frontend development', 'coding', 'programming'],
  ['business strategy', 'strategy', 'strategic thinking'],
  ['storytelling', 'narrative building', 'pitch storytelling'],
]

const SYNONYM_MAP = new Map()
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0]
  for (const variant of group) SYNONYM_MAP.set(variant, canonical)
}

// Lowercase, trim, collapse whitespace/punctuation, strip a trailing
// plural 's', then resolve through the synonym map if there's a hit.
function normalize(skill) {
  let s = (skill || '')
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) {
    s = s.slice(0, -1)
  }

  return SYNONYM_MAP.get(s) || s
}

// Levenshtein edit distance, used only for short skill phrases so the
// O(n*m) cost never matters in practice.
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function similarity(a, b) {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - editDistance(a, b) / maxLen
}

const FUZZY_THRESHOLD = 0.8 // ~1-2 character typos in a normal skill phrase still count

// Finds the best-matching skill in `available` for a single `want` skill.
// Returns { score: 0-1, matchedRaw: original text of the match | null }.
function bestMatch(want, available, availableRaw) {
  const wantNorm = normalize(want)
  let best = 0
  let matchedRaw = null

  for (let i = 0; i < available.length; i++) {
    const have = available[i]
    if (wantNorm === have) return { score: 1, matchedRaw: availableRaw[i] }
    const sim = similarity(wantNorm, have)
    if (sim >= FUZZY_THRESHOLD && sim > best) {
      best = sim
      matchedRaw = availableRaw[i]
    }
  }
  return { score: best, matchedRaw }
}

// For each skill in `wanted`, find its best match in `available` and
// weight the credit by how rare that wanted skill is (via `weights`,
// a normalized-skill -> weight map). Rare, hard-to-find skills pull
// the score up more than a skill nearly everyone lists — the same
// logic recommendation systems use so that "we both like breathing
// air" doesn't count the same as a genuine shared specialty.
//
// Falls back to uniform weight 1 for any skill not in the map, so
// this degrades gracefully to a plain average when no corpus-wide
// weight data is available (e.g. scoring a single request in
// isolation, with no visibility into how common each skill is).
function weightedMatch(wanted = [], available = [], weights = null) {
  const availableNorm = available.map(normalize)
  let scoredWeight = 0
  let totalWeight = 0
  const reasons = []

  for (const rawWant of wanted) {
    const wantNorm = normalize(rawWant)
    const weight = weights?.get(wantNorm) ?? 1
    const { score, matchedRaw } = bestMatch(rawWant, availableNorm, available)

    totalWeight += weight
    scoredWeight += score * weight
    if (score >= FUZZY_THRESHOLD) reasons.push(rawWant)
  }

  return { ratio: totalWeight ? scoredWeight / totalWeight : 0, reasons }
}

// Builds a rarity-weight map from a corpus of open requests: skills
// that show up in fewer requests get a higher weight (classic inverse-
// document-frequency shape), so matching on something few people offer
// or need counts for more than matching on something everyone lists.
// Pass the current Browse-page result set in; omit it anywhere only a
// single request is in scope (e.g. the detail page) and matching
// degrades to a plain unweighted average instead.
export function buildSkillWeights(requests = []) {
  const df = new Map() // document frequency: # requests mentioning this skill
  const n = requests.length || 1

  for (const req of requests) {
    const skillsInThisRequest = new Set([
      ...(req.skills_needed || []).map(normalize),
      ...(req.skills_offered || []).map(normalize),
    ])
    for (const skill of skillsInThisRequest) {
      df.set(skill, (df.get(skill) || 0) + 1)
    }
  }

  const weights = new Map()
  for (const [skill, count] of df) {
    weights.set(skill, Math.log(1 + n / count))
  }
  return weights
}

export function matchScore(viewerProfile, request, skillWeights = null) {
  if (!viewerProfile || !request) return 0

  const needed = request.skills_needed || []
  const requestOffers = request.skills_offered || []
  const viewerHas = viewerProfile.skills_have || []
  const viewerWants = viewerProfile.skills_want || []

  const fillsGap = needed.length
    ? weightedMatch(needed, viewerHas, skillWeights).ratio
    : 0.5 // no specific gap listed — treat as neutral

  const teachesViewer = viewerWants.length
    ? weightedMatch(viewerWants, requestOffers, skillWeights).ratio
    : 0.5

  const score = fillsGap * 0.7 + teachesViewer * 0.3
  return Math.round(Math.min(1, score) * 100)
}

// The "you both like hiking" of this app: the specific skills that
// actually drove the score, in the request's own original wording, so
// they can be highlighted on the card instead of leaving the person to
// take the percentage on faith.
export function matchReasons(viewerProfile, request) {
  if (!viewerProfile || !request) return { filling: [], teaching: [] }

  const needed = request.skills_needed || []
  const requestOffers = request.skills_offered || []
  const viewerHas = viewerProfile.skills_have || []
  const viewerWants = viewerProfile.skills_want || []

  return {
    filling: weightedMatch(needed, viewerHas).reasons,
    teaching: weightedMatch(viewerWants, requestOffers).reasons,
  }
}

export function matchLabel(score) {
  if (score >= 75) return 'STRONG MATCH'
  if (score >= 45) return 'GOOD FIT'
  if (score >= 20) return 'PARTIAL FIT'
  return 'LOW OVERLAP'
}
