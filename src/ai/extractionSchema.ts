// ai/extractionSchema.ts
//
// PHASE 1. The shape we demand back from the model, written once and imported
// by BOTH sides: the server sends it to Claude as a JSON schema, and the
// browser gets the matching TypeScript type for free via `z.infer`.
//
// Writing it twice would be the classic way for this to rot — the server would
// start returning a field the UI doesn't know about, and nothing would say so.
//
// This module is deliberately free of React and of Node: it is data-shape only,
// which is what lets both projects compile it.

import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '../data/expenseCategories'
import { DEPARTMENTS } from '../data/users'

/**
 * Every expense category the app knows, flattened across departments.
 *
 * Built from the same constant the dropdowns are built from, so the model can
 * only ever return a category that actually exists in the UI. Hard-coding this
 * list would let the two drift, and the drift would show up as a select box
 * that silently refuses to display the model's answer.
 */
export const ALL_EXPENSE_TYPES = [...new Set(Object.values(EXPENSE_CATEGORIES).flat())]

export const ExtractedFormSchema = z.object({
  /** A short title for the form, as the submitter would write it. */
  name: z.string(),

  /**
   * NULLABLE ON PURPOSE, and the most important line in this file.
   *
   * If the schema demanded a number, the model would have to produce one even
   * when the description never mentions a price — and it would invent a
   * plausible-looking figure. Letting it answer "not stated" is what turns a
   * confident wrong number into an empty field the person fills in themselves.
   */
  amount: z.number().nullable(),

  department: z.enum(DEPARTMENTS),
  expenseType: z.enum(ALL_EXPENSE_TYPES),

  /**
   * Anything assumed, guessed, or not found. Shown to the user verbatim, so
   * they know which fields to double-check rather than trusting all four.
   */
  notes: z.string(),
})

export type ExtractedForm = z.infer<typeof ExtractedFormSchema>
