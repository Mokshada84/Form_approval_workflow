// ai/repairExtraction.ts
//
// PHASE 1. What the schema CAN'T guarantee.
//
// A JSON schema pins down the *shape* of the answer — this field is a number,
// that one is one of these four strings. It cannot express a relationship
// BETWEEN fields, and "expenseType must be one of the categories belonging to
// the chosen department" is exactly that.
//
// So the model can hand back a perfectly schema-valid answer that is still
// wrong for this app: department "IT" with expense type "Filing fees". This
// is the general lesson — structured outputs remove parsing failures, not
// semantic ones. You still validate what comes back.
//
// Kept pure and separate from the network call so it can be tested without
// spending a penny on the API.

import { EXPENSE_CATEGORIES } from '../data/expenseCategories'
import type { ExtractedForm } from './extractionSchema'

/**
 * Force `expenseType` to be a category the chosen department actually offers.
 *
 * A mismatch falls back to that department's first category rather than being
 * rejected outright: the rest of the extraction is still useful, and the user
 * reviews every field before submitting anyway.
 */
export function repairExtraction(extracted: ExtractedForm): ExtractedForm {
  const allowed = EXPENSE_CATEGORIES[extracted.department]
  if (allowed.includes(extracted.expenseType)) return extracted

  return {
    ...extracted,
    expenseType: allowed[0],
    notes: [extracted.notes, `Expense type was corrected to "${allowed[0]}".`]
      .filter((part) => part.trim() !== '')
      .join(' '),
  }
}
