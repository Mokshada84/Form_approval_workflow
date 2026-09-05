// ui/MyFormsPage.tsx
//
// "My forms": everything the signed-in person has raised, and where each one
// has got to. Available to all three roles, since anyone can submit a form.

import { formsSubmittedBy, getStatus } from '../domain/workflow'
import { useApp } from '../state/useApp'
import { FormCard } from './FormCard'
import { StatTiles } from './StatTiles'
import type { FormStatus } from '../domain/types'

export function MyFormsPage() {
  const { currentUser, forms, dispatch } = useApp()
  if (currentUser === null) return null

  const myForms = formsSubmittedBy(forms, currentUser)

  // Count how many of my forms are in each state. Reduce walks the list once
  // and builds up the tally as it goes.
  const counts = myForms.reduce(
    (tally, form) => {
      tally[getStatus(form)] += 1
      return tally
    },
    { Draft: 0, 'Under review': 0, Approved: 0, Rejected: 0 } as Record<FormStatus, number>,
  )

  if (myForms.length === 0) {
    return (
      <p className="empty">
        You haven&apos;t raised any forms yet. Use <strong>New form</strong> to submit one.
      </p>
    )
  }

  return (
    <div className="stack">
      <StatTiles
        tiles={[
          { label: 'Drafts', value: counts.Draft, status: 'Draft' },
          { label: 'Under review', value: counts['Under review'], status: 'Under review' },
          { label: 'Approved', value: counts.Approved, status: 'Approved' },
          { label: 'Rejected', value: counts.Rejected, status: 'Rejected' },
        ]}
      />

      {myForms.map((form) => (
        <FormCard key={form.id} form={form}>
          {/* Drafts are the only forms with anything to do here: send them for
              approval, or throw them away. Once submitted, the submitter just
              watches the status. */}
          {getStatus(form) === 'Draft' && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={() => dispatch({ type: 'draft-submitted', formId: form.id })}
              >
                Submit for approval
              </button>
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={() => dispatch({ type: 'draft-deleted', formId: form.id })}
              >
                Delete draft
              </button>
            </>
          )}
        </FormCard>
      ))}
    </div>
  )
}
