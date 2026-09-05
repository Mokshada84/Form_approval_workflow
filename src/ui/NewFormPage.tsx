// ui/NewFormPage.tsx
//
// The "new form" screen, available to every role.
//
// The form number isn't typed by anyone — it's generated when the form is
// saved (see createDraft in domain/workflow.ts), which is why there's no field
// for it here.

import { useState } from 'react'
import type { ChangeEvent } from 'react'
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
