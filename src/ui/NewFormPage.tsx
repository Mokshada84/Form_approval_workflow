// ui/NewFormPage.tsx
//
// The "new form" screen, available to every role.
//
// The form number isn't typed by anyone — it's generated when the form is
// saved (see createDraft in domain/workflow.ts), which is why there's no field
// for it here.

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useFormExtraction } from '../ai/useFormExtraction'
import { DEPARTMENTS } from '../data/users'
import { EXPENSE_CATEGORIES } from '../data/expenseCategories'
import type { Department, ReceiptAttachment } from '../domain/types'
import { SENIOR_APPROVAL_THRESHOLD } from '../domain/workflow'
import { useApp } from '../state/useApp'

export function NewFormPage() {
  const { currentUser, dispatch } = useApp()
  const [name, setName] = useState('')
  // The amount is kept as a STRING while typing. Numbers in state would make
  // an empty box impossible to represent, and half-typed values like "12." turn
  // into NaN. It's converted to a number only when the form is submitted.
  const [amount, setAmount] = useState('')
  const [department, setDepartment] = useState<Department>(currentUser?.department ?? 'Finance')
  const [expenseType, setExpenseType] = useState(EXPENSE_CATEGORIES[currentUser?.department ?? 'Finance'][0])
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  // PHASE 1b. What's typed in the assistant's reply box right now. The
  // conversation itself lives in the hook, not here.
  const [reply, setReply] = useState('')
  const extraction = useFormExtraction()

  if (currentUser === null) return null
  const signedInUser = currentUser

  /**
   * Shared by both buttons. Returns the cleaned-up values, or null if
   * something is wrong (having already shown the error).
   */
  function validate(): { name: string; amount: number; department: Department; expenseType: string; receipt: ReceiptAttachment | null } | null {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setError('Give the form a name.')
      return null
    }

    // Number('') is 0 and Number('abc') is NaN, so both are checked.
    const parsedAmount = Number(amount)
    if (amount.trim() === '' || Number.isNaN(parsedAmount)) {
      setError('Enter the amount as a number.')
      return null
    }
    if (parsedAmount <= 0) {
      setError('The amount must be more than zero.')
      return null
    }

    return { name: trimmedName, amount: parsedAmount, department, expenseType, receipt }
  }

  function handleReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file === undefined) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return
      setReceipt({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result })
    })
    reader.readAsDataURL(file)
  }

  function reset(message: string) {
    setName('')
    setAmount('')
    setDepartment(signedInUser.department)
    setExpenseType(EXPENSE_CATEGORIES[signedInUser.department][0])
    setReceipt(null)
    setError('')
    setConfirmation(message)
    setReply('')
    extraction.reset()
  }

  /**
   * PHASE 1b. Send the next message in the conversation.
   *
   * It FILLS, it does not submit. Everything the assistant establishes lands in
   * the ordinary inputs below, where the person can see it, change it, and
   * decide whether to send it. That is deliberate, and it's the pattern the
   * later phases keep: the AI drafts, a human decides. Nothing here touches
   * the reducer.
   */
  async function handleSend() {
    const result = await extraction.send(reply)
    if (result === null) return

    setReply('')
    setError('')
    setConfirmation('')

    // Fill in whatever is known SO FAR, leaving the rest alone. A null means
    // the person hasn't said yet — and the whole point of this change is that
    // an unknown stays visibly unknown instead of being guessed at. So a null
    // never overwrites; it just leaves the field as it was.
    if (result.name !== null) setName(result.name)
    if (result.amount !== null) setAmount(String(result.amount))
    if (result.department !== null) setDepartment(result.department)
    if (result.expenseType !== null) setExpenseType(result.expenseType)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Without this the browser reloads the page on submit, wiping all state.
    event.preventDefault()

    const valid = validate()
    if (valid === null) return

    dispatch({ type: 'form-created-and-submitted', input: valid, user: currentUser! })
    reset('Form submitted for approval.')
  }

  function handleSaveDraft() {
    const valid = validate()
    if (valid === null) return

    dispatch({ type: 'draft-saved', input: valid, user: currentUser! })
    reset('Saved as a draft. Submit it from My forms when you are ready.')
  }

  // Show the routing as the amount is typed, so there's no surprise about who
  // will see the form. Number('') is 0, which correctly shows the shorter route.
  const needsSenior = Number(amount) > SENIOR_APPROVAL_THRESHOLD

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 className="panel-heading">New form</h2>

      {/* PHASE 1b. Optional: describe the expense and answer the assistant's
          questions until all four fields are known. It fills the fields below,
          which stay editable — submitting is still your click. */}
      <div className="assist">
        {/* The transcript. `role="log"` tells a screen reader that new entries
            appear at the end, so each answer is announced as it arrives. */}
        {extraction.messages.length > 0 && (
          <ol className="assist-log" role="log">
            {extraction.messages.map((message, index) => (
              <li
                key={index}
                className={`assist-turn assist-turn-${message.role}`}
              >
                <span className="assist-who">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </span>
                {message.content}
              </li>
            ))}
          </ol>
        )}

        <div className="field">
          <label htmlFor="form-description">
            {extraction.messages.length === 0
              ? 'Describe it instead (optional)'
              : 'Your answer'}
          </label>
          <textarea
            id="form-description"
            rows={extraction.messages.length === 0 ? 3 : 2}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={
              extraction.messages.length === 0
                ? 'e.g. Dinner in Hawaii with Mr. Nitin, $10000'
                : 'Answer the question above'
            }
          />
          <span className="field-hint">
            It records only what you tell it. Anything you leave out, it asks
            about rather than guessing.
          </span>
        </div>

        <div className="assist-actions">
          <button
            type="button"
            className="btn btn-small"
            // Disabled while in flight, so an impatient second click can't
            // fire a second paid request.
            disabled={extraction.pending || reply.trim() === ''}
            onClick={() => void handleSend()}
          >
            {extraction.pending
              ? 'Thinking…'
              : extraction.messages.length === 0
                ? 'Start'
                : 'Send answer'}
          </button>

          {extraction.messages.length > 0 && (
            <button
              type="button"
              className="btn btn-small"
              disabled={extraction.pending}
              onClick={() => {
                extraction.reset()
                setReply('')
              }}
            >
              Start over
            </button>
          )}
        </div>

        {extraction.error && (
          <p className="error" role="alert">
            {extraction.error}
          </p>
        )}

        {/* Everything known: say so plainly, so it's clear the questions have
            stopped on purpose rather than the assistant having given up. */}
        {extraction.turn !== null && extraction.turn.question === null && (
          <p className="assist-done" role="status">
            All four fields are filled in below. Check them and submit.
          </p>
        )}

        {extraction.turn?.notes && (
          <p className="assist-note">Still unknown: {extraction.turn.notes}</p>
        )}
      </div>

      {/* Pairing <label htmlFor> with an input id means clicking the label
          focuses the field, and screen readers announce the two together. */}
      <div className="field">
        <label htmlFor="form-name">Name of the form</label>
        <input
          id="form-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Laptop replacement"
        />
      </div>

      <div className="field">
        <label htmlFor="form-department">Department</label>
        <select
          id="form-department"
          value={department}
          onChange={(event) => setDepartment(event.target.value as Department)}
        >
          {DEPARTMENTS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="form-expense-type">Expense type</label>
        <select
          id="form-expense-type"
          value={expenseType}
          onChange={(event) => setExpenseType(event.target.value)}
        >
          {EXPENSE_CATEGORIES[department].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="form-receipt">Receipt attachment (optional)</label>
        <input id="form-receipt" type="file" accept="image/*,.pdf" onChange={handleReceipt} />
        {receipt && <span className="field-hint">Attached: {receipt.name}</span>}
      </div>

      <div className="field">
        <label htmlFor="form-amount">Amount (USD)</label>
        <input
          id="form-amount"
          // type="number" gives phones a numeric keypad and blocks stray letters.
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="e.g. 750"
        />
      </div>

      <p className="routing-hint">
        {needsSenior ? (
          <>
            Above ${SENIOR_APPROVAL_THRESHOLD.toLocaleString()} — this needs your{' '}
            <strong>Manager</strong> and then a <strong>Senior Manager</strong>.
          </>
        ) : (
          <>
            Up to ${SENIOR_APPROVAL_THRESHOLD.toLocaleString()} — this needs a{' '}
            <strong>Manager</strong> only.
          </>
        )}
      </p>

      {/* An empty string is falsy, so nothing renders until there's a message.
          role="alert" makes screen readers announce it straight away. */}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {confirmation && (
        <p className="confirmation" role="status">
          {confirmation}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Submit for approval
        </button>
        <button type="button" className="btn" onClick={handleSaveDraft}>
          Save as draft
        </button>
      </div>
    </form>
  )
}
