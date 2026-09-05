// ui/App.test.tsx
//
// End-to-end tests: sign in, submit a form, sign in as someone else, approve
// it — driving the app exactly as a person would, by finding things on screen
// by their label and role.
//
// Because App reads its data from context, each test renders it inside
// AppProvider, just as main.tsx does.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../state/AppProvider'
import { App } from './App'

/** Renders the app wired up the same way the real entry point does. */
function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  )
}

type User = ReturnType<typeof userEvent.setup>

/** Click a person on the sign-on screen. */
async function signInAs(user: User, name: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(name) }))
}

/** Sign out, so the next test step can sign in as somebody else. */
async function signOut(user: User) {
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
}

/** Fill in and submit a form as whoever is currently signed in. */
async function submitForm(user: User, name: string, amount: string) {
  await user.click(screen.getByRole('tab', { name: 'New form' }))
  await user.type(screen.getByLabelText('Name of the form'), name)
  await user.type(screen.getByLabelText('Amount (USD)'), amount)
  await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
}

// Status words like "Approved" now appear twice on screen — once as a stat
// tile label and once inside a form's status badge — so assertions about a
// form's status say `{ selector: '.status-label' }` to name the badge.

// localStorage persists between tests in the same file, so clear it each time
// to keep them independent of one another.
beforeEach(() => {
  localStorage.clear()
})

describe('sign-on', () => {
  it('shows the sign-on page first, with the dummy accounts', () => {
    renderApp()

    expect(screen.getByText('Choose an account to sign in as.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dan Okafor/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Priya Sharma/ })).toBeInTheDocument()
  })

  it('signs a user in and back out again', async () => {
    const user = userEvent.setup()
    renderApp()

    await signInAs(user, 'Dan Okafor')
    expect(screen.getByRole('tab', { name: 'New form' })).toBeInTheDocument()

    await signOut(user)
    expect(screen.getByText('Choose an account to sign in as.')).toBeInTheDocument()
  })

  it('keeps you signed in across a reload', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await signInAs(user, 'Dan Okafor')

    // Unmounting and rendering again is what a page refresh amounts to.
    first.unmount()
    renderApp()

    expect(screen.getByRole('tab', { name: 'New form' })).toBeInTheDocument()
  })
})

describe('what each role can see', () => {
  it('gives an Employee no Approvals tab', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Dan Okafor')

    expect(screen.getByRole('tab', { name: 'New form' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'My forms' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Approvals/ })).not.toBeInTheDocument()
  })

  it('gives a Manager an Approvals tab as well', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Priya Sharma')

    expect(screen.getByRole('tab', { name: /Approvals/ })).toBeInTheDocument()
  })

  it('gives a Senior Manager an Approvals tab as well', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Mei Tan')

    expect(screen.getByRole('tab', { name: /Approvals/ })).toBeInTheDocument()
  })
})

describe('submitting a form', () => {
  it('autogenerates the form number and shows it Under review', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'Laptop replacement', '750')

    await user.click(screen.getByRole('tab', { name: 'My forms' }))

    expect(screen.getByText('FORM-0001')).toBeInTheDocument()
    expect(screen.getByText('Laptop replacement')).toBeInTheDocument()
    expect(screen.getByText('$750.00')).toBeInTheDocument()
    expect(screen.getByText('Under review', { selector: '.status-label' })).toBeInTheDocument()
  })

  it('numbers each form in sequence', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'First', '100')
    await submitForm(user, 'Second', '200')

    await user.click(screen.getByRole('tab', { name: 'My forms' }))

    expect(screen.getByText('FORM-0001')).toBeInTheDocument()
    expect(screen.getByText('FORM-0002')).toBeInTheDocument()
  })

  it('rejects a form with no name or a bad amount', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Dan Okafor')

    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give the form a name.')

    await user.type(screen.getByLabelText('Name of the form'), 'Laptop')
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the amount as a number.')
  })

  it('saves a draft and submits it later', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Dan Okafor')

    await user.type(screen.getByLabelText('Name of the form'), 'Monitor')
    await user.type(screen.getByLabelText('Amount (USD)'), '300')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))

    await user.click(screen.getByRole('tab', { name: 'My forms' }))
    expect(screen.getByText('Draft', { selector: '.status-label' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(screen.getByText('Under review', { selector: '.status-label' })).toBeInTheDocument()
  })
})

describe('routing by amount', () => {
  it('sends a form of $1000 or less to the Manager only', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'Laptop', '750')
    await user.click(screen.getByRole('tab', { name: 'My forms' }))

    expect(screen.getByText('Manager')).toBeInTheDocument()
    // No Senior Manager stage at all on a low-value form.
    expect(screen.queryByText('Senior Manager')).not.toBeInTheDocument()
  })

  it('sends a form above $1000 to the Manager and then a Senior Manager', async () => {
    const user = userEvent.setup()
    renderApp()
    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'Workstation', '5000')
    await user.click(screen.getByRole('tab', { name: 'My forms' }))

    expect(screen.getByText('Manager')).toBeInTheDocument()
    expect(screen.getByText('Senior Manager')).toBeInTheDocument()
    expect(screen.getByText('Awaiting decision')).toBeInTheDocument()
    expect(screen.getByText('Not yet reached')).toBeInTheDocument()
  })
})

describe('approving and rejecting', () => {
  it('lets a Manager approve a low-value form, which then reads Approved', async () => {
    const user = userEvent.setup()
    renderApp()

    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'Laptop', '750')
    await signOut(user)

    await signInAs(user, 'Priya Sharma')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    // It leaves her queue and lands in her decision history.
    expect(screen.getByText('Nothing is waiting on you right now.')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()

    // And the submitter sees it as Approved.
    await signOut(user)
    await signInAs(user, 'Dan Okafor')
    await user.click(screen.getByRole('tab', { name: 'My forms' }))
    expect(screen.getByText('Approved', { selector: '.status-label' })).toBeInTheDocument()
  })

  it('passes a high-value form to the Senior Manager after the Manager approves', async () => {
    const user = userEvent.setup()
    renderApp()

    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'Workstation', '5000')
    await signOut(user)

    // The Senior Manager cannot act until the Manager has.
    await signInAs(user, 'Mei Tan')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    expect(screen.getByText('Nothing is waiting on you right now.')).toBeInTheDocument()
    await signOut(user)

    await signInAs(user, 'Priya Sharma')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await signOut(user)

    // Now it reaches her.
    await signInAs(user, 'Mei Tan')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await signOut(user)

    await signInAs(user, 'Dan Okafor')
    await user.click(screen.getByRole('tab', { name: 'My forms' }))
    expect(screen.getByText('Approved', { selector: '.status-label' })).toBeInTheDocument()
  })

  it('stops the chain when the Manager rejects', async () => {
    const user = userEvent.setup()
    renderApp()

    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'Workstation', '5000')
    await signOut(user)

    await signInAs(user, 'Priya Sharma')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await signOut(user)

    // It never reaches the Senior Manager.
    await signInAs(user, 'Mei Tan')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    expect(screen.getByText('Nothing is waiting on you right now.')).toBeInTheDocument()
    await signOut(user)

    await signInAs(user, 'Dan Okafor')
    await user.click(screen.getByRole('tab', { name: 'My forms' }))
    expect(screen.getByText('Rejected', { selector: '.status-label' })).toBeInTheDocument()
  })

  it('never puts a form in the submitter’s own approval queue', async () => {
    const user = userEvent.setup()
    renderApp()

    // Priya is a Manager submitting her own form.
    await signInAs(user, 'Priya Sharma')
    await submitForm(user, 'Standing desk', '400')

    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    expect(screen.getByText('Nothing is waiting on you right now.')).toBeInTheDocument()

    await signOut(user)

    // The other Manager can approve it, so the form isn't stuck.
    await signInAs(user, 'Tom Becker')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
  })

  it("shows an approver only their own decisions", async () => {
    const user = userEvent.setup()
    renderApp()

    await signInAs(user, 'Dan Okafor')
    await submitForm(user, 'Laptop', '750')
    await signOut(user)

    await signInAs(user, 'Priya Sharma')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    const table = screen.getByRole('table')
    expect(within(table).getByText('FORM-0001')).toBeInTheDocument()
    await signOut(user)

    // Tom decided nothing, so his history is empty.
    await signInAs(user, 'Tom Becker')
    await user.click(screen.getByRole('tab', { name: /Approvals/ }))
    expect(screen.getByText("You haven't approved or rejected anything yet.")).toBeInTheDocument()
  })
})
