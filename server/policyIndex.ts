// server/policyIndex.ts
//
// PHASE 4c. Where the index lives, and how we tell whether it is current.

import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Next to the document it was built from, so the pair is obvious. */
export const INDEX_PATH = join(here, '..', 'policy', 'policy-index.db')

/**
 * A fingerprint of the source document.
 *
 * Stamped into the index at build time and compared at startup. A hash rather
 * than a timestamp because `git checkout` restores mtimes in whatever order it
 * likes, and an index that looks newer than a file it doesn't match is the
 * worst of both.
 */
export function sourceHash(markdown: string): string {
  return createHash('sha256').update(markdown).digest('hex')
}
