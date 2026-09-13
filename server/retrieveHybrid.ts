// server/retrieveHybrid.ts
//
// PHASE 4c. The three retrieval strategies, side by side.
//
// Lives under server/ because two of them need the embedding model and the
// database — neither of which belongs in a browser bundle. The FUSION itself
// is pure and lives in src/policy/fuse.ts, where it can be tested.

import type { DatabaseSync } from 'node:sqlite'
import { POLICY_CLAUSES } from './policyCorpus.ts'
import { buildRetrievalQuery, retrieveClauses } from '../src/policy/retrieve.ts'
import type { RetrievalSubject } from '../src/policy/retrieve.ts'
import { reciprocalRankFusion } from '../src/policy/fuse.ts'
import { embedOne } from './embed.ts'
import { searchByVector } from './vectorStore.ts'

export type Strategy = 'keyword' | 'vector' | 'hybrid'

/** Keyword only: TF-IDF over the weighted, expanded query. */
export function keywordIds(subject: RetrievalSubject, limit: number): string[] {
  return retrieveClauses(POLICY_CLAUSES, buildRetrievalQuery(subject), limit).map(
    (entry) => entry.clause.id,
  )
}

/**
 * Vector only.
 *
 * The query text must be embedded the SAME WAY the passages were, or the two
 * vectors are not in comparable spaces. Passages were embedded as
 * "Title. Body"; a query is a claim, so it is embedded as a plain sentence
 * describing the claim — the asymmetry is deliberate and standard, but it is
 * the first thing to check when vector search returns nonsense.
 */
export async function vectorIds(
  db: DatabaseSync,
  subject: RetrievalSubject,
  limit: number,
): Promise<string[]> {
  const text = `${subject.name}. ${subject.expenseType} expense of $${subject.amount} in ${subject.department}.${
    subject.hasReceipt ? '' : ' No receipt attached.'
  }`
  const vector = await embedOne(text)
  return searchByVector(db, vector, limit).map((hit) => hit.clauseId)
}

/**
 * Both, fused by reciprocal rank.
 *
 * Each retriever is asked for MORE than the final limit, because fusion can
 * only reorder what it is given: a clause ranked 8th by keyword and 2nd by
 * vector should surface, and it cannot if keyword only handed over six.
 */
export async function hybridIds(
  db: DatabaseSync,
  subject: RetrievalSubject,
  limit: number,
): Promise<string[]> {
  const pool = limit * 2
  // Keyword is synchronous, so it is simply done first — no Promise.all
  // theatre around a function that never yields.
  const keyword = keywordIds(subject, pool)
  const vector = await vectorIds(db, subject, pool)
  return reciprocalRankFusion([keyword, vector])
    .slice(0, limit)
    .map((entry) => entry.id)
}
