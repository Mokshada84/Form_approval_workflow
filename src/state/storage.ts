// state/storage.ts
//
// The only file that talks to localStorage. Keeping it alone here means the
// rest of the app has no idea where its data is kept — swap this for a real
// server later and nothing else has to change.

import type { FormRequest } from '../domain/types'

const FORMS_KEY = 'form-approval.forms'
const SESSION_KEY = 'form-approval.signed-in-user'

/**
 * What we keep on disk: the forms, plus the next number to hand out.
 *
 * The counter is stored rather than worked out from the forms so numbers are
 * never reused — delete FORM-0003 and the next form is still FORM-0004.
 */
export type StoredData = {
  forms: FormRequest[]
  nextSequence: number
}

const EMPTY: StoredData = { forms: [], nextSequence: 1 }

/**
 * Read the saved forms. Falls back to empty if nothing is saved or anything
 * goes wrong — localStorage is genuinely unavailable in some private browsing
 * modes, and saved text can be corrupt. An empty start beats a crash.
 */
export function loadData(): StoredData {
  try {
    const saved = localStorage.getItem(FORMS_KEY)
    if (saved === null) return EMPTY

    const parsed: unknown = JSON.parse(saved)
    // JSON.parse returns `unknown` — it could be anything at all, so check the
    // shape before trusting it.
    if (typeof parsed !== 'object' || parsed === null) return EMPTY

    const data = parsed as Partial<StoredData>
    if (!Array.isArray(data.forms)) return EMPTY

    return {
      forms: data.forms,
      nextSequence: typeof data.nextSequence === 'number' ? data.nextSequence : data.forms.length + 1,
    }
  } catch {
    return EMPTY
  }
}

/** Write the forms out as text. Failures are ignored so the session continues. */
export function saveData(data: StoredData): void {
  try {
    localStorage.setItem(FORMS_KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked — nothing useful to do here.
  }
}

/**
 * Who is signed in, remembered across refreshes so you aren't thrown back to
 * the sign-in page every time the page reloads. Only the id is kept; the rest
 * of the user comes from the directory in data/users.ts.
 */
export function loadSignedInUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function saveSignedInUserId(userId: string | null): void {
  try {
    if (userId === null) {
      localStorage.removeItem(SESSION_KEY)
    } else {
      localStorage.setItem(SESSION_KEY, userId)
    }
  } catch {
    // Ignored, as above.
  }
}
