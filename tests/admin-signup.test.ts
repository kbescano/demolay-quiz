import { describe, expect, it } from 'vitest'

import { adminSignupError, parseAdminEmails } from '../src/lib/admin-signup'

describe('parseAdminEmails', () => {
  it('splits, trims and lowercases', () => {
    expect(parseAdminEmails(' A@x.com, b@Y.com ,,')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('treats missing or blank as empty', () => {
    expect(parseAdminEmails(undefined)).toEqual([])
    expect(parseAdminEmails('  ')).toEqual([])
  })
})

describe('adminSignupError', () => {
  it('closes sign-up in production when no list is set', () => {
    expect(adminSignupError('a@x.com', [], true)).toMatch(/closed/)
  })

  it('is open in local development when no list is set', () => {
    expect(adminSignupError('a@x.com', [], false)).toBeNull()
  })

  it('allows listed emails regardless of case or spacing', () => {
    expect(adminSignupError(' Admin@X.com ', ['admin@x.com'], true)).toBeNull()
  })

  it('refuses everyone else, including in development once a list exists', () => {
    expect(adminSignupError('stranger@x.com', ['admin@x.com'], true)).toMatch(/not on the admin list/)
    expect(adminSignupError('stranger@x.com', ['admin@x.com'], false)).toMatch(/not on the admin list/)
    expect(adminSignupError(undefined, ['admin@x.com'], true)).toMatch(/not on the admin list/)
  })
})
