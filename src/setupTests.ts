// setupTests.ts
//
// Runs once before the test files (wired up by `setupFiles` in vite.config.ts).
//
// This import adds DOM-aware checks to `expect`, such as
// `expect(element).toBeInTheDocument()`. Without it those wouldn't exist.
import '@testing-library/jest-dom/vitest'
