// server/env.ts
//
// PHASE 0. The whole reason this server exists.
//
// The API key is a bearer credential: anyone holding it can spend money on
// your Anthropic account. A Vite app is *entirely* public — every byte of
// `src/` is downloaded by the browser and readable in devtools — so a key put
// anywhere under `src/` is a published key, `VITE_`-prefixed or not.
//
// So the key lives here, in a process the browser cannot read, and the browser
// asks *this* server to make the call on its behalf.

import { loadEnvFile } from 'node:process'

// Reads .env into process.env. It throws if the file is missing, which is fine
// in production where the variables are set by the host instead — hence the
// empty catch.
try {
  loadEnvFile('.env')
} catch {
  // No .env file. Real environment variables (if any) still apply.
}

/**
 * Read a required variable, failing loudly at startup rather than at the
 * first request. A server that boots without its key only to 500 on every
 * call is much harder to debug than one that refuses to boot.
 */
function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in:\n\n    cp .env.example .env\n`,
    )
  }
  return value
}

export const ANTHROPIC_API_KEY = required('ANTHROPIC_API_KEY')

// The port is optional — 8787 is the default, and it must match the proxy
// target in vite.config.ts.
export const PORT = Number(process.env.PORT ?? 8787)
