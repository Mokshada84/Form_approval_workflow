// state/AppProvider.tsx
//
// Wraps the app: holds the forms, remembers who is signed in, and keeps both
// in step with localStorage.

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import { findUser } from '../data/users'
import { formsReducer } from './formsReducer'
import { loadData, loadSignedInUserId, saveData, saveSignedInUserId } from './storage'
import { AppContext } from './appContext'

export function AppProvider({ children }: { children: ReactNode }) {
  // useReducer's third argument is a function that works out the initial value.
  // Passing loadData there means it runs ONCE on the first render, rather than
  // on every render — the same idea as lazy initial state with useState.
  const [data, dispatch] = useReducer(formsReducer, undefined, loadData)

  // Only the id is held in state; the full user is looked up from the directory.
  const [currentUserId, setCurrentUserId] = useState<string | null>(loadSignedInUserId)

  // Save whenever the forms change. One effect covers every action, so no
  // individual case in the reducer has to remember to persist.
  useEffect(() => {
    saveData(data)
  }, [data])

  // `useCallback` keeps these functions identical between renders, so the
  // context value below only changes when the data actually does.
  const signIn = useCallback((userId: string) => {
    setCurrentUserId(userId)
    saveSignedInUserId(userId)
  }, [])

  const signOut = useCallback(() => {
    setCurrentUserId(null)
    saveSignedInUserId(null)
  }, [])

  // An unknown id (say, a user removed from the directory) resolves to null,
  // which sends the person back to the sign-in page rather than crashing.
  const currentUser = currentUserId === null ? null : (findUser(currentUserId) ?? null)

  // `useMemo` stops a brand-new object being built on every render, which would
  // needlessly re-render every component reading this context.
  const value = useMemo(
    () => ({ currentUser, forms: data.forms, dispatch, signIn, signOut }),
    [currentUser, data.forms, signIn, signOut],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
