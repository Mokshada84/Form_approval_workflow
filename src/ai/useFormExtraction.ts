// ai/useFormExtraction.ts
//
// PHASE 1b. The conversation, held in the browser.
//
// The Messages API keeps no session, so *something* has to remember what was
// said — and that something is this hook. `messages` is the entire memory of
// the exchange; clearing it genuinely starts over, because there is no
// server-side state to also reset.

import { useCallback, useState } from 'react'
import type { Department } from '../domain/types'
import { continueExtraction } from './extractForm'
import type { DialogueMessage, ExtractionTurn } from './extractionSchema'

export function useFormExtraction() {
  const [messages, setMessages] = useState<DialogueMessage[]>([])
  const [turn, setTurn] = useState<ExtractionTurn | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  /**
   * Add the person's reply to the transcript and ask for the next turn.
   *
   * Returns the turn so the caller can fill the form when it's complete,
   * rather than having to watch state in an effect.
   */
  const send = useCallback(
    async (text: string, department: Department): Promise<ExtractionTurn | null> => {
      const trimmed = text.trim()
      if (trimmed === '') return null

      // Built from the CURRENT messages rather than read back from state after
      // setting it: state updates are not applied synchronously, so reading
      // `messages` here would send the transcript one turn out of date.
      const next: DialogueMessage[] = [...messages, { role: 'user', content: trimmed }]
      setMessages(next)
      setPending(true)
      setError('')

      try {
        const result = await continueExtraction(next, department)
        setTurn(result)

        // Only the QUESTION goes into the transcript as the assistant's turn,
        // not the whole JSON object. It keeps the history small — remember it
        // is resent in full every turn — and it's what the person actually saw.
        if (result.question !== null) {
          setMessages([...next, { role: 'assistant', content: result.question }])
        }

        return result
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
        // Drop the failed turn so a retry doesn't send a message the model
        // never actually answered.
        setMessages(messages)
        return null
      } finally {
        // `finally` runs on both paths, so the button can never be left
        // disabled by an error — the failure mode that looks like a frozen page.
        setPending(false)
      }
    },
    [messages],
  )

  const reset = useCallback(() => {
    setMessages([])
    setTurn(null)
    setError('')
  }, [])

  return { messages, turn, pending, error, send, reset }
}
