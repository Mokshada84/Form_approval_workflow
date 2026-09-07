// ai/extractionSchema.ts
//
// PHASE 1b. The shape of ONE TURN of the conversation, written once and
// imported by both sides: the server sends it to Claude as a JSON schema, and
// the browser gets the matching TypeScript type from `z.infer`.
//
// This module is deliberately free of React and of Node: it is data-shape only,
// which is what lets both TypeScript projects compile it.

import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '../data/expenseCategories'
import { DEPARTMENTS } from '../data/users'

/**
 * Every expense category the app knows, flattened across departments.
 *
 * Built from the same constant the dropdowns are built from, so the model can
 * only ever return a category that actually exists in the UI.
 */
export const ALL_EXPENSE_TYPES = [...new Set(Object.values(EXPENSE_CATEGORIES).flat())]

/**
 * EVERY FIELD IS NULLABLE, and that is the whole design.
 *
 * The first version of this schema made `department` and `expenseType`
 * required enums. The model therefore had no way to say "the description
 * doesn't tell me" — so when asked about "Dinner in Hawaii with Mr. Nitin" it
 * returned Finance / Client entertainment, having quietly decided Mr. Nitin
 * was a client. It wasn't disobeying an instruction; it had no vocabulary for
 * uncertainty. A required field is a demand for an answer, and a model will
 * always supply one.
 *
 * Nullable fields plus `question` give it somewhere to put "I don't know yet",
 * which is what turns a confident guess into a question.
 */
export const ExtractionTurnSchema = z.object({
  name: z.string().nullable(),
  amount: z.number().nullable(),
  department: z.enum(DEPARTMENTS).nullable(),
  expenseType: z.enum(ALL_EXPENSE_TYPES).nullable(),

  /**
   * The next thing to ask the person, or null when nothing is left to ask.
   *
   * This doubles as the "are we done?" signal, which is why it isn't a
   * separate boolean: two fields could disagree, one cannot.
   */
  question: z.string().nullable(),

  /** What is still unknown, in one short sentence. May be empty. */
  notes: z.string(),
})

export type ExtractionTurn = z.infer<typeof ExtractionTurnSchema>

/** One exchange in the conversation, as both sides store it. */
export type DialogueMessage = {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Is there anything left to ask about?
 *
 * Derived, never stored — the same principle as `getStatus()` in the domain
 * layer. A stored "complete" flag would be a second source of truth that could
 * end up disagreeing with the fields themselves.
 *
 * NOTE THE ABSENCE OF `department`. It is never asked about, because it is
 * never unknown: a claim is charged to the submitter's own department unless
 * they say otherwise. Asking would spend a whole round trip establishing
 * something already on screen. The model may still SET it — that's how
 * cross-charging by saying "put this on Legal" works — it just never asks.
 */
export function isComplete(turn: ExtractionTurn): boolean {
  return turn.name !== null && turn.amount !== null && turn.expenseType !== null
}
