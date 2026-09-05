// data/users.ts
//
// The dummy user directory. There is no real sign-on server behind this app,
// so these stand in for the accounts an organisation would have — they are
// what the sign-in page lists, and what the tests sign in as.
//
// Everything here is made up. Five people in each of the three roles.
//
// To add someone, add a row: nothing else needs to change. The sign-in page
// groups by role on its own, and the app only ever asks a user for its `role`.

import type { Department, Role, User } from '../domain/types'

/**
 * The roles in the order they should be shown — least to most senior.
 * The sign-in page walks this list to build its groups.
 */
export const ROLES: readonly Role[] = ['Employee', 'Manager', 'Senior Manager'] as const
export const DEPARTMENTS: readonly Department[] = ['Legal', 'Finance', 'IT'] as const

export const USERS: User[] = [
  // --- Employees: can raise forms and track their own, nothing more. ---
  { id: 'emp-1', name: 'Dan Okafor', email: 'dan.okafor@example.com', role: 'Employee', department: 'Finance' },
  { id: 'emp-2', name: 'Sam Ellis', email: 'sam.ellis@example.com', role: 'Employee', department: 'Legal' },
  { id: 'emp-3', name: 'Aisha Khan', email: 'aisha.khan@example.com', role: 'Employee', department: 'IT' },
  { id: 'emp-4', name: 'Marco Silva', email: 'marco.silva@example.com', role: 'Employee', department: 'Finance' },
  { id: 'emp-5', name: 'Yuki Tanaka', email: 'yuki.tanaka@example.com', role: 'Employee', department: 'Legal' },

  // --- Managers: the first approval stage on every submitted form. ---
  //
  // Having several matters, not just for realism: nobody may approve their own
  // form, so a form a Manager raises needs a DIFFERENT Manager to sign it off.
  // With only one Manager in the directory, that form could never move.
  { id: 'mgr-1', name: 'Priya Sharma', email: 'priya.sharma@example.com', role: 'Manager', department: 'Finance' },
  { id: 'mgr-2', name: 'Tom Becker', email: 'tom.becker@example.com', role: 'Manager', department: 'Finance' },
  { id: 'mgr-3', name: 'Grace Mwangi', email: 'grace.mwangi@example.com', role: 'Manager', department: 'Legal' },
  { id: 'mgr-4', name: 'Ivan Petrov', email: 'ivan.petrov@example.com', role: 'Manager', department: 'IT' },
  { id: 'mgr-5', name: 'Laura Estevez', email: 'laura.estevez@example.com', role: 'Manager', department: 'IT' },

  // --- Senior Managers: the second stage, only on forms above $1,000. ---
  { id: 'snr-1', name: 'Mei Tan', email: 'mei.tan@example.com', role: 'Senior Manager', department: 'Finance' },
  { id: 'snr-2', name: 'Alex Reid', email: 'alex.reid@example.com', role: 'Senior Manager', department: 'Finance' },
  { id: 'snr-3', name: 'Omar Haddad', email: 'omar.haddad@example.com', role: 'Senior Manager', department: 'Legal' },
  { id: 'snr-4', name: 'Hannah Kruger', email: 'hannah.kruger@example.com', role: 'Senior Manager', department: 'IT' },
  { id: 'snr-5', name: 'Rajiv Menon', email: 'rajiv.menon@example.com', role: 'Senior Manager', department: 'IT' },
]

/** Look up one user by id. Returns undefined if the id isn't in the list. */
export function findUser(id: string): User | undefined {
  return USERS.find((user) => user.id === id)
}

/** Everyone holding a given role, in directory order. */
export function usersWithRole(role: Role): User[] {
  return USERS.filter((user) => user.role === role)
}
