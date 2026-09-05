// ui/SignInPage.tsx
//
// The sign-on screen, shown whenever nobody is signed in.
//
// IMPORTANT: this is a stand-in for single sign-on, not the real thing. There
// is no server, no password and no identity provider — you pick an account
// from the dummy directory and the app takes your word for it. Real SSO needs
// a backend, and none of this would be safe as an actual login.
//
// With fifteen accounts a flat list would be a wall of rows, so they're
// grouped by role. The group heading carries the role, which means each row
// doesn't have to repeat it.

import { ROLES, usersWithRole } from '../data/users'
import { useApp } from '../state/useApp'
import type { Role } from '../domain/types'

/** What each role can do, shown once per group rather than on every row. */
const ROLE_SUMMARY: Record<Role, string> = {
  Employee: 'Submit forms and track your own',
  Manager: 'Also approve or reject — the first stage on every form',
  'Senior Manager': 'Also approve or reject — the second stage, above $1,000',
}

export function SignInPage() {
  const { signIn } = useApp()

  return (
    <div className="signin">
      <div className="signin-card">
        <h1 className="signin-title">Form Approval Workflow</h1>
        <p className="signin-subtitle">Choose an account to sign in as.</p>

        <p className="signin-notice">
          <strong>Demo sign-on.</strong> There is no password and no real single sign-on
          behind this — these are test accounts from the dummy directory.
        </p>

        {/* The list scrolls inside the card, so the card itself never grows
            taller than the window however many accounts are added. */}
        <div className="signin-groups">
          {ROLES.map((role) => {
            const users = usersWithRole(role)

            return (
              <section className="signin-group" key={role}>
                <header className="signin-group-header">
                  <span className={`role-badge role-${role.replace(' ', '-')}`}>{role}</span>
                  <span className="signin-group-count">{users.length}</span>
                  <p className="signin-group-note">{ROLE_SUMMARY[role]}</p>
                </header>

                <ul className="signin-list">
                  {users.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="signin-user"
                        onClick={() => signIn(user.id)}
                      >
                        {/* Initials as a stand-in avatar, coloured by role.
                            split(' ') breaks the name into words and we take
                            the first letter of each. */}
                        <span
                          className={`signin-avatar avatar-${user.role.replace(' ', '-')}`}
                          aria-hidden="true"
                        >
                          {user.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')}
                        </span>

                        <span className="signin-details">
                          <span className="signin-name">{user.name}</span>
                          <span className="signin-email">{user.email}</span>
                          {user.role !== 'Employee' && (
                            <span className="signin-department">Department: {user.department}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
