// ui/App.tsx
//
// The top level. It answers one question first — is anyone signed in? — and
// then shows either the sign-on screen or the app itself.
//
// Navigation is a plain piece of state holding which tab is showing. A router
// library would be the answer for a bigger app with real URLs; for three tabs
// this is far less machinery to understand.

import { useState } from 'react'
import { formsAwaiting } from '../domain/workflow'
import { useApp } from '../state/useApp'
import { ApprovalsPage } from './ApprovalsPage'
import { MyFormsPage } from './MyFormsPage'
import { NewFormPage } from './NewFormPage'
import { SignInPage } from './SignInPage'
import { AuditPage } from './AuditPage'

type Tab = 'new' | 'mine' | 'approvals' | 'audit'

export function App() {
  const { currentUser, forms, signOut } = useApp()
  const [tab, setTab] = useState<Tab>('new')

  // Nobody signed in: the sign-on page is all there is. This is also what
  // enforces the roles — no signed-in user means no access to anything below.
  if (currentUser === null) {
    return <SignInPage />
  }

  // Employees don't approve, so they never see the tab. The page itself is
  // also never rendered for them, so hiding the tab isn't the only guard.
  const canApprove = currentUser.role !== 'Employee'
  const canAudit = currentUser.role === 'Senior Manager'
  const awaitingCount = canApprove ? formsAwaiting(forms, currentUser).length : 0

  return (
    <div className="page">
      {/* The bar spans the full window width; everything below it is held in
          a centred, readable column by .content-wrap. */}
      <header className="topbar">
        <h1 className="topbar-title">
          <span className="topbar-mark" aria-hidden="true">
            FA
          </span>
          Form Approval Workflow
        </h1>

        <div className="topbar-right">
          <div className="topbar-user">
            <span className="topbar-name">{currentUser.name}</span>
            <span className={`role-badge role-${currentUser.role.replace(' ', '-')}`}>
              {currentUser.role}
            </span>
          </div>
          <button type="button" className="btn btn-small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="content-wrap">
        {/* role="tablist" and aria-selected tell assistive technology this is a
            set of tabs and which one is chosen — information otherwise carried
            only by colour. */}
        <nav className="tabs" role="tablist" aria-label="Sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'new'}
          className={`tab${tab === 'new' ? ' tab-active' : ''}`}
          onClick={() => setTab('new')}
        >
          New form
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={`tab${tab === 'mine' ? ' tab-active' : ''}`}
          onClick={() => setTab('mine')}
        >
          My forms
        </button>
        {canApprove && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'approvals'}
            className={`tab${tab === 'approvals' ? ' tab-active' : ''}`}
            onClick={() => setTab('approvals')}
          >
            Approvals
            {awaitingCount > 0 && <span className="tab-count">{awaitingCount}</span>}
          </button>
        )}
        {canAudit && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'audit'}
            className={`tab${tab === 'audit' ? ' tab-active' : ''}`}
            onClick={() => setTab('audit')}
          >
            Audit trail
          </button>
        )}
        </nav>

        <main className="content">
          {tab === 'new' && <NewFormPage />}
          {tab === 'mine' && <MyFormsPage />}
          {/* The `canApprove &&` matters: it stops an Employee reaching this
              page even if the tab state were somehow set to 'approvals'. */}
          {tab === 'approvals' && canApprove && <ApprovalsPage />}
          {tab === 'audit' && canAudit && <AuditPage />}
        </main>
      </div>
    </div>
  )
}
