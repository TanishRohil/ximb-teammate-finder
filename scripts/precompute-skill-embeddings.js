// Run this ONCE locally (needs real internet access to download the
// model — won't work in a restricted sandbox):
//
//   node scripts/precompute-skill-embeddings.js
//
// It embeds every skill in src/lib/skillPresets.js and writes the
// vectors to public/skill-embeddings.json. The app loads that file
// instead of the live model for anything on the preset list — the
// ~25MB model + WASM runtime only get pulled down as a fallback, and
// only for whatever specific custom skill triggered it.
//
// Re-run this any time you add/remove/rename a preset in
// skillPresets.js — the JSON needs to stay in sync with that list.

import { pipeline } from '@huggingface/transformers'
import { ALL_SKILLS } from '../src/lib/skillPresets.js'
import { writeFileSync } from 'fs'

console.log(`Embedding ${ALL_SKILLS.length} preset skills...`)

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
  quantized: true,
})

const result = {}
for (const skill of ALL_SKILLS) {
  const output = await extractor(skill, { pooling: 'mean', normalize: true })
  result[skill.toLowerCase()] = Array.from(output.data)
  console.log(`  ✓ ${skill}`)
}

writeFileSync(
  new URL('../public/skill-embeddings.json', import.meta.url),
  JSON.stringify(result)
)

console.log(`\nDone. Wrote public/skill-embeddings.json (${ALL_SKILLS.length} vectors).`)
