import { describe, expect, it } from 'vitest'
import { repairExtraction } from './repairExtraction'
import { isComplete } from './extractionSchema'
import type { ExtractionTurn } from './extractionSchema'

/** A complete, self-consistent turn. Overrides break it in one way at a time. */
function turn(overrides: Partial<ExtractionTurn> = {}): ExtractionTurn {
  return {
    name: 'Client dinner',
    amount: 420,
    department: 'Finance',
    expenseType: 'Client entertainment',
    question: null,
    notes: '',
    ...overrides,
  }
}

describe('isComplete', () => {
  it('is true only when all four fields are known', () => {
    expect(isComplete(turn())).toBe(true)
    expect(isComplete(turn({ amount: null }))).toBe(false)
    expect(isComplete(turn({ department: null }))).toBe(false)
    expect(isComplete(turn({ expenseType: null }))).toBe(false)
    expect(isComplete(turn({ name: null }))).toBe(false)
  })

  it('ignores the question when deciding', () => {
    // Completeness is about the FIELDS. A stray question is repaired
    // separately rather than being allowed to mean "not done".
    expect(isComplete(turn({ question: 'anything?' }))).toBe(true)
  })
})

describe('repairExtraction', () => {
  it('leaves a consistent, complete turn alone', () => {
    const input = turn()
    expect(repairExtraction(input)).toEqual(input)
  })

  it('asks about an expense type that belongs to another department', () => {
    // "Laptop" is a real category, so this passes the schema — it just
    // belongs to IT, not to the Legal department chosen here. Exactly the
    // mistake a JSON schema cannot catch.
    const repaired = repairExtraction(turn({ department: 'Legal', expenseType: 'Laptop' }))

    // Cleared and ASKED about, never swapped for a different guess — putting
    // a value there the person never said is the bug this file exists to stop.
    expect(repaired.expenseType).toBeNull()
    expect(repaired.question).toContain('Legal')
    expect(repaired.question).toContain('Contract review')
  })

  it('supplies a question when a field is missing and none was asked', () => {
    const repaired = repairExtraction(turn({ department: null, question: null }))

    expect(repaired.question).not.toBeNull()
    expect(repaired.question).toContain('department')
  })

  it('asks about the first missing field, in order', () => {
    const repaired = repairExtraction(turn({ amount: null, department: null, question: null }))

    // Amount comes before department, so that's what gets asked.
    expect(repaired.question).toContain('amount')
  })

  it('lists the department options when the expense type is what is missing', () => {
    const repaired = repairExtraction(
      turn({ department: 'IT', expenseType: null, question: null }),
    )

    expect(repaired.question).toContain('Laptop')
    expect(repaired.question).toContain('Software license')
  })

  it('drops a question once every field is known', () => {
    // Otherwise the person keeps answering after there is nothing left to say.
    const repaired = repairExtraction(turn({ question: 'Anything else?' }))

    expect(repaired.question).toBeNull()
  })

  it('never invents a value for a field the person did not state', () => {
    const repaired = repairExtraction(
      turn({ name: null, amount: null, department: null, expenseType: null, question: null }),
    )

    expect(repaired.name).toBeNull()
    expect(repaired.amount).toBeNull()
    expect(repaired.department).toBeNull()
    expect(repaired.expenseType).toBeNull()
  })
})
