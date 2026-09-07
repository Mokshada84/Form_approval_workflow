// ui/NewFormPage.tsx
//
// The "new form" screen, available to every role.
//
// The form number isn't typed by anyone — it's generated when the form is
// saved (see createDraft in domain/workflow.ts), which is why there's no field
// for it here.

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useFormExtraction } from '../ai/useFormExtraction'
import { DEPARTMENTS } from '../data/users'
import { EXPENSE_CATEGORIES, coerceExpenseType } from '../data/expenseCategories'
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

  // PHASE 1b. What's typed in the composer right now. The conversation itself
  // lives in the hook, not here.
  const [reply, setReply] = useState('')
  const extraction = useFormExtraction()

  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  // Keep the newest message in view. A chat that silently grows below the fold
  // looks like it has stopped responding. Depending on `pending` too means the
  // typing indicator scrolls into view the moment it appears.
  const turnCount = extraction.messages.length
  useEffect(() => {
    const box = scrollRef.current
    if (box !== null) box.scrollTop = box.scrollHeight
  }, [turnCount, extraction.pending])

  // Put the cursor back in the composer once a reply lands, so answering a
  // follow-up question never needs a click. Skipped on the very first render
  // so the page doesn't steal focus from someone who came here to type a name.
  useEffect(() => {
    if (turnCount > 0 && !extraction.pending) composerRef.current?.focus()
  }, [turnCount, extraction.pending])

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
   * FIX. The ONLY way department changes — the dropdown and the assistant both
   * come through here.
   *
   * Expense categories don't overlap between departments, so leaving the old
   * type in place put the form into a state where the <select> displayed one
   * value while a different, stale one was submitted. Coercing keeps the two
   * selects honest, and whatever it picks is visible in the dropdown for the
   * person to change.
   */
  function changeDepartment(next: Department) {
    setDepartment(next)
    setExpenseType((current) => coerceExpenseType(next, current))
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
    const result = await extraction.send(reply, department)
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
    // Department first: it decides which expense types are valid, and
    // changeDepartment resets the type when the two no longer agree.
    if (result.department !== null) changeDepartment(result.department)
    if (result.expenseType !== null) setExpenseType(result.expenseType)
  }

  /**
   * Enter sends; Shift+Enter starts a new line — what every chat does.
   *
   * `preventDefault` matters twice over: without it Enter would insert a
   * newline into the box we're about to clear, and this whole chat sits inside
   * the <form>, so a stray submit is the other thing to keep away from.
   */
  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (extraction.pending || reply.trim() === '') return
    void handleSend()
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

      {/* PHASE 1d. A real chat: bubbles, a composer, Enter to send.
          It fills the fields below, which stay editable — submitting is still
          your click, and the assistant never touches the reducer. */}
      <section className="chat" aria-label="Expense assistant">
        <header className="chat-head">
          <h3 className="chat-title">Expense assistant</h3>
          {extraction.messages.length > 0 && (
            <button
              type="button"
              className="chat-restart"
              disabled={extraction.pending}
              onClick={() => {
                extraction.reset()
                setReply('')
              }}
            >
              Start over
            </button>
          )}
        </header>

        {/* `role="log"` with a polite live region announces each new message to
            a screen reader as it arrives, without interrupting what's being
            read. The scroll container is the live region so the announcement
            and the visible scroll cover the same content. */}
        <div
          className="chat-scroll"
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {extraction.messages.length === 0 ? (
            <p className="chat-empty">
              Describe the expense in your own words. Anything you leave out,
              I’ll ask about — I won’t guess.
            </p>
          ) : (
            extraction.messages.map((message, index) => (
              <div key={index} className={`chat-row chat-row-${message.role}`}>
                {/* Sighted users tell the two apart by which side the bubble
                    sits on; this says the same thing out loud. Neither cue is
                    colour, so both survive a colourblind or greyscale view. */}
                <span className="sr-only">
                  {message.role === 'user' ? 'You said:' : 'Assistant said:'}
                </span>
                <p className="chat-bubble">{message.content}</p>
              </div>
            ))
          )}

          {extraction.pending && (
            <div className="chat-row chat-row-assistant">
              <p className="chat-bubble chat-typing">
                <span className="sr-only">Assistant is typing</span>
                <span className="chat-dot" aria-hidden="true" />
                <span className="chat-dot" aria-hidden="true" />
                <span className="chat-dot" aria-hidden="true" />
              </p>
            </div>
          )}

          {extraction.turn !== null && extraction.turn.question === null && (
            <p className="chat-done">
              Everything’s filled in below — check it and submit.
            </p>
          )}

          {/* Only while something is still being asked, so it can't contradict
              the line above it. */}
          {extraction.turn?.question !== null && extraction.turn?.notes && (
            <p className="chat-aside">Still unknown: {extraction.turn.notes}</p>
          )}
        </div>

        {extraction.error && (
          <p className="error chat-error" role="alert">
            {extraction.error}
          </p>
        )}

        <div className="chat-composer">
          {/* Labelled for screen readers but not visibly — the placeholder and
              the surrounding chat already say what this is, and a "Your answer"
              label above a chat box is the thing that made it feel like a form. */}
          <label className="sr-only" htmlFor="form-description">
            Message the expense assistant
          </label>
          <textarea
            id="form-description"
            ref={composerRef}
            className="chat-input"
            rows={1}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={handleComposerKey}
            placeholder={
              extraction.messages.length === 0
                ? 'e.g. Dinner in Hawaii with Mr. Nitin, $10000'
                : 'Type your answer…'
            }
          />
          <button
            type="button"
            className="chat-send"
            // Disabled while in flight, so an impatient second press can't
            // fire a second paid request.
            disabled={extraction.pending || reply.trim() === ''}
            onClick={() => void handleSend()}
            aria-label="Send message"
          >
            <span aria-hidden="true">↑</span>
          </button>
        </div>
        <p className="chat-hint">
          Enter to send, Shift+Enter for a new line. It records only what you
          tell it.
        </p>
      </section>

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
          onChange={(event) => changeDepartment(event.target.value as Department)}
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
