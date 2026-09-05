// data/users.test.ts
//
// Tests for the dummy directory itself. These guard the properties the rest of
// the app quietly relies on — the kind of thing that breaks silently when
// someone edits the list months later.

import { describe, expect, it } from 'vitest'
import { ROLES, USERS, findUser, usersWithRole } from './users'

describe('the dummy directory', () => {
  it('has five people in each role', () => {
    for (const role of ROLES) {
      expect(usersWithRole(role)).toHaveLength(5)
    }
    expect(USERS).toHaveLength(15)
  })

  it('gives everyone a unique id', () => {
    const ids = USERS.map((user) => user.id)
    // A Set discards duplicates, so matching sizes means everything was unique.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('links every user to one of the supported departments', () => {
    expect(new Set(USERS.map((user) => user.department))).toEqual(new Set(['Legal', 'Finance', 'IT']))
  })

  it('gives everyone a distinct name', () => {
    const names = USERS.map((user) => user.name)
    expect(new Set(names).size).toBe(names.length)

    // No name may be contained inside another ("Sam" inside "Sam Ellis"), or
    // looking someone up by name — which is how the sign-in tests pick an
    // account — could match the wrong person.
    for (const name of names) {
      expect(names.filter((other) => other.includes(name))).toEqual([name])
    }
  })

  it('has at least two people in every approving role', () => {
    // This is the one that really matters. Nobody may approve their own form,
    // so a form raised by a Manager needs a DIFFERENT Manager to sign it off.
    // With only one person in a role, their own forms could never move.
    for (const role of ROLES) {
      if (role === 'Employee') continue
      expect(usersWithRole(role).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('finds a user by id, and returns undefined for one that is not there', () => {
    expect(findUser('mgr-1')?.name).toBe('Priya Sharma')
    expect(findUser('nobody')).toBeUndefined()
  })
})
