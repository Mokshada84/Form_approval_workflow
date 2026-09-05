// domain/workflow.ts
//
// Every rule of the approval process, written as PURE FUNCTIONS: same input,
// same output, every time; nothing outside is read or changed. That makes them
// the easiest code in the app to test and the hardest to get wrong, so as much
// of the thinking as possible is pushed down here rather than into components.

import type {
  ApprovalStage,
  ApproverRole,
  FormRequest,
  FormStatus,
  NewFormInput,
  User,
} from './types'

/**
 * Forms above this amount need a second signature.
 *
 * Up to and including $1000: Manager only.
 * Above $1000: Manager, and then Senior Manager.
 */
export const SENIOR_APPROVAL_THRESHOLD = 1000

/** Format a whole number as a form number, e.g. 7 -> "FORM-0007". */
export function formatFormNumber(sequence: number): string {
  // padStart pads the front with zeros so numbers line up when listed.
  return `FORM-${String(sequence).padStart(4, '0')}`
}

/** A fresh, undecided stage for the given role. */
function pendingStage(role: ApproverRole): ApprovalStage {
  return { role, decision: 'pending', decidedById: null, decidedByName: null, decidedAt: null }
}

/**
 * Work out which approvals a form needs, from its amount. This is the routing
 * rule, and it lives in exactly one place.
 */
export function buildStages(amount: number): ApprovalStage[] {
  const stages: ApprovalStage[] = [pendingStage('Manager')]
  if (amount > SENIOR_APPROVAL_THRESHOLD) {
    stages.push(pendingStage('Senior Manager'))
  }
  return stages
}

/**
 * Create a form as a DRAFT: it has a number and details, but no approval
 * stages yet, because nothing has been submitted for approval.
 *
 * `now` is a parameter rather than being read from the clock inside, so a test
 * can pin it to a fixed date and get a predictable result.
 */
export function createDraft(
  input: NewFormInput,
  submitter: User,
  sequence: number,
  now: Date = new Date(),
): FormRequest {
  return {
    id: crypto.randomUUID(),
    number: formatFormNumber(sequence),
    name: input.name,
    amount: input.amount,
    submitterId: submitter.id,
    submitterName: submitter.name,
    createdAt: now.toISOString(),
    submittedAt: null,
    stages: [],
  }
}

/**
 * Submit a draft: stamp the time and work out the approval chain it needs.
 *
 * A form that has already been submitted comes back unchanged, so submitting
 * twice can't reset decisions that have already been made.
 */
export function submitForm(form: FormRequest, now: Date = new Date()): FormRequest {
  if (form.submittedAt !== null) return form

  return {
    ...form,
    submittedAt: now.toISOString(),
    stages: buildStages(form.amount),
  }
}

/**
 * The status shown to the submitter, worked out from the form.
 *
 * The order of these checks IS the rule:
 *   1. Never submitted -> still a Draft.
 *   2. Any rejection sinks the whole form, whichever stage it happened at.
 *   3. Otherwise, every stage approved means the form is Approved.
 *   4. Otherwise it's still going through approval.
 */
export function getStatus(form: FormRequest): FormStatus {
  if (form.submittedAt === null) return 'Draft'
  if (form.stages.some((stage) => stage.decision === 'rejected')) return 'Rejected'
  if (form.stages.every((stage) => stage.decision === 'approved')) return 'Approved'
  return 'Under review'
}

/**
 * The index of the stage waiting on a decision, or -1 if none is.
 *
 * It's always the FIRST pending stage, which is what makes approval
 * sequential: Senior Manager can't sign off before Manager has.
 */
export function getActiveStageIndex(form: FormRequest): number {
  const status = getStatus(form)
  if (status !== 'Under review') return -1
  return form.stages.findIndex((stage) => stage.decision === 'pending')
}

/** The stage awaiting a decision, or null. */
export function getActiveStage(form: FormRequest): ApprovalStage | null {
  const index = getActiveStageIndex(form)
  return index === -1 ? null : form.stages[index]
}

/**
 * Can this user decide on this form right now?
 *
 * Three things must all hold:
 *   1. Some stage is actually waiting for a decision.
 *   2. The user holds the role that stage calls for.
 *   3. The user is NOT the person who submitted it — nobody approves their own
 *      form, so a different holder of that role has to.
 */
export function canDecide(form: FormRequest, user: User): boolean {
  const stage = getActiveStage(form)
  if (stage === null) return false
  if (stage.role !== user.role) return false
  if (form.submitterId === user.id) return false
  return true
}

/**
 * Record an approve or reject against the active stage.
 *
 * Returns a NEW form; the one passed in is untouched. Anything not allowed by
 * canDecide is ignored and the form comes back unchanged — the rule is enforced
 * here, not merely by hiding buttons, so it holds however this is called.
 */
export function decide(
  form: FormRequest,
  user: User,
  decision: 'approved' | 'rejected',
  now: Date = new Date(),
): FormRequest {
  if (!canDecide(form, user)) return form

  const activeIndex = getActiveStageIndex(form)

  return {
    ...form,
    stages: form.stages.map((stage, index) =>
      index === activeIndex
        ? {
            ...stage,
            decision,
            decidedById: user.id,
            decidedByName: user.name,
            decidedAt: now.toISOString(),
          }
        : stage,
    ),
  }
}

/**
 * How many approval stages have been decided, for the progress bar. A draft
 * has no stages, so this is 0.
 */
export function countDecided(form: FormRequest): number {
  return form.stages.filter((stage) => stage.decision !== 'pending').length
}

/** Forms this user submitted, for their own "My forms" page. */
export function formsSubmittedBy(forms: FormRequest[], user: User): FormRequest[] {
  return forms.filter((form) => form.submitterId === user.id)
}

/** Forms sitting in this user's approval queue right now. */
export function formsAwaiting(forms: FormRequest[], user: User): FormRequest[] {
  return forms.filter((form) => canDecide(form, user))
}

/**
 * Every decision this user has personally made, newest first — the history
 * shown on an approver's page.
 *
 * A stage records who decided it, so this reads back the user's own id rather
 * than assuming anything about which role handled which form.
 */
export function decisionsBy(
  forms: FormRequest[],
  user: User,
): { form: FormRequest; stage: ApprovalStage }[] {
  const decisions = forms.flatMap((form) =>
    form.stages
      .filter((stage) => stage.decidedById === user.id)
      .map((stage) => ({ form, stage })),
  )

  // Sort newest first. decidedAt is always set on a decided stage, but the ?? ''
  // keeps TypeScript happy about the null case.
  return decisions.sort((a, b) => (b.stage.decidedAt ?? '').localeCompare(a.stage.decidedAt ?? ''))
}
