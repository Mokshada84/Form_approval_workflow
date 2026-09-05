// ui/StatusBadge.tsx
//
// The status label. Three channels carry the meaning — icon, text and colour —
// so that losing any one of them still leaves the status readable. See the
// note in StatusIcon.tsx for why that matters.

import { StatusIcon } from './StatusIcon'
import type { FormStatus } from '../domain/types'

export function StatusBadge({ status }: { status: FormStatus }) {
  return (
    // "Under review" contains a space, which isn't valid inside a class name,
    // so it becomes "status-Under-review".
    <span className={`status-badge status-${status.replace(' ', '-')}`}>
      <StatusIcon status={status} />
      {/* The label is its own element so the icon can't end up glued to the
          text when it's read out or copied. */}
      <span className="status-label">{status}</span>
    </span>
  )
}
