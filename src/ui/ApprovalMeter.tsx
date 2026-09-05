// ui/ApprovalMeter.tsx
//
// A small bar showing how far through its approvals a form has got.
//
// The unfilled part of the track is a much lighter step of the SAME blue as
// the fill, rather than a grey. Keeping one hue across the whole bar is what
// makes it read as one measure at a glance instead of two separate blocks.

import { countDecided } from '../domain/workflow'
import type { FormRequest } from '../domain/types'

/** How many stages have been decided, and that as a percentage. */
function approvalProgress(form: FormRequest) {
  const total = form.stages.length
  const decided = countDecided(form)
  return { decided, total, percent: total === 0 ? 0 : (decided / total) * 100 }
}

export function ApprovalMeter({ form }: { form: FormRequest }) {
  const { decided, total, percent } = approvalProgress(form)

  // A draft has no stages yet, so there's nothing to measure.
  if (total === 0) return null

  const isRejected = form.stages.some((stage) => stage.decision === 'rejected')

  return (
    <div className="meter-row">
      {/* role="progressbar" plus the aria-* attributes are how this is
          announced to a screen reader — without them it's a silent <div>. */}
      <div
        className={`meter${isRejected ? ' meter-rejected' : ''}`}
        role="progressbar"
        aria-valuenow={decided}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${decided} of ${total} approval stages decided`}
      >
        <div className="meter-fill" style={{ width: `${percent}%` }} />
      </div>

      <span className="meter-label">
        {decided} of {total} decided
      </span>
    </div>
  )
}
