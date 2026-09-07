// policy/evaluate.ts
//
// PHASE 4b. Scoring retrieval against the labelled set.
//
// Three numbers, because each answers a different question and no one of them
// is enough on its own:
//
//   RECALL@k     Of the clauses that should have been found, how many were?
//                The one that matters most for RAG: a clause that is not
//                retrieved cannot be used, and the model will answer
//                confidently from whatever it did get. Recall is the ceiling
//                on the whole feature.
//
//   PRECISION@k  Of what was retrieved, how much was relevant? Noise costs
//                tokens and invites the model to find something to say about
//                an unrelated rule.
//
//   PRIMARY RANK Where the single governing clause landed. Recall hides this:
//                a clause ranked 6th of 6 counts as found, and disappears the
//                moment anyone tightens the limit. This is what caught §4.2
//                sitting fifth for a client dinner.

import type { PolicyClause } from './clauses'
import { buildRetrievalQuery, retrieveClauses } from './retrieve'
import type { EvalCase } from './evalCases'

export type CaseResult = {
  id: string
  /** 1-based position of the primary clause, or null if it wasn't retrieved. */
  primaryRank: number | null
  recall: number
  precision: number
  retrieved: string[]
  missing: string[]
}

export type EvalSummary = {
  cases: CaseResult[]
  /** Share of cases where the primary clause appeared at all. */
  primaryFound: number
  /** Share of cases where the primary clause ranked first. */
  primaryFirst: number
  meanRecall: number
  meanPrecision: number
  /** Mean reciprocal rank of the primary clause — rewards ranking it high. */
  mrr: number
}

export function evaluateCase(
  clauses: PolicyClause[],
  testCase: EvalCase,
  limit: number,
): CaseResult {
  const retrieved = retrieveClauses(clauses, buildRetrievalQuery(testCase.subject), limit).map(
    (entry) => entry.clause.id,
  )

  const expected = [testCase.primary, ...testCase.alsoRelevant]
  const found = expected.filter((id) => retrieved.includes(id))
  const position = retrieved.indexOf(testCase.primary)

  return {
    id: testCase.id,
    primaryRank: position === -1 ? null : position + 1,
    recall: found.length / expected.length,
    // Guard the empty case: retrieving nothing is a recall failure, not a
    // precision triumph, and 0/0 would otherwise be NaN and poison the mean.
    precision: retrieved.length === 0 ? 0 : found.length / retrieved.length,
    retrieved,
    missing: expected.filter((id) => !retrieved.includes(id)),
  }
}

export function evaluateRetrieval(
  clauses: PolicyClause[],
  cases: EvalCase[],
  limit = 6,
): EvalSummary {
  const results = cases.map((testCase) => evaluateCase(clauses, testCase, limit))
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

  return {
    cases: results,
    primaryFound: mean(results.map((r) => (r.primaryRank === null ? 0 : 1))),
    primaryFirst: mean(results.map((r) => (r.primaryRank === 1 ? 1 : 0))),
    meanRecall: mean(results.map((r) => r.recall)),
    meanPrecision: mean(results.map((r) => r.precision)),
    mrr: mean(results.map((r) => (r.primaryRank === null ? 0 : 1 / r.primaryRank))),
  }
}
