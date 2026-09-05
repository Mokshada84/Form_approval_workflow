import type { Department } from '../domain/types'

/** Sample expense options shown after a department is selected. */
export const EXPENSE_CATEGORIES: Record<Department, readonly string[]> = {
  IT: ['Laptop', 'WiFi expenses', 'Software license', 'IT equipment'],
  Finance: ['Travel', 'Client entertainment', 'Office supplies', 'Training'],
  Legal: ['Legal consultation', 'Filing fees', 'Contract review', 'Compliance expense'],
}
