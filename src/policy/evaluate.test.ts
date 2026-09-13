// policy/evaluate.test.ts
//
// PHASE 4b. The eval as a regression guard.
//
// The thresholds are set just below where retrieval currently measures, so a
// change that makes things worse fails the build rather than being noticed
// three phases later. They are floors, not targets — raise them when a real
// improvement lands, never lower them to make a red test green.

import { describe, expect, it } from 'vitest'
import { parsePolicy } from './clauses'
import { EVAL_CASES } from './evalCases'
import { evaluateRetrieval } from './evaluate'
import EXPENSE_POLICY from '../../policy/expense-policy.md?raw'

const CLAUSES = parsePolicy(EXPENSE_POLICY)
const summary = evaluateRetrieval(CLAUSES, EVAL_CASES, 6)

describe('the eval set itself', () => {
  it('labels every case with a clause that exists', () => {
    // A typo in a label would quietly count as a permanent retrieval failure
    // and drag every number down for no reason.
    const ids = new Set(CLAUSES.map((clause) => clause.id))
    for (const testCase of EVAL_CASES) {
      expect(ids, `${testCase.id} primary`).toContain(testCase.primary)
      for (const also of testCase.alsoRelevant) {
        expect(ids, `${testCase.id} alsoRelevant`).toContain(also)
      }
    }
  })

  it('covers enough ground to mean something', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(20)
    // Cases clustered on three clauses would measure almost nothing.
    expect(new Set(EVAL_CASES.map((c) => c.primary)).size).toBeGreaterThanOrEqual(18)
  })
})

describe('retrieval quality', () => {
  it('retrieves the governing clause for almost every claim', () => {
    // Measured 95.5% (21/22) after stemming and term weighting; was 77.3%.
    expect(summary.primaryFound).toBeGreaterThanOrEqual(0.9)
  })

  it('ranks the governing clause first most of the time', () => {
    // Measured 77.3%; was 18.2%. This is the number that protects against a
    // tighter CLAUSE_LIMIT silently dropping the one clause that mattered.
    expect(summary.primaryFirst).toBeGreaterThanOrEqual(0.7)
  })

  it('finds most of the clauses a reviewer would expect', () => {
    // Measured 95.5%; was 79.5%.
    expect(summary.meanRecall).toBeGreaterThanOrEqual(0.9)
  })

  it('ranks well, not just inclusively', () => {
    // Mean reciprocal rank. Measured 0.850; was 0.397. Recall alone would
    // call a clause found at position six a success.
    expect(summary.mrr).toBeGreaterThanOrEqual(0.8)
  })

  it('still finds the governing clause when only four are retrieved', () => {
    // The failure this guards against: §4.2 once sat fifth for a client
    // dinner, so it survived at limit 6 and would have vanished at limit 4.
    // Retrieval quality has to hold up when someone tightens the budget.
    expect(evaluateRetrieval(CLAUSES, EVAL_CASES, 4).primaryFound).toBeGreaterThanOrEqual(0.85)
  })
})
