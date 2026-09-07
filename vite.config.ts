/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // PHASE 0. Anything the app fetches under /api is forwarded to the API
  // server in `server/`, which is the only process holding the Anthropic key.
  //
  // Because the browser only ever calls its own origin (:5173), the request is
  // same-origin: no CORS headers to configure, and no API URL baked into the
  // bundle that would have to change between development and production.
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },

  // Vitest (the test runner) takes its settings from this same file.
  test: {
    // Tests run in Node, which has no `document` or `window`. jsdom is a
    // pretend browser that supplies them, so components can be rendered.
    environment: 'jsdom',
    // Lets tests use `describe`, `it` and `expect` without importing them.
    globals: true,
    // A file that runs once before the tests — see src/setupTests.ts.
    setupFiles: './src/setupTests.ts',
  },
})
