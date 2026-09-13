// scripts/evalRetrieval.ts
//
// PHASE 4b. `npm run eval:retrieval` — the readable report.
//
// The thresholds are asserted in evaluate.test.ts so a regression fails CI;
// this prints the detail you need when one of those assertions goes red, and
// the per-case rows you read while trying to improve something.
//
// Costs nothing to run: retrieval is a pure function, so no API call happens.

import { POLICY_CLAUSES } from '../server/policyCorpus.ts'
import { EVAL_CASES } from '../src/policy/evalCases.ts'
import { evaluateRetrieval } from '../src/policy/evaluate.ts'

const limit = Number(process.argv[2] ?? 6)
const summary = evaluateRetrieval(POLICY_CLAUSES, EVAL_CASES, limit)

const pct = (value: number) => `${(value * 100).toFixed(1)}%`

console.log(`\nRetrieval eval — ${EVAL_CASES.length} cases, ${POLICY_CLAUSES.length} clauses, limit ${limit}\n`)
console.log('case                        primary  rank  recall  missing')
console.log('─'.repeat(78))

for (const result of summary.cases) {
  const testCase = EVAL_CASES.find((c) => c.id === result.id)!
  const rank = result.primaryRank === null ? ' MISS' : `${result.primaryRank}`.padStart(5)
  // Flag the two shapes that matter: not found at all, and found but ranked
  // low enough that a tighter limit would drop it.
  const flag = result.primaryRank === null ? ' <-- not retrieved'
    : result.primaryRank > 3 ? ' <-- ranked low'
    : ''
  console.log(
    `${result.id.padEnd(26)} ${testCase.primary.padEnd(7)} ${rank}  ` +
    `${pct(result.recall).padStart(6)}  ${result.missing.join(' ').padEnd(14)}${flag}`,
  )
}

console.log('─'.repeat(78))
console.log(`primary retrieved   ${pct(summary.primaryFound)}`)
console.log(`primary ranked 1st  ${pct(summary.primaryFirst)}`)
console.log(`mean recall@${limit}      ${pct(summary.meanRecall)}`)
console.log(`mean precision@${limit}   ${pct(summary.meanPrecision)}`)
console.log(`MRR                 ${summary.mrr.toFixed(3)}\n`)
