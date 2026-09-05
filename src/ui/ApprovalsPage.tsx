// ui/ApprovalsPage.tsx
//
// The approver's screen, shown only to Managers and Senior Managers.
//
// Two sections:
//   1. Awaiting your decision — forms this person can act on right now.
//   2. Your decisions — everything they have personally approved or rejected.

import { decisionsBy, formsAwaiting } from '../domain/workflow'
import { useApp } from '../state/useApp'
import { FormCard } from './FormCard'
import { formatAmount } from './format'
import { StatTiles } from './StatTiles'
import { StatusBadge } from './StatusBadge'
import { getStatus } from '../domain/workflow'

export function ApprovalsPage() {
  const { currentUser, forms, dispatch } = useApp()
  if (currentUser === null) return null

  // Both lists come from the domain layer. formsAwaiting uses canDecide, which
  // is what excludes this person's own forms — nobody approves their own.
  const awaiting = formsAwaiting(forms, currentUser)
  const decisions = decisionsBy(forms, currentUser)

  // How many of this person's own decisions went each way.
  const approvedCount = decisions.filter((d) => d.stage.decision === 'approved').length
  const rejectedCount = decisions.filter((d) => d.stage.decision === 'rejected').length

  return (
    <div className="stack">
      <StatTiles
        tiles={[
          { label: 'Awaiting you', value: awaiting.length, status: 'Under review' },
          { label: 'You approved', value: approvedCount, status: 'Approved' },
          { label: 'You rejected', value: rejectedCount, status: 'Rejected' },
        ]}
      />

      <section>
        <h2 className="section-heading">
          Awaiting your decision <span className="count">{awaiting.length}</span>
        </h2>

        {awaiting.length === 0 ? (
          <p className="empty">Nothing is waiting on you right now.</p>
        ) : (
          <div className="stack">
            {awaiting.map((form) => (
              <FormCard key={form.id} form={form} showSubmitter>
                <button
                  type="button"
                  className="btn btn-approve btn-small"
                  onClick={() =>
                    dispatch({
                      type: 'decided',
                      formId: form.id,
                      user: currentUser,
                      decision: 'approved',
                    })
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() =>
                    dispatch({
                      type: 'decided',
                      formId: form.id,
                      user: currentUser,
                      decision: 'rejected',
                    })
                  }
                >
                  Reject
                </button>
              </FormCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-heading">
          Your decisions <span className="count">{decisions.length}</span>
        </h2>

        {decisions.length === 0 ? (
          <p className="empty">You haven&apos;t approved or rejected anything yet.</p>
        ) : (
          // A compact table rather than full cards: this is a history to scan,
          // not a queue to act on.
          <div className="table-wrap">
            <table className="decisions">
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Name</th>
                  <th>Amount</th>
                  <th>Submitted by</th>
                  <th>Your decision</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map(({ form, stage }) => (
                  // A form could in principle appear twice if one person held
                  // both stages, so the key combines the form and the role.
                  <tr key={`${form.id}-${stage.role}`}>
                    <td className="mono">{form.number}</td>
                    <td>{form.name}</td>
                    <td className="numeric">{formatAmount(form.amount)}</td>
                    <td>{form.submitterName}</td>
                    <td>
                      <span className={`decision-tag decision-${stage.decision}`}>
                        {stage.decision === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </td>
                    {/* Your decision isn't always the final outcome: you can
                        approve a form that a Senior Manager later rejects. */}
                    <td>
                      <StatusBadge status={getStatus(form)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
