// ai/extractForm.ts
//
// PHASE 1. The browser half of the call.
//
// Note how little there is here, and note what's absent: no API key, no model
// name, no prompt, no Anthropic SDK. From the browser's point of view this is
// an ordinary POST to its own origin. Everything that must stay secret stayed
// on the server, which is the entire architecture of Phase 0 paying off.

import { ExtractedFormSchema } from './extractionSchema'
import type { ExtractedForm } from './extractionSchema'

/** Thrown with a message that is safe and useful to show the user. */
export class ExtractionError extends Error {}

export async function extractForm(description: string): Promise<ExtractedForm> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    // The server sends a human-readable message for the cases it expects
    // (empty input, rate limit, bad key); anything else gets a generic one.
    throw new ExtractionError(body?.error ?? 'The assistant could not be reached.')
  }

  // Validating again on this side is not paranoia about the model — the server
  // already did that. It's about the boundary: `fetch` returns `any`, and a
  // deployed frontend can outlive the server version it was written against.
  // safeParse turns "wrong shape" into an error here rather than a crash three
  // components away.
  const parsed = ExtractedFormSchema.safeParse(body?.extracted)
  if (!parsed.success) {
    throw new ExtractionError('The assistant sent back something unexpected.')
  }

  return parsed.data
}
