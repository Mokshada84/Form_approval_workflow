// ui/PolicyCheckPanel.tsx
//
// PHASE 4. The policy check on one form in the approvals queue.
//
// It ADVISES. Nothing here approves, rejects or dispatches anything — the
// Approve and Reject buttons are the approver's, and `canDecide()` still gates
// them. That separation is the whole point: a compliance opinion belongs next
// to the decision, not inside it.
//
// This file exports only a component, because oxlint's only-export-components
// rule fails a file that exports a component alongside a plain function — the
// hook lives in ai/usePolicyCheck.ts for that reason.

import { usePolicyCheck } from '../ai/usePolicyCheck'
import type { FormRequest } from '../domain/types'
import type { VerifiedFinding } from '../ai/policySchema'

/** Icon + word, so a verdict never depends on colour to be read. */
const VERDICT_GLYPH: Record<VerifiedFinding['verdict'], string> = {
  violation: '✕',
  unclear: '?',
  compliant: '✓',
}

const VERDICT_LABEL: Record<VerifiedFinding['verdict'], string> = {
  violation: 'Breaches',
  unclear: 'Can’t tell',
  compliant: 'Meets',
}

export function PolicyCheckPanel({ form }: { form: FormRequest }) {
  const { result, pending, error, run } = usePolicyCheck()

  return (
    <div className="policy">
      <button
        type="button"
        className="btn btn-small"
        disabled={pending}
        onClick={() => void run(form)}
      >
        {pending ? 'Checking policy…' : result === null ? 'Check against policy' : 'Check again'}
      </button>

      {error && (
        <p className="error policy-error" role="alert">
          {error}
        </p>
      )}

      {result !== null && (
        <div className="policy-result" role="status">
          <p className="policy-summary">{result.check.summary}</p>

          {result.check.findings.length === 0 ? (
            <p className="policy-empty">Nothing to flag against the clauses that were found.</p>
          ) : (
            <ul className="policy-findings">
              {result.check.findings.map((finding) => (
                <li key={finding.clauseId} className={`policy-finding verdict-${finding.verdict}`}>
                  <p className="policy-finding-head">
                    <span className="policy-verdict">
                      <span aria-hidden="true">{VERDICT_GLYPH[finding.verdict]}</span>{' '}
                      {VERDICT_LABEL[finding.verdict]}
                    </span>
                    <span className="policy-clause-id">{finding.clauseId}</span>
                    <span className="policy-clause-title">{finding.clauseTitle}</span>
                  </p>
                  <p className="policy-explanation">{finding.explanation}</p>
                  {/* The clause text comes from the policy document itself,
                      never from the model — a paraphrased rule is how
                      "$150 per head" becomes "around $150 per person". */}
                  <blockquote className="policy-quote">{finding.clauseText}</blockquote>
                </li>
              ))}
            </ul>
          )}

          {/* Which clauses were searched up, so a thin answer reads as a thin
              SEARCH rather than as "the policy has nothing to say". */}
          <p className="policy-provenance">
            Checked against {result.retrievedClauseIds.length} retrieved{' '}
            {result.retrievedClauseIds.length === 1 ? 'clause' : 'clauses'}:{' '}
            {result.retrievedClauseIds.join(', ') || 'none'}. Advisory only — the decision is yours.
          </p>

          {result.check.droppedCitations.length > 0 && (
            <p className="policy-dropped">
              Discarded {result.check.droppedCitations.length} citation(s) to clauses that do not
              exist: {result.check.droppedCitations.join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
