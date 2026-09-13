// scripts/evalRetrieval.ts
//
// PHASE 4c. `npm run eval:retrieval` — keyword vs vector vs hybrid, on the
// same 22 labelled cases.
//
// This is what the eval was built for. "Are embeddings better?" is a claim
// everyone makes and almost nobody measures; here it either shows up in the
// numbers or it doesn't.
//
// Keyword-only costs nothing. The vector strategies load the embedding model
// (~17s the first time, cached after) and read the index built by
// `npm run build:index`. No API calls, so no spend either way.

import { existsSync } from 'node:fs'
import { POLICY_CLAUSES } from '../server/policyCorpus.ts'
import { INDEX_PATH } from '../server/policyIndex.ts'
import { openIndex } from '../server/vectorStore.ts'
import { EVAL_CASES } from '../src/policy/evalCases.ts'
import type { EvalCase } from '../src/policy/evalCases.ts'
import { scoreIds, summarise } from '../src/policy/evaluate.ts'
import type { CaseResult } from '../src/policy/evaluate.ts'
import { hybridIds, keywordIds, vectorIds } from '../server/retrieveHybrid.ts'

const LIMIT = Number(process.argv[2] ?? 6)
const pct = (value: number) => `${(value * 100).toFixed(1)}%`

async function runStrategy(
  name: string,
  get: (testCase: EvalCase) => Promise<string[]>,
): Promise<CaseResult[]> {
  const results: CaseResult[] = []
  for (const testCase of EVAL_CASES) {
    results.push(scoreIds(testCase, await get(testCase)))
  }
  console.log(`  ${name} done`)
  return results
}

async function main() {
  console.log(`\nRetrieval eval — ${EVAL_CASES.length} cases, ${POLICY_CLAUSES.length} clauses, limit ${LIMIT}\n`)

  if (!existsSync(INDEX_PATH)) {
    console.error(`No vector index at ${INDEX_PATH}. Run \`npm run build:index\` first.\n`)
    process.exit(1)
  }
  const db = openIndex(INDEX_PATH)

  const keyword = await runStrategy('keyword', async (c) => keywordIds(c.subject, LIMIT))
  const vector = await runStrategy('vector ', async (c) => vectorIds(db, c.subject, LIMIT))
  const hybrid = await runStrategy('hybrid ', async (c) => hybridIds(db, c.subject, LIMIT))

  const table = [
    ['keyword', summarise(keyword)] as const,
    ['vector', summarise(vector)] as const,
    ['hybrid', summarise(hybrid)] as const,
  ]

  console.log('\nstrategy   primary found  ranked 1st   recall   precision     MRR')
  console.log('─'.repeat(70))
  for (const [name, s] of table) {
    console.log(
      `${name.padEnd(10)} ${pct(s.primaryFound).padStart(12)} ${pct(s.primaryFirst).padStart(11)} ` +
      `${pct(s.meanRecall).padStart(8)} ${pct(s.meanPrecision).padStart(11)} ${s.mrr.toFixed(3).padStart(7)}`,
    )
  }

  // Per-case, but only where the strategies DISAGREE — the rows that carry
  // information. Cases all three get right tell you nothing.
  console.log('\ncases where the strategies differ on the governing clause:')
  console.log('case                        want    keyword  vector  hybrid')
  console.log('─'.repeat(70))
  const rank = (r: CaseResult) => (r.primaryRank === null ? 'MISS' : String(r.primaryRank))
  let differing = 0
  EVAL_CASES.forEach((testCase, i) => {
    const cells = [rank(keyword[i]), rank(vector[i]), rank(hybrid[i])]
    if (new Set(cells).size === 1) return
    differing += 1
    console.log(
      `${testCase.id.padEnd(26)} ${testCase.primary.padEnd(7)} ${cells[0].padStart(7)} ${cells[1].padStart(7)} ${cells[2].padStart(7)}`,
    )
  })
  if (differing === 0) console.log('  (none)')

  db.close()
  console.log()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
