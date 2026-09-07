// ui/ChatAssistant.test.tsx
//
// The chat, driven the way a person drives it. `fetch` is stubbed so these
// run offline and cost nothing — what's under test is the UI's behaviour,
// not the model's answers.

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../state/AppProvider'
import type { ExtractionTurn } from '../ai/extractionSchema'
import { App } from './App'

function turn(overrides: Partial<ExtractionTurn> = {}): ExtractionTurn {
  return {
    name: 'Dinner in Hawaii with Mr. Nitin',
    amount: 10000,
    department: 'Finance',
    expenseType: null,
    question: 'Who is Mr. Nitin in relation to your work?',
    notes: 'Expense type still unknown.',
    ...overrides,
  }
}

/** Stub /api/extract with a queue of turns, one per call. */
function stubApi(...turns: ExtractionTurn[]) {
  let call = 0
  const fetchMock = vi.fn(async () => {
    const body = JSON.stringify({ turn: turns[Math.min(call++, turns.length - 1)] })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function openChat() {
  const user = userEvent.setup()
  render(
    <AppProvider>
      <App />
    </AppProvider>,
  )
  await user.click(screen.getByRole('button', { name: /Dan Okafor/ }))
  await user.click(screen.getByRole('tab', { name: 'New form' }))
  return user
}

const composer = () => screen.getByLabelText('Message the expense assistant')
const log = () => screen.getByRole('log', { name: 'Conversation' })

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('the chat assistant', () => {
  it('invites you to start, before anything is sent', async () => {
    await openChat()

    expect(screen.getByText(/Describe the expense in your own words/)).toBeInTheDocument()
    // Nothing to restart yet.
    expect(screen.queryByRole('button', { name: 'Start over' })).not.toBeInTheDocument()
  })

  it("won't send an empty message", async () => {
    const fetchMock = stubApi(turn())
    const user = await openChat()

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends on Enter and shows both sides of the exchange', async () => {
    stubApi(turn())
    const user = await openChat()

    await user.type(composer(), 'Dinner in Hawaii with Mr. Nitin, $10000{Enter}')

    await waitFor(() => {
      expect(within(log()).getByText(/Who is Mr. Nitin/)).toBeInTheDocument()
    })
    expect(within(log()).getByText(/Dinner in Hawaii with Mr. Nitin/)).toBeInTheDocument()
    // The composer empties, ready for the answer.
    expect(composer()).toHaveValue('')
  })

  it('does not send on Shift+Enter, so answers can have line breaks', async () => {
    const fetchMock = stubApi(turn())
    const user = await openChat()

    await user.type(composer(), 'first line{Shift>}{Enter}{/Shift}second line')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(composer()).toHaveValue('first line\nsecond line')
  })

  it('fills the form fields as they become known, and never guesses the rest', async () => {
    stubApi(turn())
    const user = await openChat()

    await user.type(composer(), 'Dinner in Hawaii with Mr. Nitin, $10000{Enter}')

    await waitFor(() => {
      expect(screen.getByLabelText('Name of the form')).toHaveValue(
        'Dinner in Hawaii with Mr. Nitin',
      )
    })
    expect(screen.getByLabelText('Amount (USD)')).toHaveValue(10000)
    // expenseType came back null, so the dropdown keeps its own value rather
    // than being filled with a guess.
    expect(screen.getByLabelText('Expense type')).toHaveValue('Travel')
  })

  it('says so when nothing is left to ask', async () => {
    stubApi(turn({ expenseType: 'Client entertainment', question: null, notes: '' }))
    const user = await openChat()

    await user.type(composer(), 'Client dinner, $10000, he is a client{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/Everything.s filled in below/)).toBeInTheDocument()
    })
    // The "still unknown" aside must not contradict the line above it.
    expect(screen.queryByText(/Still unknown/)).not.toBeInTheDocument()
  })

  it('clears the conversation on Start over', async () => {
    stubApi(turn())
    const user = await openChat()

    await user.type(composer(), 'Dinner in Hawaii{Enter}')
    await waitFor(() => expect(within(log()).getByText(/Who is Mr. Nitin/)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Start over' }))

    expect(screen.queryByText(/Who is Mr. Nitin/)).not.toBeInTheDocument()
    expect(screen.getByText(/Describe the expense in your own words/)).toBeInTheDocument()
  })

  it('shows the error and keeps the page usable when the server fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Rate limited — try again in a moment.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const user = await openChat()

    await user.type(composer(), 'Dinner in Hawaii{Enter}')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Rate limited')
    })
    // The failed turn is dropped, so a retry doesn't resend a message the
    // model never answered — and the composer is enabled again.
    expect(composer()).toBeEnabled()
  })
})
