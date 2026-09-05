// state/formsReducer.ts
//
// Every way the forms can change, in one place.
//
//   current state  +  an action describing what happened  ->  next state
//
// This is a "reducer": a pure function, so its tests are plain function calls
// with no React involved. For a workflow — where what's allowed depends on
// what's already happened — one function is far easier to follow than update
// logic scattered across components.

import { createDraft, decide, submitForm } from '../domain/workflow'
import type { NewFormInput, User } from '../domain/types'
import type { StoredData } from './storage'

/**
 * Every possible change, as a "discriminated union": TypeScript reads the
 * `type` field to know which other fields exist, so it will stop you reading
 * `formId` off an action that doesn't have one.
 */
export type Action =
  | { type: 'draft-saved'; input: NewFormInput; user: User }
  | { type: 'form-created-and-submitted'; input: NewFormInput; user: User }
  | { type: 'draft-submitted'; formId: string }
  | { type: 'draft-deleted'; formId: string }
  | { type: 'decided'; formId: string; user: User; decision: 'approved' | 'rejected' }

export function formsReducer(state: StoredData, action: Action): StoredData {
  switch (action.type) {
    case 'draft-saved': {
      const draft = createDraft(action.input, action.user, state.nextSequence)
      return {
        // Newest first, so a form you just raised is at the top of the list.
        forms: [draft, ...state.forms],
        // Bump the counter so the next form gets a different number.
        nextSequence: state.nextSequence + 1,
      }
    }

    case 'form-created-and-submitted': {
      // Creating and submitting in one go is just the two steps run together.
      const draft = createDraft(action.input, action.user, state.nextSequence)
      return {
        forms: [submitForm(draft), ...state.forms],
        nextSequence: state.nextSequence + 1,
      }
    }

    case 'draft-submitted':
      return {
        ...state,
        forms: state.forms.map((form) => (form.id === action.formId ? submitForm(form) : form)),
      }

    case 'draft-deleted':
      return { ...state, forms: state.forms.filter((form) => form.id !== action.formId) }

    case 'decided':
      return {
        ...state,
        forms: state.forms.map((form) =>
          form.id === action.formId
            // The real rule lives in the domain layer. `decide` returns the
            // form unchanged if this user isn't allowed to decide it, so the
            // "no approving your own form" rule is enforced here too.
            ? decide(form, action.user, action.decision)
            : form,
        ),
      }

    default:
      // If an action is added to the union above and no case is written for it,
      // TypeScript flags this line — a compile-time reminder, not a bug you
      // discover later in the browser.
      return state
  }
}
