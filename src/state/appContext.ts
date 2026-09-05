// state/appContext.ts
//
// The context object, alone in its own file.
//
// React Context makes a value available to every component beneath a provider
// without passing it down through each layer in between (known as "prop
// drilling"). Here it means a button deep inside a list can approve a form
// without every component above it having to hand the function down.
//
// Why its own file? Fast Refresh — the thing that updates the browser as you
// save — behaves best when a file exports only components, or only plain
// values. So the context, the provider and the hook each get their own file.

import { createContext } from 'react'
import type { FormRequest, User } from '../domain/types'
import type { Action } from './formsReducer'

export type AppContextValue = {
  /** The signed-in user, or null when nobody is signed in. */
  currentUser: User | null
  forms: FormRequest[]
  dispatch: (action: Action) => void
  signIn: (userId: string) => void
  signOut: () => void
}

/**
 * `null` is the default, used only if a component somehow renders outside the
 * provider. useApp turns that into a clear error rather than a confusing crash
 * further down the line.
 */
export const AppContext = createContext<AppContextValue | null>(null)
