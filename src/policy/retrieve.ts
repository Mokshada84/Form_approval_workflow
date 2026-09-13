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
 * Collapse a plural to its singular, crudely.
 *
 * The eval found this: a claim saying "Flight to Berlin" never matched §3.1,
 * which says "all flights under six hours". Exact string matching makes
 * "flight" and "flights" different terms, and the governing clause scored
 * zero on the most obvious word in the query.
 *
 * Only plurals are stripped. Handling "-ing" and "-ed" as well would mangle
 * more than it fixes ("meeting" -> "meet", "provided" -> "provid") and there
 * is no evidence in the eval that it would help — so it stays out until a
 * measurement asks for it. This is what a proper stemmer (Porter, Snowball)
 * does thoroughly; a whole library is not worth it for one suffix.
 */
function singularize(term: string): string {
  if (/^\d+$/.test(term)) return term
  if (term.length > 4 && term.endsWith('ies')) return `${term.slice(0, -3)}y`
  if (term.length > 4 && term.endsWith('ses')) return term.slice(0, -2)
  // "ss" is not a plural: "business", "loss", "expenses" handled above.
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1)
  return term
}

/**
 * Split text into comparable terms.
 *
 * Numbers are kept: "$1,000" becomes "1000", and an amount is often the most
 * discriminating token in a policy question. Terms shorter than three
 * characters go, except digits.
 *
 * Stemming happens BEFORE the stopword check, so "expenses" is collapsed to
 * "expense" and then dropped as filler rather than surviving as a plural.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[$,]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term !== '')
    .filter((term) => term.length >= 3 || /^\d+$/.test(term))
    .map(singularize)
    .filter((term) => !STOPWORDS.has(term))
}

export type ScoredClause = { clause: PolicyClause; score: number }

/**
 * A search term and how much it should count.
 *
 * Weights exist because of a measured failure, not a hunch. Query expansion
 * (below) adds terms like "receipt missing" and "threshold senior manager" to
 * reach clauses the form's own words can't. Unweighted, those extra terms
 * matched other clauses so strongly that they DROWNED OUT the claim itself:
 * "Four nights hotel in central London" found §3.2 Accommodation at rank 3
 * from its own words, and lost it completely once expansion was added. Same
 * for §5.3 and a phone handset.
 *
 * So what the person actually wrote outranks what we inferred they meant.
 */
export type QueryTerm = { term: string; weight: number }

/** Weight every term of a phrase equally. */
function weigh(text: string, weight: number): QueryTerm[] {
  return tokenize(text).map((term) => ({ term, weight }))
}

/**
 * Score every clause against the query and return the best `limit`.
 *
 * Clauses scoring zero are dropped rather than padded in: sending an unrelated
 * clause costs tokens and invites the model to find something to say about it.
 * Returning four good clauses beats returning six when two are noise.
 */
export function retrieveClauses(
  clauses: PolicyClause[],
  query: string | QueryTerm[],
  limit = 6,
): ScoredClause[] {
  // A plain string is treated as all-equal weights, which keeps the simple
  // call shape working for tests and ad-hoc queries.
  const weighted = typeof query === 'string' ? weigh(query, 1) : query

  // Deduplicate, keeping the HIGHEST weight a term was given. A word that is
  // both in the claim and in the expansion should count as the claim's.
  const byTerm = new Map<string, number>()
  for (const { term, weight } of weighted) {
    byTerm.set(term, Math.max(byTerm.get(term) ?? 0, weight))
  }
  const queryTerms = [...byTerm.entries()]
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
    for (const [term, weight] of queryTerms) {
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
      score += (weight * termFrequency * inverseDocumentFrequency) / Math.sqrt(terms.length)
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
export function buildRetrievalQuery(subject: RetrievalSubject): QueryTerm[] {
  return [
    // What the person actually wrote, at full weight.
    ...weigh(subject.name, 1),
    ...weigh(subject.expenseType, 1),

    // Structured facts: real signal, but broad — "Finance" appears in clauses
    // that have nothing to do with any particular claim.
    ...weigh(subject.department, 0.4),
    ...weigh(`${subject.amount} dollars`, 0.4),

    // INFERRED terms, deliberately quieter than everything above. Receipt
    // rules key off a word a form never contains, and threshold clauses are
    // about size rather than about any word in the claim — so these have to be
    // added, but they must not outvote the claim itself.
    ...weigh(subject.hasReceipt ? 'itemised receipt attached' : 'receipt missing lost receipt', 0.3),
    ...(subject.amount > 5000 ? weigh('pre-approved commitment written sign-off', 0.3) : []),
    ...(subject.amount > 1000 ? weigh('threshold senior manager', 0.3) : []),
  ]
}
