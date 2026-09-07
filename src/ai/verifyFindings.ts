// ai/verifyFindings.ts
//
// PHASE 4. The grounding check — the part that makes a citation mean something.
//
// A model asked to cite a source will cite a source. Whether that source
// exists is a separate question, and "§4.7" looks exactly as authoritative as
// "§4.2" to anyone reading quickly. This resolves every cited id against the
// real corpus and drops what doesn't resolve.
//
// It also attaches the clause TEXT from the corpus rather than letting the
// model quote it. A model paraphrasing a rule it is being judged against is
// how "up to $150 per head" quietly becomes "around $150 per person" — the
// approver reads the paraphrase, not the policy.
//
// Pure, so the whole thing is tested without an API call.

import { findClause } from '../policy/clauses'
import type { PolicyClause } from '../policy/clauses'
import type { PolicyCheck, VerifiedFinding, VerifiedPolicyCheck } from './policySchema'

/**
 * `clauses` is passed in rather than imported from a module-level constant:
 * the corpus is a file the server loads, and keeping it an argument is what
 * lets this run in a test against any document — including a two-clause
 * fixture — without touching the filesystem.
 */
export function verifyFindings(check: PolicyCheck, clauses: PolicyClause[]): VerifiedPolicyCheck {
  const findings: VerifiedFinding[] = []
  const droppedCitations: string[] = []

  for (const finding of check.findings) {
    const clause = findClause(clauses, finding.clauseId.trim())
    if (clause === undefined) {
      droppedCitations.push(finding.clauseId)
      continue
    }

    findings.push({
      ...finding,
      clauseId: clause.id,
      clauseTitle: clause.title,
      // From the corpus, never from the model.
      clauseText: clause.text,
    })
  }

  return {
    // Violations first, then unclear, then compliant: an approver scanning a
    // list needs the problems at the top, not in citation order.
    findings: findings.sort((a, b) => rank(a.verdict) - rank(b.verdict)),
    summary: check.summary,
    droppedCitations,
  }
}

function rank(verdict: VerifiedFinding['verdict']): number {
  if (verdict === 'violation') return 0
  if (verdict === 'unclear') return 1
  return 2
}
