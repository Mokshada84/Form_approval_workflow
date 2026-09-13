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

import { POLICY_CLAUSES, POLICY_MARKDOWN } from '../server/policyCorpus.ts'
import { INDEX_PATH, sourceHash } from '../server/policyIndex.ts'
import { openVerifiedIndex } from '../server/vectorStore.ts'
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

  // The same verified open the server does, and for a sharper reason: a stale
  // index would be measured against the CURRENT policy text that keyword
  // search reads, so half the table would be scoring a document that no longer
  // exists — and the comparison it prints is what the default strategy is
  // chosen from.
  const status = openVerifiedIndex(INDEX_PATH, sourceHash(POLICY_MARKDOWN))
  if (!status.ok) {
    console.error(`Cannot measure the vector strategies: ${status.reason}\n`)
    process.exit(1)
  }
  const db = status.db

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
