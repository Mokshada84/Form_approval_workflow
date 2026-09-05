import { formsForAudit, getStatus, pendingHours } from '../domain/workflow'
import { useApp } from '../state/useApp'
import { formatAmount, formatDate } from './format'

export function AuditPage() {
  const { currentUser, forms } = useApp()
  if (currentUser === null || currentUser.role !== 'Senior Manager') return null

  const auditedForms = formsForAudit(forms, currentUser)

  return (
    <section>
      <h2 className="section-heading">Audit trail <span className="count">{auditedForms.length}</span></h2>
      {auditedForms.length === 0 ? (
        <p className="empty">No forms have been raised yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="decisions audit-table">
            <thead>
              <tr>
                <th>Form</th><th>Department</th><th>Expense type</th><th>Amount</th><th>Status</th><th>Submitted</th><th>Approval trail</th><th>Pending time</th>
              </tr>
            </thead>
            <tbody>
              {auditedForms.map((form) => (
                <tr key={form.id}>
                  <td className="mono">{form.number}<br />{form.name}</td>
                  <td>{form.department}</td>
                  <td>{form.expenseType}</td>
                  <td className="numeric">{formatAmount(form.amount)}</td>
                  <td>{getStatus(form)}</td>
                  <td>{form.submittedAt ? formatDate(form.submittedAt) : 'Draft'}</td>
                  <td>
                    {form.stages.length === 0 ? 'Not submitted' : form.stages.map((stage) => (
                      <div key={stage.role}>
                        {stage.role}: {stage.decision === 'pending' ? 'Pending' : `${stage.decision} by ${stage.decidedByName} on ${formatDate(stage.decidedAt!)}`}
                        {stage.rejectionComment && ` - ${stage.rejectionComment}`}
                      </div>
                    ))}
                  </td>
                  <td>{pendingHours(form) === null ? '—' : `${pendingHours(form)} hour(s)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}