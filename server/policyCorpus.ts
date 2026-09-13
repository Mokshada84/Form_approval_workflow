// server/policyCorpus.ts
//
// PHASE 4. Loading the policy document.
//
// The corpus is `policy/expense-policy.md` — a plain markdown file, edited by
// whoever owns the policy, not by whoever owns the code. This is the only
// place that reads it.
//
// Read once at startup rather than per request: it is a few kilobytes that
// changes when someone edits a document, and re-reading it on every check
// would add filesystem latency to a path already waiting on a model.
//
// The trade is that editing the policy needs a server restart. `tsx watch`
// only watches modules it has IMPORTED, and this file is read with `fs` — so
// the dev script passes `--include ./policy/**` to watch it explicitly.
// Without that flag you edit the policy, see no change, and conclude the
// retrieval is broken. In production a restart behind a rule change is the
// right behaviour anyway.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePolicy } from '../src/policy/clauses.ts'

// `__dirname` does not exist in ES modules — it is `undefined` and throws on
// use. Deriving the directory from `import.meta.url` is the ESM equivalent,
// and unlike a cwd-relative path it doesn't break when the server is started
// from somewhere other than the project root.
const here = dirname(fileURLToPath(import.meta.url))

export const POLICY_PATH = join(here, '..', 'policy', 'expense-policy.md')

export const POLICY_MARKDOWN = readFileSync(POLICY_PATH, 'utf8')

export const POLICY_CLAUSES = parsePolicy(POLICY_MARKDOWN)

// Fail loudly at startup rather than returning empty results per request. An
// empty corpus makes every policy check answer "no clauses matched", which
// looks like a working feature with nothing to say.
if (POLICY_CLAUSES.length === 0) {
  throw new Error(`No clauses parsed from ${POLICY_PATH} — is the file empty or misformatted?`)
}
