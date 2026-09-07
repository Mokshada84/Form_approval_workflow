// ai/extractForm.ts
//
// PHASE 1b. The browser half of one turn.
//
// Note what's absent: no API key, no model name, no prompt, no Anthropic SDK.
// From the browser's point of view this is an ordinary POST to its own origin.
// Everything that must stay secret stayed on the server.

import type { Department } from '../domain/types'
import { ExtractionTurnSchema } from './extractionSchema'
import type { DialogueMessage, ExtractionTurn } from './extractionSchema'

/** Thrown with a message that is safe and useful to show the user. */
export class ExtractionError extends Error {}

/**
 * Send the conversation so far and get the next turn back.
 *
 * The whole transcript goes every time — see the note in server/extractRoute.ts
 * about the Messages API being stateless.
 *
 * `department` is whatever the form's dropdown currently says, not the
 * submitter's own department. Sending the live value is what lets someone pick
 * Legal by hand and then be offered Legal's expense types, rather than being
 * asked about a department they have already chosen.
 */
export async function continueExtraction(
  messages: DialogueMessage[],
  department: Department,
): Promise<ExtractionTurn> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, department }),
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ExtractionError(body?.error ?? 'The assistant could not be reached.')
  }

  // Validating again on this side is not paranoia about the model — the server
  // already did that. It's about the boundary: `fetch` returns `any`, and a
  // deployed frontend can outlive the server version it was written against.
  const parsed = ExtractionTurnSchema.safeParse(body?.turn)
  if (!parsed.success) {
    throw new ExtractionError('The assistant sent back something unexpected.')
  }

  return parsed.data
}
