import { describe, expect, it } from 'vitest'
import { verifyFindings } from './verifyFindings'
import { parsePolicy } from '../policy/clauses'
import type { PolicyCheck } from './policySchema'
import EXPENSE_POLICY from '../../policy/expense-policy.md?raw'

const CLAUSES = parsePolicy(EXPENSE_POLICY)

function check(overrides: Partial<PolicyCheck> = {}): PolicyCheck {
  return { findings: [], summary: 'Looks fine.', ...overrides }
}

describe('verifyFindings', () => {
  it('attaches the real clause text from the corpus', () => {
    const result = verifyFindings(
      check({
        findings: [
          { clauseId: '§4.2', verdict: 'violation', explanation: 'No organisation named.' },
        ],
      }),
      CLAUSES,
    )

    expect(result.findings[0].clauseTitle).toBe('Client entertainment')
    // The text comes from the policy, not from the model — a paraphrased rule
    // is how "$150 per head" quietly becomes "around $150 per person".
    expect(result.findings[0].clauseText).toContain('$150 per head')
  })

  it('drops a citation to a clause that does not exist', () => {
    // The heart of it: "§9.9" reads exactly as authoritative as "§4.2".
    const result = verifyFindings(
      check({
        findings: [
          { clauseId: '§9.9', verdict: 'violation', explanation: 'Invented rule.' },
        ],
      }),
      CLAUSES,
    )

    expect(result.findings).toHaveLength(0)
    expect(result.droppedCitations).toEqual(['§9.9'])
  })

  it('keeps the good findings when one citation is bad', () => {
    const result = verifyFindings(
      check({
        findings: [
          { clauseId: '§9.9', verdict: 'violation', explanation: 'Invented.' },
          { clauseId: '§1.3', verdict: 'unclear', explanation: 'No receipt attached.' },
        ],
      }),
      CLAUSES,
    )

    expect(result.findings.map((f) => f.clauseId)).toEqual(['§1.3'])
    expect(result.droppedCitations).toEqual(['§9.9'])
  })

  it('tolerates whitespace around a citation', () => {
    const result = verifyFindings(
      check({ findings: [{ clauseId: ' §2.1 ', verdict: 'compliant', explanation: 'ok' }] }),
      CLAUSES,
    )

    expect(result.findings[0].clauseId).toBe('§2.1')
  })

  it('puts violations first, then unclear, then compliant', () => {
    // An approver scanning the list needs the problems at the top, not the
    // findings in citation order.
    const result = verifyFindings(
      check({
        findings: [
          { clauseId: '§2.1', verdict: 'compliant', explanation: 'a' },
          { clauseId: '§1.3', verdict: 'unclear', explanation: 'b' },
          { clauseId: '§4.2', verdict: 'violation', explanation: 'c' },
        ],
      }),
      CLAUSES,
    )

    expect(result.findings.map((f) => f.verdict)).toEqual(['violation', 'unclear', 'compliant'])
  })

  it('passes the summary through untouched', () => {
    expect(verifyFindings(check({ summary: 'Two issues.' }), CLAUSES).summary).toBe('Two issues.')
  })
})
