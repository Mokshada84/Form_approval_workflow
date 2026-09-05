// domain/workflow.test.ts
//
// Tests for the approval rules. These are pure functions, so the tests are
// plain function calls — no React, no rendering, no browser. That's the payoff
// for keeping the rules out of the components.

import { describe, expect, it } from 'vitest'
import {
  buildStages,
  canDecide,
  createDraft,
  decide,
  decisionsBy,
  formatFormNumber,
  formsAwaiting,
  getActiveStage,
  getStatus,
  submitForm,
} from './workflow'
import type { User } from './types'

const employee: User = { id: 'emp-1', name: 'Dan Okafor', email: 'd@x.com', role: 'Employee' }
const manager: User = { id: 'mgr-1', name: 'Priya Sharma', email: 'p@x.com', role: 'Manager' }
const otherManager: User = { id: 'mgr-2', name: 'Tom Becker', email: 't@x.com', role: 'Manager' }
const senior: User = { id: 'snr-1', name: 'Mei Tan', email: 'm@x.com', role: 'Senior Manager' }
const otherSenior: User = { id: 'snr-2', name: 'Alex Reid', email: 'a@x.com', role: 'Senior Manager' }

/** A submitted form for the given amount, raised by the given person. */
function submitted(amount: number, by: User = employee) {
  return submitForm(createDraft({ name: 'Laptop replacement', amount }, by, 1))
}

describe('form numbers', () => {
  it('pads the sequence to four digits', () => {
    expect(formatFormNumber(1)).toBe('FORM-0001')
    expect(formatFormNumber(42)).toBe('FORM-0042')
    expect(formatFormNumber(1234)).toBe('FORM-1234')
  })
})

describe('routing by amount', () => {
  it('sends anything up to $1000 to the Manager only', () => {
    expect(buildStages(50).map((s) => s.role)).toEqual(['Manager'])
    expect(buildStages(500).map((s) => s.role)).toEqual(['Manager'])
    // Exactly $1000 is NOT above the threshold, so it stays Manager-only.
    expect(buildStages(1000).map((s) => s.role)).toEqual(['Manager'])
  })

  it('sends anything above $1000 to the Manager and then a Senior Manager', () => {
    expect(buildStages(1000.01).map((s) => s.role)).toEqual(['Manager', 'Senior Manager'])
    expect(buildStages(5000).map((s) => s.role)).toEqual(['Manager', 'Senior Manager'])
  })
})

describe('status', () => {
  it('is Draft until the form is submitted', () => {
    const draft = createDraft({ name: 'Laptop', amount: 500 }, employee, 1)

    expect(getStatus(draft)).toBe('Draft')
    // A draft has no approval stages: routing happens at submission.
    expect(draft.stages).toEqual([])
  })

  it('becomes Under review once submitted', () => {
    expect(getStatus(submitted(500))).toBe('Under review')
  })

  it('is Approved once every required stage has approved', () => {
    let form = submitted(500)
    form = decide(form, manager, 'approved')

    expect(getStatus(form)).toBe('Approved')
  })

  it('stays Under review after the Manager approves a high-value form', () => {
    let form = submitted(5000)
    form = decide(form, manager, 'approved')

    expect(getStatus(form)).toBe('Under review')
    expect(getActiveStage(form)?.role).toBe('Senior Manager')
  })

  it('is Approved once both stages approve a high-value form', () => {
    let form = submitted(5000)
    form = decide(form, manager, 'approved')
    form = decide(form, senior, 'approved')

    expect(getStatus(form)).toBe('Approved')
  })

  it('is Rejected as soon as any stage rejects', () => {
    let form = submitted(5000)
    form = decide(form, manager, 'rejected')

    expect(getStatus(form)).toBe('Rejected')
    // The Senior Manager stage is never reached.
    expect(getActiveStage(form)).toBeNull()
    expect(form.stages[1].decision).toBe('pending')
  })
})

describe('approval is sequential', () => {
  it('waits for the Manager before the Senior Manager can act', () => {
    const form = submitted(5000)

    expect(getActiveStage(form)?.role).toBe('Manager')
    expect(canDecide(form, senior)).toBe(false)
  })

  it('ignores a Senior Manager trying to decide first', () => {
    const form = submitted(5000)
    const after = decide(form, senior, 'approved')

    expect(after).toEqual(form)
  })

  it('lets the Senior Manager act only after the Manager has approved', () => {
    let form = submitted(5000)
    form = decide(form, manager, 'approved')

    expect(canDecide(form, senior)).toBe(true)
  })
})

describe('nobody approves their own form', () => {
  it('blocks a Manager from approving the form they submitted', () => {
    const form = submitted(500, manager)

    expect(canDecide(form, manager)).toBe(false)
    // A different Manager can, though — that's what keeps the form moving.
    expect(canDecide(form, otherManager)).toBe(true)
  })

  it('ignores the decision even if it is attempted anyway', () => {
    const form = submitted(500, manager)
    const after = decide(form, manager, 'approved')

    expect(after).toEqual(form)
    expect(getStatus(after)).toBe('Under review')
  })

  it('blocks a Senior Manager from approving their own high-value form', () => {
    let form = submitted(5000, senior)
    // The Manager stage is unaffected — the submitter is a Senior Manager.
    form = decide(form, manager, 'approved')

    expect(canDecide(form, senior)).toBe(false)
    expect(canDecide(form, otherSenior)).toBe(true)
  })

  it('blocks an Employee from deciding anything', () => {
    const form = submitted(500)

    // An Employee holds no approving role, so no stage ever matches.
    expect(canDecide(form, employee)).toBe(false)
  })
})

describe('decide', () => {
  it('records who decided and when', () => {
    const form = submitted(500)
    const when = new Date('2026-09-06T10:30:00.000Z')
    const after = decide(form, manager, 'approved', when)

    expect(after.stages[0].decidedById).toBe('mgr-1')
    expect(after.stages[0].decidedByName).toBe('Priya Sharma')
    expect(after.stages[0].decidedAt).toBe('2026-09-06T10:30:00.000Z')
  })

  it('does not modify the form it was given', () => {
    const form = submitted(500)
    decide(form, manager, 'approved')

    // The original must be untouched — React relies on this to spot changes.
    expect(form.stages[0].decision).toBe('pending')
  })
})

describe('submitForm', () => {
  it('refuses to re-submit an already submitted form', () => {
    let form = submitted(500)
    form = decide(form, manager, 'approved')

    // Re-submitting must not wipe the approval that has already happened.
    expect(submitForm(form)).toEqual(form)
  })
})

describe('queues and history', () => {
  it('shows a form only in the queue of someone who can act on it', () => {
    const low = submitted(500)
    const high = submitted(5000)
    const forms = [low, high]

    // Both are at the Manager stage, so both sit with the Manager.
    expect(formsAwaiting(forms, manager)).toHaveLength(2)
    // Neither has reached the Senior Manager yet.
    expect(formsAwaiting(forms, senior)).toHaveLength(0)
    expect(formsAwaiting(forms, employee)).toHaveLength(0)
  })

  it('lists every decision a person has personally made', () => {
    let high = submitted(5000)
    high = decide(high, manager, 'approved')
    high = decide(high, senior, 'rejected')

    const managerHistory = decisionsBy([high], manager)
    expect(managerHistory).toHaveLength(1)
    expect(managerHistory[0].stage.decision).toBe('approved')

    const seniorHistory = decisionsBy([high], senior)
    expect(seniorHistory).toHaveLength(1)
    expect(seniorHistory[0].stage.decision).toBe('rejected')

    // Someone who decided nothing has an empty history.
    expect(decisionsBy([high], otherManager)).toHaveLength(0)
  })
})
