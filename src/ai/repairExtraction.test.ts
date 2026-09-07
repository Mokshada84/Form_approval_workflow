import { describe, expect, it } from 'vitest'
import { repairExtraction } from './repairExtraction'
import type { ExtractedForm } from './extractionSchema'

/** A schema-valid extraction, which is the point: these all pass the schema. */
function extraction(overrides: Partial<ExtractedForm> = {}): ExtractedForm {
  return {
    name: 'Client dinner',
    amount: 420,
    department: 'Finance',
    expenseType: 'Client entertainment',
    notes: '',
    ...overrides,
  }
}

describe('repairExtraction', () => {
  it('leaves a consistent extraction alone', () => {
    const input = extraction()
    expect(repairExtraction(input)).toEqual(input)
  })

  it('replaces an expense type that belongs to another department', () => {
    // "Laptop" is a real category, so this passes the schema — it just
    // belongs to IT, not to the Legal department chosen here. Exactly the
    // mistake a JSON schema cannot catch.
    const repaired = repairExtraction(
      extraction({ department: 'Legal', expenseType: 'Laptop' }),
    )

    expect(repaired.expenseType).toBe('Legal consultation')
  })

  it('says so in the notes when it corrects the expense type', () => {
    const repaired = repairExtraction(
      extraction({ department: 'IT', expenseType: 'Travel', notes: 'Amount was rounded.' }),
    )

    // The original note survives — the correction is added, not substituted.
    expect(repaired.notes).toContain('Amount was rounded.')
    expect(repaired.notes).toContain('Laptop')
  })

  it('does not leave a stray space when there was no existing note', () => {
    const repaired = repairExtraction(
      extraction({ department: 'IT', expenseType: 'Travel', notes: '' }),
    )

    expect(repaired.notes).toBe('Expense type was corrected to "Laptop".')
  })

  it('keeps a null amount null', () => {
    // The model is allowed to say "not stated", and nothing downstream may
    // quietly turn that into a number.
    expect(repairExtraction(extraction({ amount: null })).amount).toBeNull()
  })
})
