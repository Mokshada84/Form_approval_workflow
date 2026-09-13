// ai/policyRequest.ts
//
// PHASE 4. Validating what the browser posts to /api/policy-check.
//
// Lives under src/ rather than in the route so Vitest can reach it — nothing
// under server/ is covered by tests, and validation is exactly the code where
// the edge cases live.
//
// Only the fields the check actually needs are accepted. The browser holds
// whole FormRequest objects including a base64 receipt data URL, and posting
// those wholesale would send a megabyte of image to an endpoint that only
// needs to know whether a receipt exists.

import { DEPARTMENTS } from '../data/users'
import type { Department } from '../domain/types'

export type PolicyCheckInput = {
  number: string
  name: string
  amount: number
  department: Department
  expenseType: string
  submitterName: string
  hasReceipt: boolean
}

export type PolicyParseResult =
  | { ok: true; request: { form: PolicyCheckInput } }
  | { ok: false; error: string; status: 400 }

const MAX_TEXT = 300

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > MAX_TEXT) return null
  return trimmed
}

export function parsePolicyRequest(body: unknown): PolicyParseResult {
  const raw = (body as { form?: unknown })?.form
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'No form to check.', status: 400 }
  }

  const form = raw as Record<string, unknown>
  const number = text(form.number)
  const name = text(form.name)
  const expenseType = text(form.expenseType)
  const submitterName = text(form.submitterName)

  if (number === null || name === null || expenseType === null || submitterName === null) {
    return { ok: false, error: 'That form is missing details needed to check it.', status: 400 }
  }

  // Number.isFinite rejects NaN and Infinity, which JSON.parse will happily
  // produce from "1e999" — and an infinite amount would be interpolated
  // straight into the prompt.
  const amount = form.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'That form has no valid amount.', status: 400 }
  }

  if (!DEPARTMENTS.includes(form.department as Department)) {
    return { ok: false, error: 'That form has no valid department.', status: 400 }
  }

  return {
    ok: true,
    request: {
      form: {
        number,
        name,
        amount,
        department: form.department as Department,
        expenseType,
        submitterName,
        hasReceipt: form.hasReceipt === true,
      },
    },
  }
}
