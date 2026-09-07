// policy/retrieve.ts
//
// PHASE 4. RETRIEVAL, the naive way: keyword scoring with TF-IDF.
//
// This is deliberately the SIMPLE version, and it is worth building before
// reaching for embeddings — partly because it is often enough, and mostly
// because feeling where it breaks is the only way to understand what
// embeddings actually buy you.
//
// TF-IDF in one paragraph. A term that appears often in a clause is probably
// what that clause is about (term frequency). A term that appears in every
// clause tells you nothing — "expense", "approval", "reimbursable" are noise
// here even though they are not English stopwords (inverse document
// frequency). Multiply the two and rare-but-repeated terms dominate.
//
// WHERE IT BREAKS — and it does, on this very corpus: matching is by exact
// word. "Computer" does not match §5.1's "laptop". "Meal" does not match
// "dinner". "Fired" does not match "terminated". The clause you needed scores
// zero and never reaches the model, which then answers confidently from the
// wrong clauses — the worst failure shape RAG has, because nothing looks wrong.
// `retrieve.test.ts` pins two of these misses as documented behaviour.
// Embeddings are the fix, and they are the next step.

import type { PolicyClause } from './clauses'

/**
 * Words carrying no retrieval signal.
 *
 * The second group are the domain's OWN filler: in a corpus where every clause
 * is about expenses and approval, those words are as useless as "the". A
 * general-purpose stopword list would leave them in.
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
  'has', 'have', 'in', 'is', 'it', 'its', 'may', 'must', 'no', 'not', 'of', 'on',
  'one', 'or', 'that', 'the', 'their', 'this', 'to', 'under', 'where', 'which',
  'will', 'with', 'must', 'was', 'were', 'they', 'them', 'these', 'those',
  'than', 'but',
  // Domain filler — true of nearly every clause, so it separates nothing.
  'expense', 'expenses', 'claim', 'claims', 'claimant', 'reimbursable',
  'reimbursed', 'approval', 'approved', 'employee', 'acme',
])

/**
 * Split text into comparable terms.
 *
 * Numbers are kept: "$1,000" becomes "1000", and an amount is often the most
 * discriminating token in a policy question. Terms shorter than three
 * characters go, except digits.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[$,]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term !== '')
    .filter((term) => term.length >= 3 || /^\d+$/.test(term))
    .filter((term) => !STOPWORDS.has(term))
}

export type ScoredClause = { clause: PolicyClause; score: number }

/**
 * Score every clause against the query and return the best `limit`.
 *
 * Clauses scoring zero are dropped rather than padded in: sending an unrelated
 * clause costs tokens and invites the model to find something to say about it.
 * Returning four good clauses beats returning six when two are noise.
 */
export function retrieveClauses(
  clauses: PolicyClause[],
  query: string,
  limit = 6,
): ScoredClause[] {
  const queryTerms = [...new Set(tokenize(query))]
  if (queryTerms.length === 0) return []

  // Tokenise each clause once. The title is included because it is a dense,
  // hand-written summary — "Client entertainment" is worth more than any
  // sentence in the body.
  const documents = clauses.map((clause) => ({
    clause,
    terms: tokenize(`${clause.title} ${clause.text}`),
  }))

  const scored = documents.map(({ clause, terms }) => {
    let score = 0
    for (const term of queryTerms) {
      const termFrequency = terms.filter((t) => t === term).length
      if (termFrequency === 0) continue

      // How many clauses contain this term at all.
      const documentFrequency = documents.filter((d) => d.terms.includes(term)).length
      // +1 inside the log keeps a term appearing in every clause at a positive
      // but negligible weight, rather than exactly zero.
      const inverseDocumentFrequency = Math.log(1 + clauses.length / documentFrequency)

      // Divide by clause length, or long clauses win by being long rather
      // than by being relevant. sqrt softens it: a clause twice as long is
      // penalised, but not halved.
      score += (termFrequency * inverseDocumentFrequency) / Math.sqrt(terms.length)
    }
    return { clause, score }
  })

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** The facts about a claim that retrieval can search on. */
export type RetrievalSubject = {
  name: string
  amount: number
  department: string
  expenseType: string
  hasReceipt: boolean
}

/**
 * QUERY EXPANSION — building the search text from a form.
 *
 * The obvious query is the form's own words, and it has a hole that showed up
 * on the very first real check. A $10,000 client dinner with no receipt
 * retrieved the entertainment and threshold clauses correctly, and completely
 * missed §1.3 Receipts — because the form's words are "Dinner in Hawaii with
 * Mr Nitin / Client entertainment / Finance / 10000 dollars", and not one of
 * them is the word "receipt". The governing clause existed, scored zero, and
 * never reached the model, which then reported honestly that it had no receipt
 * rule to check against.
 *
 * That is the characteristic RAG failure: the generation step is blameless and
 * the answer is still incomplete, because retrieval is the ceiling on
 * everything after it.
 *
 * The fix is to search on what the claim IS, not only on what it SAYS. A
 * missing receipt is a fact about this claim, so it becomes search terms.
 *
 * These are hand-written heuristics, and it is worth being clear that they are:
 * every one is a rule someone had to think of, and the clause nobody thought of
 * stays invisible. Embeddings remove the need to guess the vocabulary, which is
 * precisely what they are for.
 */
export function buildRetrievalQuery(subject: RetrievalSubject): string {
  const parts = [
    subject.name,
    subject.expenseType,
    subject.department,
    `${subject.amount} dollars`,
  ]

  // Receipt rules key off the word "receipt", which a form never says.
  parts.push(subject.hasReceipt ? 'itemised receipt attached' : 'receipt missing lost receipt')

  // Approval-threshold clauses are about size, and the amount alone is a bare
  // number that matches nothing.
  if (subject.amount > 5000) parts.push('pre-approved commitment written sign-off')
  if (subject.amount > 1000) parts.push('threshold senior manager')

  return parts.join(' ')
}
