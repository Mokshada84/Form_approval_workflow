import { describe, expect, it } from 'vitest'
import { repairExtraction } from './repairExtraction'
import { isComplete } from './extractionSchema'
import type { ExtractionTurn } from './extractionSchema'

/** A complete, self-consistent turn. Overrides break it one way at a time. */
function turn(overrides: Partial<ExtractionTurn> = {}): ExtractionTurn {
  return {
    name: 'Client dinner',
    amount: 420,
    department: null,
    expenseType: 'Client entertainment',
    question: null,
    notes: '',
    ...overrides,
  }
}

describe('isComplete', () => {
  it('needs a name, an amount and an expense type', () => {
    expect(isComplete(turn())).toBe(true)
    expect(isComplete(turn({ name: null }))).toBe(false)
    expect(isComplete(turn({ amount: null }))).toBe(false)
    expect(isComplete(turn({ expenseType: null }))).toBe(false)
  })

  it('does not need a department', () => {
    // A claim is charged to the submitter's own department unless they say
    // otherwise, so department is never the thing holding a form up.
    expect(isComplete(turn({ department: null }))).toBe(true)
  })

  it('ignores the question when deciding', () => {
    // Completeness is about the FIELDS. A stray question is repaired
    // separately rather than being allowed to mean "not done".
    expect(isComplete(turn({ question: 'anything?' }))).toBe(true)
  })
})

describe('repairExtraction', () => {
  it('fills the department from the form when the turn names none', () => {
    expect(repairExtraction(turn(), 'Finance').department).toBe('Finance')
  })

  it('keeps a department the person explicitly asked for', () => {
    // Cross-charging: "put this on the Legal budget" beats the form's default.
    const repaired = repairExtraction(
      turn({ department: 'Legal', expenseType: 'Filing fees' }),
      'Finance',
    )

    expect(repaired.department).toBe('Legal')
    expect(repaired.expenseType).toBe('Filing fees')
  })

  it('asks about an expense type that belongs to another department', () => {
    // "Laptop" is a real category, so this passes the schema — it just
    // belongs to IT, not to Legal. Exactly what a JSON schema cannot catch.
    const repaired = repairExtraction(turn({ expenseType: 'Laptop' }), 'Legal')

    // Cleared and ASKED about, never swapped for a different guess — putting
    // a value there the person never said is the bug this file exists to stop.
    expect(repaired.expenseType).toBeNull()
    expect(repaired.question).toContain('Legal')
    expect(repaired.question).toContain('Contract review')
  })

  it('checks the expense type against the department the turn names, not the form', () => {
    // The turn moves the claim to IT, so "Laptop" is right even though the
    // form was on Legal.
    const repaired = repairExtraction(
      turn({ department: 'IT', expenseType: 'Laptop' }),
      'Legal',
    )

    expect(repaired.expenseType).toBe('Laptop')
    expect(repaired.question).toBeNull()
  })

  it('never asks which department to use', () => {
    const repaired = repairExtraction(
      turn({ name: null, amount: null, expenseType: null, question: null }),
      'IT',
    )

    expect(repaired.question).not.toContain('department')
  })

  it('supplies a question when a field is missing and none was asked', () => {
    const repaired = repairExtraction(turn({ amount: null, question: null }), 'Finance')

    expect(repaired.question).toContain('amount')
  })

  it('asks about the first missing field, in order', () => {
    const repaired = repairExtraction(
      turn({ name: null, amount: null, question: null }),
      'Finance',
    )

    // Name comes before amount, so that's what gets asked.
    expect(repaired.question).toContain('called')
  })

  it('lists the options when the expense type is what is missing', () => {
    const repaired = repairExtraction(turn({ expenseType: null, question: null }), 'IT')

    expect(repaired.question).toContain('Laptop')
    expect(repaired.question).toContain('Software license')
  })

  it('drops a question once everything is known', () => {
    // Otherwise the person keeps answering after there is nothing left to say.
    expect(repairExtraction(turn({ question: 'Anything else?' }), 'Finance').question).toBeNull()
  })

  it('never invents a value for a field the person did not state', () => {
    const repaired = repairExtraction(
      turn({ name: null, amount: null, expenseType: null, question: null }),
      'Finance',
    )

    expect(repaired.name).toBeNull()
    expect(repaired.amount).toBeNull()
    expect(repaired.expenseType).toBeNull()
  })
})
