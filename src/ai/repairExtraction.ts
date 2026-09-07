// ai/repairExtraction.ts
//
// PHASE 1c. What the schema CAN'T guarantee.
//
// A JSON schema pins down the *shape* of an answer — this field is a number,
// that one is one of these twelve strings. It cannot express a relationship
// BETWEEN fields, and "expenseType must belong to the department" is exactly
// that. So a schema-valid answer can still be wrong for this app.
//
// Kept pure and separate from the network call so it can be tested without
// spending a penny on the API.

import { EXPENSE_CATEGORIES } from '../data/expenseCategories'
import type { Department } from '../domain/types'
import type { ExtractionTurn } from './extractionSchema'
import { isComplete } from './extractionSchema'

/**
 * Make one turn internally consistent before anyone acts on it.
 *
 * `workingDepartment` is the department currently selected on the form. A turn
 * that names no department is charged to it — the model only fills the field
 * when the person explicitly asks to cross-charge somewhere else.
 *
 * Three repairs, all for things the schema happily allows:
 *
 *  1. An expense type from the wrong department is discarded and ASKED about,
 *     never silently swapped for a different one. Substituting a value the
 *     person never said is the same sin that started all this — a guess
 *     wearing the costume of an answer.
 *  2. A turn missing a field but asking nothing would strand the conversation
 *     with nothing to show, so a question is supplied.
 *  3. A turn that has everything but still asks would keep the person
 *     answering after there was nothing left to answer.
 */
export function repairExtraction(
  turn: ExtractionTurn,
  workingDepartment: Department,
): ExtractionTurn {
  // Resolve the department first: everything below depends on knowing which
  // categories are in play, and it is never genuinely unknown.
  let repaired: ExtractionTurn = {
    ...turn,
    department: turn.department ?? workingDepartment,
  }
  const department = repaired.department ?? workingDepartment

  // 1. Expense type that doesn't belong to the department.
  if (repaired.expenseType !== null && !EXPENSE_CATEGORIES[department].includes(repaired.expenseType)) {
    repaired = { ...repaired, expenseType: null, question: expenseTypeQuestion(department) }
  }

  // 2. Incomplete, but nothing to ask.
  if (!isComplete(repaired) && repaired.question === null) {
    repaired = { ...repaired, question: missingFieldQuestion(repaired, department) }
  }

  // 3. Complete, but still asking.
  if (isComplete(repaired) && repaired.question !== null) {
    repaired = { ...repaired, question: null }
  }

  return repaired
}

/** The options for a department, listed so the person can just pick one. */
function expenseTypeQuestion(department: Department): string {
  return `Which ${department} expense type applies: ${EXPENSE_CATEGORIES[department].join(', ')}?`
}

/**
 * A plain question naming the first field still missing.
 *
 * Department is deliberately absent: it always has a value, so it is never
 * the missing field.
 */
function missingFieldQuestion(turn: ExtractionTurn, department: Department): string {
  if (turn.name === null) return 'What should this expense claim be called?'
  if (turn.amount === null) return 'What is the amount in US dollars?'
  return expenseTypeQuestion(department)
}
