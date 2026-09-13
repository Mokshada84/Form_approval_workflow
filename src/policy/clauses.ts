// policy/clauses.ts
//
// PHASE 4. CHUNKING — turning one document into retrievable pieces.
//
// The document itself is `policy/expense-policy.md`, a plain markdown file at
// the root of the repo. It is deliberately NOT code: a policy is written and
// revised by people who don't open an editor, it should be readable in a pull
// request diff, and changing a spending limit shouldn't mean touching
// TypeScript. Everything here works on the text it is given, so it neither
// knows nor cares how that text was loaded — the server reads the file from
// disk, the tests import it with Vite's `?raw`.
//
// Chunking is the step people skip past, and it decides the ceiling on
// everything downstream: retrieval can only ever return a chunk, so a badly
// cut chunk is a wrong answer no amount of clever scoring will rescue.
//
// Two failure modes bound the choice:
//   - Chunks too LARGE: retrieving one drags in three unrelated rules, the
//     model has to pick among them, and you pay for all of it.
//   - Chunks too SMALL: a clause gets split from the condition that qualifies
//     it ("...up to $150 per head" separated from "only where clients are
//     present"), and the model confidently applies half a rule.
//
// A numbered clause is the natural unit here because a human author already
// did the work: §4.2 is exactly the span a person would quote. Fixed-size
// windows with overlap — the usual default — would cut straight through it.

export type PolicyClause = {
  /** The citable identifier, e.g. "§4.2". */
  id: string
  title: string
  /** The clause body, without the heading. */
  text: string
}

/**
 * Split a policy document into clauses on its `## §N.N Title` headings.
 *
 * Anything before the first heading (the document title) is dropped: it is
 * navigation, not a rule, and retrieving it could only ever be noise.
 *
 * Done by splitting rather than by one big regex with a lookahead. The first
 * attempt here ended the match at `(?=^## |\z)` — and `\z` is a Perl/Ruby
 * anchor that JavaScript does not have, so it was matched as a literal "z"
 * and the FINAL clause of the document silently vanished. Splitting has no
 * end-of-input case to get wrong.
 */
export function parsePolicy(markdown: string): PolicyClause[] {
  // slice(1) drops whatever preceded the first heading.
  const sections = markdown.split(/^## (?=§)/m).slice(1)

  return sections.flatMap((section) => {
    const breakAt = section.indexOf('\n')
    const heading = (breakAt === -1 ? section : section.slice(0, breakAt)).trim()
    const text = breakAt === -1 ? '' : section.slice(breakAt + 1).trim()

    const parts = heading.match(/^(§[\d.]+)\s+(.+)$/)
    // A malformed heading, or one with no body, would retrieve as an empty
    // citation — drop both.
    if (parts === null || text === '') return []

    return [{ id: parts[1], title: parts[2].trim(), text }]
  })
}

/**
 * Look one up by its id — used to verify a citation actually exists.
 *
 * Takes the clause list rather than reaching for a module-level constant, so
 * the corpus stays an input rather than a hidden global. That is what lets
 * this module compile in the browser project at all: it never touches the
 * filesystem.
 */
export function findClause(clauses: PolicyClause[], id: string): PolicyClause | undefined {
  return clauses.find((clause) => clause.id === id)
}
