// state/useApp.ts
//
// The hook components call to reach the shared state.

import { useContext } from 'react'
import { AppContext } from './appContext'

export function useApp() {
  const context = useContext(AppContext)

  // Guards against being used outside <AppProvider>. A clear message here
  // saves a confusing crash somewhere further down.
  if (context === null) {
    throw new Error('useApp must be used inside an <AppProvider>')
  }

  return context
}
