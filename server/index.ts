// server/index.ts
//
// PHASE 0. The API server: a second process that runs alongside Vite.
//
// The split looks like this in development:
//
//     browser  ──►  Vite dev server (:5173)  ──►  this server (:8787)  ──►  Anthropic
//                   serves the React app          holds the API key
//                   proxies /api/* onward
//
// The browser only ever talks to :5173. The proxy (see vite.config.ts) makes
// /api/* look same-origin, so there is no CORS to configure and no second URL
// for the frontend to know about.

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { PORT } from './env.ts'
import { extractRoute } from './extractRoute.ts'
import { policyRoute } from './policyRoute.ts'

const app = new Hono()

/**
 * A liveness check. Not glamorous, but it answers the first question you ask
 * when something doesn't work: is the server even up, and did it find a key?
 *
 * It reports *whether* a key was loaded, never the key itself.
 */
app.get('/api/health', (c) => c.json({ ok: true, model: 'claude-opus-5' }))

// PHASE 1. Each capability is its own Hono app, mounted here. Routes stay one
// per file, so adding Phase 2's streaming summary is a new file plus a line.
app.route('/', extractRoute)
app.route('/', policyRoute)

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API server listening on http://localhost:${info.port}`)
})
