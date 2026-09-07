// ai/dialogueRequest.ts
//
// PHASE 1c. Validating what the browser posts to /api/extract.
//
// This lived inside the route, where nothing could test it: Vitest only picks
// up files under `src/`, so every edge case in it — bad roles, oversized
// content, an empty array — was unverified. Moving the pure part here costs
// nothing and makes it testable.
//
// It also fixes a bug that came from lumping failures together: one `null`
// return meant both "you sent nothing" and "this conversation is too long",
// so a person twenty turns deep was told "Describe the expense first." Each
// failure now carries its own message.

import type { Department } from '../domain/types'
import { DEPARTMENTS } from '../data/users'
import type { DialogueMessage } from './extractionSchema'

/** Longest single message we'll accept. Every character sent is billed. */
export const MAX_MESSAGE_LENGTH = 2000

/**
 * Longest conversation we'll accept.
 *
 * A cost ceiling, not a UX one: the whole history is resent every turn, so an
 * unbounded conversation grows the bill quadratically.
 */
export const MAX_TURNS = 20

export type DialogueRequest = {
  messages: DialogueMessage[]
  /** The department currently selected on the form — see the route's prompt. */
  department: Department
}

export type ParseResult =
  | { ok: true; request: DialogueRequest }
  | { ok: false; error: string; status: 400 }

function fail(error: string): ParseResult {
  return { ok: false, error, status: 400 }
}

export function parseDialogueRequest(body: unknown): ParseResult {
  const raw = (body as { messages?: unknown })?.messages

  if (!Array.isArray(raw) || raw.length === 0) {
    return fail('Describe the expense first.')
  }
  if (raw.length > MAX_TURNS) {
    return fail(
      'This conversation has gone on too long. Start over, giving the details in one message.',
    )
  }

  const messages: DialogueMessage[] = []
  for (const item of raw) {
    const role = (item as DialogueMessage)?.role
    const content = (item as DialogueMessage)?.content
    if (role !== 'user' && role !== 'assistant') return fail('Malformed conversation.')
    if (typeof content !== 'string') return fail('Malformed conversation.')

    const trimmed = content.trim()
    if (trimmed === '') return fail('Malformed conversation.')
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return fail(`Keep each message under ${MAX_MESSAGE_LENGTH} characters.`)
    }
    messages.push({ role, content: trimmed })
  }

  // The Messages API requires the first message to come from the user.
  if (messages[0].role !== 'user') return fail('Malformed conversation.')

  // An unrecognised department falls back to Finance rather than being
  // rejected: it only decides which categories to offer, and refusing the
  // whole request over it would strand a conversation the person can't fix.
  const sent = (body as { department?: unknown })?.department
  const department = DEPARTMENTS.includes(sent as Department)
    ? (sent as Department)
    : 'Finance'

  return { ok: true, request: { messages, department } }
}
