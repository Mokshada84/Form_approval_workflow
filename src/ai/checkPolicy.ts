// ai/checkPolicy.ts
//
// PHASE 4. The browser half of the policy check.
//
// Only the fields the check needs are sent. A FormRequest carries the receipt
// as a base64 data URL, and posting one wholesale would push a megabyte of
// image at an endpoint that needs a single boolean.

import type { FormRequest } from '../domain/types'
import type { VerifiedPolicyCheck } from './policySchema'

export class PolicyCheckError extends Error {}

export type PolicyCheckResult = {
  check: VerifiedPolicyCheck
  /** What retrieval found — shown so a thin result is legible as a thin search. */
  retrievedClauseIds: string[]
}

export async function checkPolicy(form: FormRequest): Promise<PolicyCheckResult> {
  const response = await fetch('/api/policy-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form: {
        number: form.number,
        name: form.name,
        amount: form.amount,
        department: form.department,
        expenseType: form.expenseType,
        submitterName: form.submitterName,
        hasReceipt: form.receipt !== null,
      },
    }),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new PolicyCheckError(body?.error ?? 'The compliance check could not be reached.')
  }
  if (body?.check === undefined) {
    throw new PolicyCheckError('The compliance check sent back something unexpected.')
  }

  return body as PolicyCheckResult
}
