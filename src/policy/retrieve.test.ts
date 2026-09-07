import { describe, expect, it } from 'vitest'
import { POLICY_CLAUSES, findClause, parsePolicy } from './clauses'
import { EXPENSE_POLICY } from './expensePolicy'
import { buildRetrievalQuery, retrieveClauses, tokenize } from './retrieve'

/** Ids of the clauses retrieved for a query, best first. */
function idsFor(query: string, limit = 6): string[] {
  return retrieveClauses(POLICY_CLAUSES, query, limit).map((entry) => entry.clause.id)
}

describe('parsePolicy', () => {
  it('finds every numbered clause', () => {
    // Counted from the corpus itself, not by grepping the source file — the
    // module's own comments mention the `## §` heading format too.
    const headings = EXPENSE_POLICY.match(/^## §/gm) ?? []
    expect(POLICY_CLAUSES).toHaveLength(headings.length)
    expect(POLICY_CLAUSES).toHaveLength(34)
  })

  it('parses the LAST clause, not just the ones with a clause after them', () => {
    // Regression: the first parser ended each match at `(?=^## |\z)`, and
    // `\z` is not a JavaScript anchor — it matched a literal "z", so the
    // final clause of the document silently disappeared.
    expect(findClause('§7.4')?.title).toBe('Expenses that are never reimbursable')
  })

  it('keeps the id, the title and the body separate', () => {
    const clause = findClause('§4.2')

    expect(clause?.title).toBe('Client entertainment')
    expect(clause?.text).toContain('$150 per head')
    // The heading must not be duplicated into the body — it would be scored
    // twice and quoted back with markdown syntax in it.
    expect(clause?.text).not.toContain('##')
  })

  it('drops the document title, which is navigation rather than a rule', () => {
    expect(POLICY_CLAUSES.some((c) => c.text.includes('Acme Corporation — Employee'))).toBe(false)
  })

  it('ignores a heading with no body', () => {
    expect(parsePolicy('## §9.1 Empty\n\n## §9.2 Real\nSome text.')).toHaveLength(1)
  })
})

describe('tokenize', () => {
  it('keeps amounts as comparable numbers', () => {
    // "$1,000" and "1000" must land on the same term or an amount in the
    // query can never match an amount in a clause.
    expect(tokenize('$1,000')).toEqual(['1000'])
  })

  it('drops domain filler, not just English stopwords', () => {
    // Every clause is about expenses and approval, so those words separate
    // nothing — leaving them in would make all 35 clauses look similar.
    expect(tokenize('the expense claim was approved')).toEqual([])
  })
})

describe('retrieveClauses', () => {
  it('finds the client entertainment cap for a client dinner', () => {
    expect(idsFor('Client dinner with Mr Nitin, client entertainment')).toContain('§4.2')
  })

  it('finds the laptop rules for a laptop claim', () => {
    expect(idsFor('Laptop replacement, IT')).toContain('§5.1')
  })

  it('ranks the most specific clause first, not merely a matching one', () => {
    expect(idsFor('mileage for driving my own car')[0]).toBe('§3.4')
  })

  it('finds the filing fee clause for a legal filing', () => {
    expect(idsFor('Filing fees for the trademark renewal, Legal')).toContain('§6.2')
  })

  it('returns nothing rather than padding with noise', () => {
    // A query with no shared vocabulary must come back empty. Padding to
    // `limit` would spend tokens inviting the model to comment on unrelated
    // rules — worse than saying nothing.
    expect(idsFor('xylophone quantum bicycle')).toEqual([])
  })

  it('respects the limit', () => {
    expect(idsFor('travel hotel flight meal receipt approval', 3)).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// The point of building the naive version first: these are the misses.
//
// Each one is a real question a person would ask, whose answering clause
// exists in the corpus and is NOT retrieved, because keyword matching compares
// spellings rather than meanings. They're written as passing tests so the
// limitation is pinned rather than described — when embeddings land, these
// flip, and the diff is the argument for them.
// ---------------------------------------------------------------------------
describe('where keyword retrieval fails', () => {
  it('misses the laptop clause when you say "computer"', () => {
    // §5.1 is entirely about laptops and never uses the word "computer".
    expect(idsFor('new computer for my work')).not.toContain('§5.1')
  })

  it('misses the alcohol clause when you say "wine"', () => {
    // §4.3 governs exactly this and says "alcohol", never "wine".
    expect(idsFor('bottle of wine with the client')).not.toContain('§4.3')
  })

  it('misses the companion clause when you say "wife"', () => {
    // §3.6 says "spouse, partner, family member". Not "wife".
    expect(idsFor('flight for my wife to join me')).not.toContain('§3.6')
  })
})

describe('buildRetrievalQuery', () => {
  const claim = {
    name: 'Dinner in Hawaii with Mr Nitin',
    amount: 10000,
    department: 'Finance',
    expenseType: 'Client entertainment',
    hasReceipt: false,
  }

  it('retrieves the receipt clause that the form\'s own words miss', () => {
    // Regression from the first live check: the plain query found §4.2 and
    // §2.1 but never §1.3, because a form never contains the word "receipt".
    const plain = `${claim.name} ${claim.expenseType} ${claim.department} ${claim.amount} dollars`
    const plainIds = retrieveClauses(POLICY_CLAUSES, plain, 6).map((e) => e.clause.id)
    expect(plainIds).not.toContain('§1.3')

    const expandedIds = retrieveClauses(
      POLICY_CLAUSES,
      buildRetrievalQuery(claim),
      6,
    ).map((e) => e.clause.id)
    expect(expandedIds).toContain('§1.3')
  })

  it('still retrieves the clause the form does name', () => {
    // Expansion must not crowd out the obvious match.
    const ids = retrieveClauses(POLICY_CLAUSES, buildRetrievalQuery(claim), 6)
      .map((e) => e.clause.id)
    expect(ids).toContain('§4.2')
  })

  it('brings in the pre-approval clause for a large commitment', () => {
    const ids = retrieveClauses(
      POLICY_CLAUSES,
      buildRetrievalQuery({ ...claim, amount: 8000 }),
      8,
    ).map((e) => e.clause.id)
    expect(ids).toContain('§2.4')
  })

  it('does not ask about missing receipts when one is attached', () => {
    expect(buildRetrievalQuery({ ...claim, hasReceipt: true })).toContain('receipt attached')
    expect(buildRetrievalQuery({ ...claim, hasReceipt: true })).not.toContain('missing')
  })
})
