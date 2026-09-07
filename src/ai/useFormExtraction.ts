// ai/useFormExtraction.ts
//
// PHASE 1. The three states every network call has, held in one place.
//
// An API call is not instant and can fail, which is a genuine change for this
// app: until now every action was synchronous and could not fail. `pending`
// exists so the button can be disabled — without it, an impatient double-click
// is two paid API calls.

import { useCallback, useState } from 'react'
import { extractForm } from './extractForm'
import type { ExtractedForm } from './extractionSchema'

export function useFormExtraction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async (description: string): Promise<ExtractedForm | null> => {
    setPending(true)
    setError('')
    try {
      return await extractForm(description)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      return null
    } finally {
      // `finally` runs on both paths, so the button can never be left disabled
      // by an error — the failure mode that makes a page look frozen.
      setPending(false)
    }
  }, [])

  return { run, pending, error }
}
