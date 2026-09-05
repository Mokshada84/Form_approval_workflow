/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

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
