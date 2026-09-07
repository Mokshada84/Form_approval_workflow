// ai/repairExtraction.ts
//
// PHASE 1b. What the schema CAN'T guarantee.
//
// A JSON schema pins down the *shape* of an answer — this field is a number,
// that one is one of these twelve strings. It cannot express a relationship
// BETWEEN fields, and "expenseType must belong to the chosen department" is
// exactly that. So a schema-valid answer can still be wrong for this app.
//
// Kept pure and separate from the network call so it can be tested without
// spending a penny on the API.

import { EXPENSE_CATEGORIES } from '../data/expenseCategories'
import type { ExtractionTurn } from './extractionSchema'
import { isComplete } from './extractionSchema'

/**
 * Make one turn internally consistent before anyone acts on it.
 *
 * Two repairs, both of which exist because the model can produce something
 * the schema happily allows:
 *
 *  1. An expense type from the wrong department is discarded and ASKED about,
 *     rather than silently swapped for a different one. Substituting a value
 *     the person never said would be the same sin that started this — a guess
 *     wearing the costume of an answer.
 *  2. A turn that is missing a field but asks no question would strand the
 *     conversation with nothing to show the user, so a question is supplied.
 */
export function repairExtraction(turn: ExtractionTurn): ExtractionTurn {
  let repaired = turn

  // 1. Expense type that doesn't belong to the department.
  if (repaired.department !== null && repaired.expenseType !== null) {
    const allowed = EXPENSE_CATEGORIES[repaired.department]
    if (!allowed.includes(repaired.expenseType)) {
      repaired = {
        ...repaired,
        expenseType: null,
        question: `Which ${repaired.department} expense type applies: ${allowed.join(', ')}?`,
      }
    }
  }

  // 2. Incomplete, but nothing to ask. Falling back to a generic question
  // keeps the dialogue alive instead of dead-ending on a half-filled form.
  if (!isComplete(repaired) && repaired.question === null) {
    repaired = { ...repaired, question: missingFieldQuestion(repaired) }
  }

  // 3. The mirror case: everything known, but still asking. A stray question
  // would keep the user answering after there was nothing left to answer.
  if (isComplete(repaired) && repaired.question !== null) {
    repaired = { ...repaired, question: null }
  }

  return repaired
}

/** A plain question naming the first field still missing. */
function missingFieldQuestion(turn: ExtractionTurn): string {
  if (turn.name === null) return 'What should this expense claim be called?'
  if (turn.amount === null) return 'What is the amount in US dollars?'
  if (turn.department === null) {
    return 'Which department should this be charged to: Legal, Finance, or IT?'
  }
  const allowed = EXPENSE_CATEGORIES[turn.department]
  return `Which ${turn.department} expense type applies: ${allowed.join(', ')}?`
}
