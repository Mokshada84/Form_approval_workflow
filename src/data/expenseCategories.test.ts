import { describe, expect, it } from 'vitest'
import { DEPARTMENTS } from './users'
import { EXPENSE_CATEGORIES, coerceExpenseType, isValidExpenseType } from './expenseCategories'

describe('expense categories', () => {
  it('gives every department at least one category', () => {
    // The form falls back to [0] whenever a department changes, so an empty
    // list would put `undefined` into a saved form.
    for (const department of DEPARTMENTS) {
      expect(EXPENSE_CATEGORIES[department].length).toBeGreaterThan(0)
    }
  })

  it('does not share a category between departments', () => {
    // Not a hard requirement, but a shared name would make a stale expense
    // type survive a department change and look correct while being wrong.
    const all = Object.values(EXPENSE_CATEGORIES).flat()
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('isValidExpenseType', () => {
  it('accepts a category the department offers', () => {
    expect(isValidExpenseType('IT', 'Laptop')).toBe(true)
  })

  it('rejects a real category that belongs to another department', () => {
    expect(isValidExpenseType('Legal', 'Software license')).toBe(false)
  })
})

describe('coerceExpenseType', () => {
  it('leaves a valid pairing alone', () => {
    expect(coerceExpenseType('Finance', 'Travel')).toBe('Travel')
  })

  it('replaces a type from another department with the first valid one', () => {
    // The exact case that saved "Legal" + "Software license" before.
    expect(coerceExpenseType('Legal', 'Software license')).toBe('Legal consultation')
  })

  it('never returns a type the department does not offer', () => {
    for (const department of DEPARTMENTS) {
      for (const stale of Object.values(EXPENSE_CATEGORIES).flat()) {
        expect(isValidExpenseType(department, coerceExpenseType(department, stale))).toBe(true)
      }
    }
  })
})
