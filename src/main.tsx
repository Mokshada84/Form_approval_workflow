// main.tsx
//
// Where the app starts: it finds <div id="root"> in index.html and renders
// React into it.
//
// Note the nesting — AppProvider wraps App, which is what allows any component
// inside to call useApp() and reach the shared state.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './state/AppProvider'
import { App } from './ui/App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  // StrictMode is a development-only helper: it deliberately runs some code
  // twice to surface bugs early. It has no effect on the built app.
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
