// ai/usePolicyCheck.ts
//
// PHASE 4. One form's policy check. Used once per card, so each card keeps its
// own state and a check on one form can't overwrite another's.

import { useCallback, useState } from 'react'
import type { FormRequest } from '../domain/types'
import { checkPolicy } from './checkPolicy'
import type { PolicyCheckResult } from './checkPolicy'

export function usePolicyCheck() {
  const [result, setResult] = useState<PolicyCheckResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async (form: FormRequest) => {
    setPending(true)
    setError('')
    try {
      setResult(await checkPolicy(form))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
    } finally {
      // Runs on both paths, so the button can never be left disabled by a
      // failure — the shape that makes a page look frozen.
      setPending(false)
    }
  }, [])

  return { result, pending, error, run }
}
