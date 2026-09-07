// server/client.ts
//
// PHASE 0. One shared Anthropic client for the whole server.
//
// Building a client per request would be wasteful (each one holds its own
// connection pool), and it's the kind of thing that's easy to do by accident
// once there are several routes.

import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from './env.ts'

export const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

/**
 * The model every route uses, named once.
 *
 * Pinning it in a single constant means a model change is a one-line diff, and
 * it stops different routes silently drifting onto different models — which
 * matters more than it sounds, because the prompt cache is per-model (Phase 5).
 */
export const MODEL = 'claude-opus-5'
