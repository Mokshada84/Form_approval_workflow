// ui/FormCard.tsx
//
// One form, as shown in a list. The buttons along the bottom are passed in by
// whichever page is using it, so the same card serves both "My forms" (submit
// a draft, delete it) and "Approvals" (approve, reject).

import { getStatus } from '../domain/workflow'
import { ApprovalMeter } from './ApprovalMeter'
import { formatAmount, formatDate } from './format'
import { StageList } from './StageList'
import { StatusBadge } from './StatusBadge'
import type { FormRequest } from '../domain/types'

type FormCardProps = {
  form: FormRequest
  /** Whether to name the submitter — useful to an approver, redundant on your own page. */
  showSubmitter?: boolean
  /** Buttons for this context. `children` is whatever is nested inside the tag. */
  children?: React.ReactNode
}

export function FormCard({ form, showSubmitter = false, children }: FormCardProps) {
  const status = getStatus(form)

  return (
    // The second class colours the stripe down the card's left edge, matching
    // the status badge. It repeats what the badge says, in a form you can scan
    // down a long list without reading.
    <article className={`form-card card-${status.replace(' ', '-')}`}>
      <header className="form-card-header">
        <div className="form-card-main">
          <p className="form-number">{form.number}</p>
          <h3 className="form-name">{form.name}</h3>
          <p className="form-meta">
            {showSubmitter && <>Submitted by {form.submitterName} · </>}
            {form.department} · {form.expenseType} ·{' '}
            {form.submittedAt === null
              ? `Created ${formatDate(form.createdAt)}`
              : `Submitted ${formatDate(form.submittedAt)}`}
          </p>
        </div>

        <div className="form-card-right">
          <p className="form-amount">{formatAmount(form.amount)}</p>
          <StatusBadge status={status} />
        </div>
      </header>

      <ApprovalMeter form={form} />
      <StageList form={form} />

      {form.receipt && (
        <div className="receipt">
          <strong>Receipt:</strong>{' '}
          <a href={form.receipt.dataUrl} download={form.receipt.name} target="_blank" rel="noreferrer">
            {form.receipt.name}
          </a>
        </div>
      )}

      {/* Only render the footer if this page actually passed any buttons in. */}
      {children && <footer className="form-card-footer">{children}</footer>}
    </article>
  )
}
