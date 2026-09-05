// ui/StageList.tsx
//
// The approval trail for one form, as a small vertical timeline: which roles
// have to sign off, in order, and where it has got to.
//
// Each marker carries a SHAPE as well as a colour — a tick for approved, a
// cross for rejected. Approved-green and rejected-red are near-identical to
// anyone with red/green colour blindness, so a coloured dot alone would be
// unreadable for them. See StatusIcon.tsx.

import { getActiveStageIndex } from '../domain/workflow'
import type { FormRequest, StageDecision } from '../domain/types'

/** The glyph inside a marker. Empty for stages nobody has reached yet. */
function markerGlyph(decision: StageDecision, isActive: boolean) {
  if (decision === 'approved') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.5l3 3L12.5 5" />
      </svg>
    )
  }
  if (decision === 'rejected') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
      </svg>
    )
  }
  if (isActive) {
    // A clock, matching the "Under review" status icon.
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 4.5v3.7l2.2 1.5" />
      </svg>
    )
  }
  return null
}

export function StageList({ form }: { form: FormRequest }) {
  // A draft hasn't been routed anywhere yet, so there is no trail to show.
  if (form.stages.length === 0) {
    return <p className="stages-empty">Not submitted yet — no approvals required so far.</p>
  }

  const activeIndex = getActiveStageIndex(form)

  return (
    <ol className="stages">
      {form.stages.map((stage, index) => {
        const isActive = index === activeIndex
        // Anything after the active stage can't be reached yet. When
        // activeIndex is -1 (finished or rejected) nothing is upcoming.
        const isUpcoming = activeIndex !== -1 && index > activeIndex

        return (
          <li
            key={stage.role}
            className={`stage stage-${stage.decision}${isActive ? ' stage-active' : ''}${
              isUpcoming ? ' stage-upcoming' : ''
            }`}
          >
            <span className="stage-marker" aria-hidden="true">
              {markerGlyph(stage.decision, isActive)}
            </span>

            <span className="stage-role">{stage.role}</span>

            <span className="stage-decision">
              {stage.decision === 'pending'
                ? isActive
                  ? 'Awaiting decision'
                  : 'Not yet reached'
                : `${stage.decision === 'approved' ? 'Approved' : 'Rejected'} by ${stage.decidedByName}`}
              {stage.rejectionComment && <span className="rejection-comment">Comment: {stage.rejectionComment}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
