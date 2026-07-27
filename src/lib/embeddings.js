// Client-side semantic embeddings for skill matching.
//
// Most comparisons never need the live model at all. Since skills are
// steered toward a fixed preset list (see skillPresets.js), those ~40
// vectors were computed ONCE, offline (scripts/precompute-skill-
// embeddings.js), and shipped as a small static JSON file
// (public/skill-embeddings.json, ~60-100KB). Loading that is instant —
// no model download, no WASM, nothing to wait on.
//
// The full model (all-MiniLM-L6-v2, ~25MB, quantized, via
// transformers.js) only loads as a fallback, and only for whichever
// specific skill isn't in the precomputed set — almost always because
// someone typed a custom skill that isn't on the preset list.
//
// Why any of this exists: the heuristic matcher in matching.js
// (synonyms, typo-tolerance, shared-root-word credit) catches a lot,
// but it's still fundamentally comparing text. Two skills that are
// genuinely related but share no words at all — "Growth Hacking" and
// "Digital Marketing", say — score zero under pure string comparison.
// An embedding model actually represents meaning, so it can catch that.
//
// This module deliberately knows nothing about the matching algorithm
// itself — it just answers "how similar are these two phrases,
// semantically?" and matching.js decides what to do with that number.
// That keeps matching.js framework-agnostic and unit-testable without
// a browser, exactly as it was before this was added.

let extractorPromise = null
let precomputedLoadPromise = null
const embeddingCache = new Map() // normalized skill text -> Float32Array | number[]

function key(skill) {
  return (skill || '').trim().toLowerCase()
}

function getExtractor() {
  if (!extractorPromise) {
    // Dynamic import so pages that never end up needing the live model
    // (which, with presets in place, is now most page loads) don't pay
    // for this library in their bundle at all — Vite splits it into
    // its own chunk, fetched only the first time it's actually needed.
    extractorPromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
    )
  }
  return extractorPromise
}

// Loads the precomputed preset vectors from the static JSON file.
// Cheap and safe to call repeatedly — only fetches once. If the file
// is missing (e.g. the precompute script hasn't been run yet), this
// fails quietly and everything just falls back to the live model, so
// nothing breaks — it's a fast path, not a requirement.
function loadPrecomputed() {
  if (!precomputedLoadPromise) {
    precomputedLoadPromise = fetch('/skill-embeddings.json')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        for (const [skill, vector] of Object.entries(data)) {
          embeddingCache.set(key(skill), vector)
        }
      })
      .catch(() => {
        // No precomputed file yet, or the fetch failed — that's fine,
        // warmEmbeddings below will fall back to the live model for
        // everything instead.
      })
  }
  return precomputedLoadPromise
}

// Call this once, up front, with every distinct skill string currently
// on screen (e.g. everything visible on the Browse page). Cheap to
// call repeatedly — already-embedded strings are skipped, so calling
// it again after new requests load only embeds what's new.
export async function warmEmbeddings(skills) {
  await loadPrecomputed()

  const unique = [...new Set((skills || []).map(key).filter(Boolean))]
  const missing = unique.filter((s) => !embeddingCache.has(s))
  if (missing.length === 0) return // everything was already covered by the precomputed set

  // Only reaches here for skills the precomputed file didn't have —
  // in practice, almost always a custom (non-preset) skill someone typed.
  const extractor = await getExtractor()
  for (const skill of missing) {
    const output = await extractor(skill, { pooling: 'mean', normalize: true })
    embeddingCache.set(skill, output.data)
  }
}

function cosineSimilarity(a, b) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  // Vectors are already L2-normalized (both the precomputed ones and
  // the live model's, via normalize: true), so the dot product alone
  // is the cosine similarity — no need to divide by magnitudes.
  return dot
}

// Returns a 0–1 similarity, or null if either skill hasn't been
// embedded yet (call warmEmbeddings first, or treat null as "not
// ready — fall back to the heuristic score").
export function semanticSimilarity(skillA, skillB) {
  const a = embeddingCache.get(key(skillA))
  const b = embeddingCache.get(key(skillB))
  if (!a || !b) return null
  return cosineSimilarity(a, b)
}
