import type { Department } from '../domain/types'

/** Sample expense options shown after a department is selected. */
export const EXPENSE_CATEGORIES: Record<Department, readonly string[]> = {
  IT: ['Laptop', 'WiFi expenses', 'Software license', 'IT equipment'],
  Finance: ['Travel', 'Client entertainment', 'Office supplies', 'Training'],
  Legal: ['Legal consultation', 'Filing fees', 'Contract review', 'Compliance expense'],
}

/** Is this expense type one the department actually offers? */
export function isValidExpenseType(department: Department, expenseType: string): boolean {
  return EXPENSE_CATEGORIES[department].includes(expenseType)
}

/**
 * An expense type that is definitely valid for the department.
 *
 * Categories don't overlap between departments, so changing department almost
 * always invalidates the chosen type. Leaving the old one in place is what
 * caused a Legal form to be saved with "Software license" on it: the <select>
 * had no matching <option> so it displayed something else entirely, while the
 * stale value went through to the reducer unnoticed.
 *
 * Falling back to the department's first category matches what the form
 * already does when it first loads, and — unlike the stale value — it is
 * visible in the dropdown, so the person can see it and change it.
 */
export function coerceExpenseType(department: Department, expenseType: string): string {
  return isValidExpenseType(department, expenseType)
    ? expenseType
    : EXPENSE_CATEGORIES[department][0]
}
